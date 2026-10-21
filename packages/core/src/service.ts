import type { Store, Repository, Clock, User, PublicUser, Campus, Course, Ride, RideView, Booking, Vehicle, Match, Hub, Outbox } from './types';
import { ensure, fail } from './errors';
import * as v from './validate';
import { id, randomToken, digest, hashPassword, verifyPassword } from './crypto';
import { localParts, zonedInstant, weekday, datesBetween, overlaps, addDays, durationMinutes } from './time';
import { rankRides } from './matching';
export const activeBooking = ['REQUESTED', 'WAITLISTED', 'CONFIRMED'];
export interface Config {
    origin: string;
    demo: boolean;
    sessionDays?: number;
}
export const publicUser = (u: User): PublicUser => ({ id: u.id, name: u.name, email: u.email, campusId: u.campusId, homeHubId: u.homeHubId, role: u.role, emailVerified: !!u.emailVerifiedAt });
export class CarpoolService {
    constructor(public readonly store: Store, public readonly config: Config, public readonly clock: Clock = { now: () => new Date() }) { }
    now() { return this.clock.now().toISOString(); }
    async required<K extends 'user' | 'ride' | 'booking' | 'hub' | 'campus' | 'vehicle' | 'course' | 'notification' | 'report'>(db: Repository, table: K, key: string) {
        const x = await db.get(table, key);
        ensure(x, 404, 'NOT_FOUND', 'The requested record was not found.');
        return x;
    }
    async actor(db: Repository, userId: string): Promise<User> { const u = await this.required(db, 'user', userId); ensure(!u.suspendedAt, 403, 'SUSPENDED', 'This account is suspended.'); ensure(u.emailVerifiedAt, 403, 'VERIFY_EMAIL', 'Verify your campus email first.'); return u; }
    async audit(db: Repository, actorId: string | null, action: string, entityId: string, detail = '') { await db.create('audit', { id: id(), actorId, action, entityId, detail, createdAt: this.now() }); }
    async notify(db: Repository, userId: string, title: string, body: string, rideId: string | null = null) {
        await db.create('notification', { id: id(), userId, title, body, rideId, readAt: null, createdAt: this.now() });
        const u = await db.get('user', userId);
        if (u)
            await this.email(db, u, title, body);
    }
    async email(db: Repository, u: User, subject: string, body: string) { await db.create('outbox', { id: id(), userId: u.id, to: u.email, subject, body, attempts: 0, availableAt: this.now(), sentAt: null, claimedAt: null, createdAt: this.now() }); }
    async rateLimit(key: string, limit: number, windowMs = 60000) {
        const n = this.clock.now().getTime(), bucket = `${digest(key)}:${Math.floor(n / windowMs)}`;
        await this.store.transaction(async (db) => {
            const old = await db.get('rateBucket', bucket);
            ensure(!old || old.count < limit, 429, 'RATE_LIMIT', 'Too many requests. Please try again shortly.');
            if (old)
                await db.update('rateBucket', bucket, { count: old.count + 1 });
            else
                await db.create('rateBucket', { id: bucket, count: 1, expiresAt: new Date((Math.floor(n / windowMs) + 1) * windowMs).toISOString() });
        });
    }
    async catalog() { return this.store.read(async (db) => ({ campuses: await db.list('campus', { take: 50 }), hubs: await db.list('hub', { take: 500 }), demo: this.config.demo })); }
    async register(input: unknown) {
        const b = v.object(input), email = v.email(b.email), name = v.text(b.name, 'Name', 2, 60), campusId = v.text(b.campusId, 'Campus'), pw = v.password(b.password);
        const hash = await hashPassword(pw), token = randomToken();
        await this.store.transaction(async (db) => {
            const campus = await this.required(db, 'campus', campusId);
            ensure(email.split('@')[1] === campus.emailDomain, 400, 'CAMPUS_EMAIL', `Use an email at ${campus.emailDomain}.`);
            const existing = (await db.list('user', { where: { email }, take: 1 }))[0];
            if (existing)
                return;
            const user: User = { id: id(), email, passwordHash: hash, name, campusId, homeHubId: null, role: 'STUDENT', emailVerifiedAt: null, suspendedAt: null, createdAt: this.now() };
            await db.create('user', user);
            await db.create('actionToken', { id: id(), userId: user.id, tokenHash: digest(token), purpose: 'VERIFY_EMAIL', expiresAt: new Date(this.clock.now().getTime() + 3600000).toISOString(), usedAt: null });
            await this.email(db, user, 'Verify your CampusLoop email', `Use this one-time verification code within 60 minutes:\n${token}\nOpen ${this.config.origin}/ and choose Verify email. Never share this code.`);
            await this.audit(db, user.id, 'ACCOUNT_REGISTERED', user.id);
        });
        return { message: 'If this address can be registered, a verification email has been queued.' };
    }
    async verifyEmail(input: unknown) {
        const token = v.text(v.object(input).token, 'Token', 20, 200);
        await this.store.transaction(async (db) => { const t = (await db.list('actionToken', { where: { tokenHash: digest(token), purpose: 'VERIFY_EMAIL', usedAt: null, expiresAt: { gt: this.now() } }, take: 1 }))[0]; ensure(t, 400, 'INVALID_TOKEN', 'The verification code is invalid or expired.'); await db.update('actionToken', t.id, { usedAt: this.now() }); await db.update('user', t.userId, { emailVerifiedAt: this.now() }); await this.audit(db, t.userId, 'EMAIL_VERIFIED', t.userId); });
        return { message: 'Email verified. You can now sign in.' };
    }
    async login(input: unknown) {
        const b = v.object(input), email = v.email(b.email), pw = v.password(b.password);
        await this.rateLimit(`login-email:${email}`, 10, 900000);
        const user = await this.store.read(async (db) => (await db.list('user', { where: { email }, take: 1 }))[0] ?? null);
        // Perform equal-cost scrypt even if the account does not exist.
        const encoded = user?.passwordHash ?? `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
        const valid = await verifyPassword(pw, encoded);
        ensure(user && valid, 401, 'INVALID_LOGIN', 'Email or password is incorrect.');
        const token = randomToken();
        const expiresAt = new Date(this.clock.now().getTime() + (this.config.sessionDays ?? 7) * 86400000).toISOString();
        await this.store.transaction(async (db) => { await this.actor(db, user.id); await db.create('session', { id: id(), userId: user.id, tokenHash: digest(token), expiresAt, createdAt: this.now() }); await this.audit(db, user.id, 'SIGNED_IN', user.id); });
        return { token, expiresAt, user: publicUser(user) };
    }
    async authenticate(raw: string | undefined): Promise<User> { ensure(raw && raw.length <= 200, 401, 'UNAUTHENTICATED', 'Please sign in.'); return this.store.read(async (db) => { const s = (await db.list('session', { where: { tokenHash: digest(raw), expiresAt: { gt: this.now() } }, take: 1 }))[0]; ensure(s, 401, 'UNAUTHENTICATED', 'Session expired. Please sign in.'); return this.actor(db, s.userId); }); }
    async logout(raw: string) { await this.store.transaction(async (db) => { for (const s of await db.list('session', { where: { tokenHash: digest(raw) } }))
        await db.remove('session', s.id); }); return { message: 'Signed out.' }; }
    async requestReset(input: unknown) {
        const email = v.email(v.object(input).email);
        await this.rateLimit(`reset-email:${email}`, 3, 3600000);
        const raw = randomToken();
        await this.store.transaction(async (db) => {
            const u = (await db.list('user', { where: { email }, take: 1 }))[0];
            if (!u || u.suspendedAt)
                return;
            for (const t of await db.list('actionToken', { where: { userId: u.id, purpose: 'RESET_PASSWORD', usedAt: null } }))
                await db.update('actionToken', t.id, { usedAt: this.now() });
            await db.create('actionToken', { id: id(), userId: u.id, tokenHash: digest(raw), purpose: 'RESET_PASSWORD', expiresAt: new Date(this.clock.now().getTime() + 1800000).toISOString(), usedAt: null });
            await this.email(db, u, 'Reset your CampusLoop password', `Your one-time reset code (30 minutes):\n${raw}\nOpen ${this.config.origin}/ and choose Reset password.`);
        });
        return { message: 'If the account exists, a password-reset email has been queued.' };
    }
    async resetPassword(input: unknown) { const b = v.object(input), raw = v.text(b.token, 'Token', 20, 200), hash = await hashPassword(v.password(b.password)); await this.store.transaction(async (db) => { const t = (await db.list('actionToken', { where: { tokenHash: digest(raw), purpose: 'RESET_PASSWORD', usedAt: null, expiresAt: { gt: this.now() } }, take: 1 }))[0]; ensure(t, 400, 'INVALID_TOKEN', 'The reset code is invalid or expired.'); await db.update('user', t.userId, { passwordHash: hash }); await db.update('actionToken', t.id, { usedAt: this.now() }); for (const s of await db.list('session', { where: { userId: t.userId }, take: 10000 }))
        await db.remove('session', s.id); await this.audit(db, t.userId, 'PASSWORD_RESET', t.userId); }); return { message: 'Password changed. All existing sessions have been revoked.' }; }
    async me(userId: string) { return this.store.read(async (db) => { const u = await this.actor(db, userId); return { user: publicUser(u), campus: await this.required(db, 'campus', u.campusId), demo: this.config.demo }; }); }
    async profile(userId: string, input: unknown) { const b = v.object(input); return this.store.transaction(async (db) => { const u = await this.actor(db, userId); const name = b.name === undefined ? u.name : v.text(b.name, 'Name', 2, 60); const homeHubId = b.homeHubId === null ? null : b.homeHubId === undefined ? u.homeHubId : v.text(b.homeHubId, 'Home hub'); if (homeHubId) {
        const h = await this.required(db, 'hub', homeHubId);
        ensure(h.campusId === u.campusId && !h.isCampus, 400, 'INVALID_HUB', 'Choose a public pickup hub in your campus community.');
    } return publicUser(await db.update('user', u.id, { name, homeHubId })); }); }
    async courses(userId: string) { return this.store.read(async (db) => { await this.actor(db, userId); return db.list('course', { where: { userId }, orderBy: { weekday: 'asc', startMinute: 'asc' }, take: 100 }); }); }
    async addCourse(userId: string, input: unknown) {
        const b = v.object(input);
        const course: Course = { id: id(), userId, name: v.text(b.name, 'Course name', 2, 80), weekday: v.integer(b.weekday, 'Weekday', 1, 7), startMinute: v.minute(b.start), endMinute: v.minute(b.end), termStart: v.dateOnly(b.termStart), termEnd: v.dateOnly(b.termEnd) };
        ensure(course.endMinute > course.startMinute, 400, 'INVALID_TIME', 'Class must end after it starts.');
        ensure(course.termEnd >= course.termStart && (Date.parse(course.termEnd) - Date.parse(course.termStart)) / 86400000 <= 370, 400, 'INVALID_RANGE', 'Use an ordered term of at most 370 days.');
        return this.store.transaction(async (db) => {
            const u = await this.actor(db, userId);
            const existing = await db.list('course', { where: { userId }, take: 101 });
            ensure(existing.length < 100, 400, 'LIMIT', 'At most 100 weekly schedule entries.');
            ensure(!existing.some(c => c.weekday === course.weekday && c.termStart <= course.termEnd && c.termEnd >= course.termStart && overlaps(c.startMinute, c.endMinute, course.startMinute, course.endMinute)), 409, 'CLASS_CONFLICT', 'This class overlaps another scheduled class.');
            const campus = await this.required(db, 'campus', u.campusId);
            const rides = await this.activeRides(db, userId);
            for (const r of rides)
                ensure(!this.courseConflicts(course, r, campus.timezone), 409, 'RIDE_CONFLICT', 'This class overlaps a ride you are driving or have confirmed.');
            await this.audit(db, userId, 'COURSE_ADDED', course.id);
            return db.create('course', course);
        });
    }
    async removeCourse(userId: string, courseId: string) { return this.store.transaction(async (db) => { await this.actor(db, userId); const c = await this.required(db, 'course', courseId); ensure(c.userId === userId, 404, 'NOT_FOUND', 'Course not found.'); await db.remove('course', c.id); return { deleted: true }; }); }
    async vehicles(userId: string) { return this.store.read(db => db.list('vehicle', { where: { userId }, take: 10 })); }
    async addVehicle(userId: string, input: unknown) { const b = v.object(input); return this.store.transaction(async (db) => { await this.actor(db, userId); ensure((await db.list('vehicle', { where: { userId }, take: 11 })).length < 10, 400, 'LIMIT', 'At most ten vehicles.'); return db.create('vehicle', { id: id(), userId, label: v.text(b.label, 'Vehicle', 2, 80), color: v.text(b.color, 'Color', 2, 40), seats: v.integer(b.seats, 'Passenger seats', 1, 7), accessible: v.bool(b.accessible) }); }); }
    courseConflicts(c: Course, r: Pick<Ride, 'departureAt' | 'arrivalAt'>, timezone: string) { const p = localParts(r.departureAt, timezone), a = localParts(r.arrivalAt, timezone); return c.weekday === weekday(p.date) && c.termStart <= p.date && c.termEnd >= p.date && overlaps(c.startMinute, c.endMinute, p.minute, a.minute); }
    async activeRides(db: Repository, userId: string): Promise<Ride[]> {
        const driven = await db.list('ride', { where: { driverId: userId, status: 'OPEN', arrivalAt: { gt: this.now() } }, take: 500 });
        const bookings = await db.list('booking', { where: { riderId: userId, status: 'CONFIRMED' }, take: 500 });
        const joined = bookings.length ? await db.list('ride', { where: { id: { in: bookings.map(b => b.rideId) }, status: 'OPEN', arrivalAt: { gt: this.now() } }, take: 500 }) : [];
        return [...driven, ...joined];
    }
    async checkAvailability(db: Repository, user: User, ride: Pick<Ride, 'id' | 'departureAt' | 'arrivalAt'>) {
        const campus = await this.required(db, 'campus', user.campusId);
        const courses = await db.list('course', { where: { userId: user.id }, take: 100 });
        ensure(!courses.some(c => this.courseConflicts(c, ride, campus.timezone)), 409, 'CLASS_CONFLICT', 'The ride overlaps a class on your schedule.');
        const active = await this.activeRides(db, user.id);
        ensure(!active.some(r => r.id !== ride.id && overlaps(Date.parse(r.departureAt), Date.parse(r.arrivalAt), Date.parse(ride.departureAt), Date.parse(ride.arrivalAt))), 409, 'RIDE_CONFLICT', 'This ride overlaps another confirmed trip.');
    }
    async offer(userId: string, input: unknown) {
        const b = v.object(input), originHubId = v.text(b.originHubId, 'Origin'), destinationHubId = v.text(b.destinationHubId, 'Destination'), vehicleId = v.text(b.vehicleId, 'Vehicle'), direction = v.oneOf(b.direction, ['TO_CAMPUS', 'FROM_CAMPUS'] as const), date = v.dateOnly(b.date), departure = v.text(b.departure, 'Departure', 5, 5), arrival = v.text(b.arrival, 'Arrival', 5, 5), capacity = v.integer(b.capacity, 'Seats', 1, 7), costCents = v.integer(b.costCents, 'Contribution', 0, 3000), quiet = v.bool(b.quiet);
        let dates = [date];
        const recurring = b.repeatUntil !== undefined;
        if (recurring) {
            ensure(Array.isArray(b.weekdays) && b.weekdays.length > 0 && b.weekdays.length <= 7, 400, 'INVALID_INPUT', 'Select repeat weekdays.');
            const days = [...new Set(b.weekdays.map(x => v.integer(x, 'Weekday', 1, 7)))];
            dates = datesBetween(date, v.dateOnly(b.repeatUntil), days);
            ensure(dates.length > 0, 400, 'INVALID_RANGE', 'No selected weekdays in this range.');
        }
        const seriesId = recurring ? id() : null;
        return this.store.transaction(async (db) => {
            const u = await this.actor(db, userId), campus = await this.required(db, 'campus', u.campusId), origin = await this.required(db, 'hub', originHubId), destination = await this.required(db, 'hub', destinationHubId), vehicle = await this.required(db, 'vehicle', vehicleId);
            ensure(vehicle.userId === userId && capacity <= vehicle.seats, 400, 'VEHICLE', 'Choose your own vehicle with enough passenger seats.');
            ensure(origin.campusId === u.campusId && destination.campusId === u.campusId && origin.id !== destination.id, 400, 'INVALID_ROUTE', 'Both hubs must belong to your campus.');
            ensure(direction === 'TO_CAMPUS' ? !origin.isCampus && destination.isCampus : origin.isCampus && !destination.isCampus, 400, 'INVALID_ROUTE', 'One end must be campus and the other a neighborhood hub.');
            const open = await db.list('ride', { where: { driverId: userId, status: 'OPEN', departureAt: { gt: this.now() } }, take: 501 });
            ensure(open.length + dates.length <= 100, 400, 'LIMIT', 'At most 100 upcoming offers per driver.');
            const result: Ride[] = [];
            for (const d of dates) {
                const departureAt = zonedInstant(d, departure, campus.timezone), arrivalAt = zonedInstant(d, arrival, campus.timezone);
                ensure(departureAt > this.now() && Date.parse(departureAt) - this.clock.now().getTime() <= 90 * 86400000, 400, 'INVALID_DATE', 'Publish a future ride within 90 days.');
                ensure(durationMinutes(departureAt, arrivalAt) >= 5 && durationMinutes(departureAt, arrivalAt) <= 180, 400, 'INVALID_TIME', 'A ride must take 5–180 minutes within one local day.');
                const ride: Ride = { id: id(), campusId: u.campusId, driverId: userId, vehicleId, originHubId, destinationHubId, direction, departureAt, arrivalAt, capacity, seatsUsed: 0, costCents, quiet, status: 'OPEN', seriesId, createdAt: this.now() };
                await this.checkAvailability(db, u, ride);
                await db.create('ride', ride);
                await this.audit(db, u.id, 'RIDE_OFFERED', ride.id, seriesId ?? 'single');
                result.push(ride);
            }
            return result;
        });
    }
    async view(db: Repository, ride: Ride, userId: string): Promise<RideView> {
        const driver = await this.required(db, 'user', ride.driverId), vehicle = await this.required(db, 'vehicle', ride.vehicleId), mine = (await db.list('booking', { where: { rideId: ride.id, riderId: userId }, take: 1 }))[0] ?? null;
        const { userId: owner, ...car } = vehicle;
        return { ...ride, driver: { id: driver.id, name: driver.name }, origin: await this.required(db, 'hub', ride.originHubId), destination: await this.required(db, 'hub', ride.destinationHubId), vehicle: car, availableSeats: ride.capacity - ride.seatsUsed, myBooking: mine };
    }
    async matches(userId: string, query: Record<string, unknown>): Promise<{
        rides: Match[];
        date: string;
        timezone: string;
        hasSchedule: boolean;
        limited: boolean;
    }> {
        return this.store.read(async (db) => {
            const u = await this.actor(db, userId), campus = await this.required(db, 'campus', u.campusId);
            ensure(u.homeHubId, 400, 'SET_HOME_HUB', 'Select your pickup hub in Profile first.');
            const home = await this.required(db, 'hub', u.homeHubId), date = v.dateOnly(query.date), direction = v.oneOf(query.direction ?? 'TO_CAMPUS', ['TO_CAMPUS', 'FROM_CAMPUS'] as const);
            const courses = await db.list('course', { where: { userId }, take: 100 });
            const raw = await db.list('ride', { where: { campusId: u.campusId, status: 'OPEN', driverId: { not: userId }, departureAt: { gt: this.now(), gte: zonedInstant(date, '00:00', campus.timezone), lt: zonedInstant(addDays(date, 1), '00:00', campus.timezone) } }, orderBy: { departureAt: 'asc' }, take: 201 });
            const views: RideView[] = [];
            for (const r of raw.slice(0, 200)) {
                const driver = await db.get('user', r.driverId);
                if (!driver || driver.suspendedAt)
                    continue;
                views.push(await this.view(db, r, userId));
            }
            const active = await this.activeRides(db, userId);
            const free = views.filter(r => !active.some(a => a.id !== r.id && overlaps(Date.parse(a.departureAt), Date.parse(a.arrivalAt), Date.parse(r.departureAt), Date.parse(r.arrivalAt))) && !courses.some(c => this.courseConflicts(c, r, campus.timezone)));
            const result = rankRides(free, courses, { date, timezone: campus.timezone, home, direction, bufferMinutes: v.integer(query.bufferMinutes ?? 10, 'Buffer', 0, 60), maxWalkKm: v.integer(query.maxWalkMeters ?? 3000, 'Max distance', 0, 10000) / 1000, maxCostCents: v.integer(query.maxCostCents ?? 1500, 'Contribution', 0, 3000), accessible: v.bool(query.accessible), quiet: v.bool(query.quiet), includeWaitlist: v.bool(query.includeWaitlist, true), manualMinute: query.targetTime ? v.minute(query.targetTime) : undefined });
            return { rides: result, date, timezone: campus.timezone, hasSchedule: courses.some(c => c.weekday === weekday(date) && c.termStart <= date && c.termEnd >= date), limited: raw.length > 200 };
        });
    }
    async ride(userId: string, rideId: string) { return this.store.read(async (db) => { const u = await this.actor(db, userId), r = await this.required(db, 'ride', rideId); ensure(r.campusId === u.campusId, 404, 'NOT_FOUND', 'Ride not found.'); return this.view(db, r, userId); }); }
    async myRides(userId: string) { return this.store.read(async (db) => { await this.actor(db, userId); const rides = await db.list('ride', { where: { driverId: userId }, orderBy: { departureAt: 'desc' }, take: 100 }); return Promise.all(rides.map(r => this.view(db, r, userId))); }); }
    async myBookings(userId: string) { return this.store.read(async (db) => { await this.actor(db, userId); const items = await db.list('booking', { where: { riderId: userId }, orderBy: { createdAt: 'desc' }, take: 100 }); return Promise.all(items.map(async (b) => ({ ...b, ride: await this.view(db, await this.required(db, 'ride', b.rideId), userId) }))); }); }
    async driverRequests(userId: string) { return this.store.read(async (db) => { await this.actor(db, userId); const rides = await db.list('ride', { where: { driverId: userId, status: 'OPEN', arrivalAt: { gt: this.now() } }, take: 100 }); if (!rides.length)
        return []; const bookings = await db.list('booking', { where: { rideId: { in: rides.map(r => r.id) }, status: { in: activeBooking } }, orderBy: { createdAt: 'asc' }, take: 200 }); return Promise.all(bookings.map(async (b) => { const u = await this.required(db, 'user', b.riderId); return { ...b, rider: { id: u.id, name: u.name }, ride: rides.find(r => r.id === b.rideId) }; })); }); }
    async requestSeat(userId: string, rideId: string, input: unknown, key: string) {
        const b = v.object(input), note = v.text(b.note ?? '', 'Note', 0, 240), waitlist = v.bool(b.waitlist, true);
        v.text(key, 'Idempotency key', 8, 100);
        const requestHash = digest(JSON.stringify({ rideId, note, waitlist }));
        return this.store.transaction(async (db) => {
            const u = await this.actor(db, userId);
            const previous = (await db.list('idempotency', { where: { userId, key }, take: 1 }))[0];
            if (previous && previous.expiresAt > this.now()) {
                ensure(previous.requestHash === requestHash, 409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used with different input.');
                return this.required(db, 'booking', previous.bookingId);
            }
            if (previous)
                await db.remove('idempotency', previous.id);
            const r = await this.required(db, 'ride', rideId);
            ensure(r.campusId === u.campusId, 404, 'NOT_FOUND', 'Ride not found.');
            ensure(r.driverId !== userId, 400, 'OWN_RIDE', 'You cannot book your own ride.');
            await this.actor(db, r.driverId);
            ensure(r.status === 'OPEN' && r.departureAt > this.now(), 409, 'RIDE_CLOSED', 'This ride is no longer accepting requests.');
            const existing = (await db.list('booking', { where: { rideId, riderId: userId }, take: 1 }))[0];
            ensure(!existing, 409, 'ALREADY_REQUESTED', 'You already requested this ride. View it in My trips.');
            await this.checkAvailability(db, u, r);
            const pending = await db.list('booking', { where: { rideId, status: { in: ['REQUESTED', 'WAITLISTED'] } }, take: 41 });
            ensure(pending.length < 40, 409, 'REQUEST_LIMIT', 'This ride has reached its request limit.');
            const full = r.seatsUsed >= r.capacity;
            ensure(!full || waitlist, 409, 'RIDE_FULL', 'No seats available. You may join the waitlist.');
            const booking: Booking = { id: id(), rideId, riderId: userId, status: full ? 'WAITLISTED' : 'REQUESTED', note, createdAt: this.now(), updatedAt: this.now() };
            await db.create('booking', booking);
            await db.create('idempotency', { id: id(), userId, key, requestHash, bookingId: booking.id, expiresAt: new Date(this.clock.now().getTime() + 86400000).toISOString() });
            await this.notify(db, r.driverId, full ? 'New waitlist entry' : 'New seat request', `${u.name} requested a seat. Open CampusLoop to review.`, r.id);
            await this.audit(db, userId, 'SEAT_REQUESTED', booking.id, booking.status);
            return booking;
        });
    }
    async actOnBooking(userId: string, bookingId: string, action: 'approve' | 'decline' | 'cancel') {
        return this.store.transaction(async (db) => {
            const u = await this.actor(db, userId), b = await this.required(db, 'booking', bookingId), r = await this.required(db, 'ride', b.rideId);
            ensure(action === 'cancel' ? b.riderId === u.id : r.driverId === u.id, 403, 'FORBIDDEN', 'You cannot change this booking.');
            if (action === 'cancel' && b.status === 'CANCELLED')
                return b;
            if (action === 'decline' && b.status === 'DECLINED')
                return b;
            if (action === 'approve' && b.status === 'CONFIRMED')
                return b;
            ensure(r.status === 'OPEN' && r.departureAt > this.now(), 409, 'RIDE_CLOSED', 'Changes are closed after departure or cancellation.');
            ensure(activeBooking.includes(b.status), 409, 'INVALID_STATE', 'This request has already been closed.');
            const confirmed = b.status === 'CONFIRMED';
            if (action === 'approve') {
                ensure(r.seatsUsed < r.capacity, 409, 'RIDE_FULL', 'All seats are already confirmed.');
                const rider = await this.actor(db, b.riderId);
                await this.checkAvailability(db, rider, r);
                await db.update('ride', r.id, { seatsUsed: r.seatsUsed + 1 });
            }
            else if (confirmed) {
                await db.update('ride', r.id, { seatsUsed: r.seatsUsed - 1 });
            }
            const status = action === 'approve' ? 'CONFIRMED' : action === 'decline' ? 'DECLINED' : 'CANCELLED';
            const updated = await db.update('booking', b.id, { status, updatedAt: this.now() });
            await this.notify(db, action === 'cancel' ? r.driverId : b.riderId, `Booking ${status.toLowerCase()}`, `Your ride request is now ${status.toLowerCase()}.`, r.id);
            await this.audit(db, u.id, `BOOKING_${status}`, b.id);
            if (confirmed && action !== 'approve') {
                const next = (await db.list('booking', { where: { rideId: r.id, status: 'WAITLISTED' }, orderBy: { createdAt: 'asc', id: 'asc' }, take: 1 }))[0];
                if (next) {
                    await db.update('booking', next.id, { status: 'REQUESTED', updatedAt: this.now() });
                    await this.notify(db, next.riderId, 'Seat reopened', 'Your waitlist entry is now a request awaiting driver approval.', r.id);
                    await this.notify(db, r.driverId, 'Review promoted request', 'A seat reopened; the earliest waitlisted rider awaits approval.', r.id);
                }
            }
            return updated;
        });
    }
    async cancelRide(userId: string, rideId: string) { return this.store.transaction(async (db) => { const u = await this.actor(db, userId), r = await this.required(db, 'ride', rideId); ensure(r.driverId === u.id || u.role === 'ADMIN', 403, 'FORBIDDEN', 'Only the driver or a moderator can cancel this ride.'); if (r.status === 'CANCELLED')
        return r; ensure(r.status === 'OPEN' && (u.role === 'ADMIN' || r.departureAt > this.now()), 409, 'INVALID_STATE', 'This ride cannot be cancelled.'); const updated = await db.update('ride', r.id, { status: 'CANCELLED', seatsUsed: 0 }); for (const b of await db.list('booking', { where: { rideId, status: { in: activeBooking } }, take: 100 })) {
        await db.update('booking', b.id, { status: 'CANCELLED', updatedAt: this.now() });
        await this.notify(db, b.riderId, 'Ride cancelled', 'The ride has been cancelled. Your request is closed.', r.id);
    } await this.audit(db, u.id, 'RIDE_CANCELLED', r.id); return updated; }); }
    async completeRide(userId: string, rideId: string) { return this.store.transaction(async (db) => { await this.actor(db, userId); const r = await this.required(db, 'ride', rideId); ensure(r.driverId === userId, 403, 'FORBIDDEN', 'Only the driver can complete this ride.'); ensure(r.status === 'OPEN' && r.arrivalAt <= this.now(), 409, 'INVALID_STATE', 'A ride can be completed only after its scheduled arrival.'); for (const b of await db.list('booking', { where: { rideId, status: { in: ['REQUESTED', 'WAITLISTED'] } }, take: 100 }))
        await db.update('booking', b.id, { status: 'DECLINED', updatedAt: this.now() }); await this.audit(db, userId, 'RIDE_COMPLETED', r.id); return db.update('ride', r.id, { status: 'COMPLETED' }); }); }
    async threadPermission(db: Repository, userId: string, rideId: string) { const u = await this.actor(db, userId), r = await this.required(db, 'ride', rideId); ensure(r.campusId === u.campusId, 404, 'NOT_FOUND', 'Ride not found.'); const b = (await db.list('booking', { where: { rideId, riderId: userId, status: 'CONFIRMED' }, take: 1 }))[0]; ensure(r.driverId === userId || b, 403, 'FORBIDDEN', 'Only the driver and confirmed riders can access this trip thread.'); return r; }
    async messages(userId: string, rideId: string) { return this.store.read(async (db) => { await this.threadPermission(db, userId, rideId); const msgs = await db.list('message', { where: { rideId }, orderBy: { createdAt: 'desc', id: 'desc' }, take: 100 }); return Promise.all(msgs.reverse().map(async (m) => ({ ...m, author: (await this.required(db, 'user', m.userId)).name }))); }); }
    async sendMessage(userId: string, rideId: string, input: unknown) { const text = v.text(v.object(input).text, 'Message', 1, 1000); return this.store.transaction(async (db) => { const r = await this.threadPermission(db, userId, rideId); ensure(r.status === 'OPEN', 409, 'THREAD_CLOSED', 'This trip thread is read-only.'); return db.create('message', { id: id(), rideId, userId, text, createdAt: this.now() }); }); }
    async notifications(userId: string) { return this.store.read(db => db.list('notification', { where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 })); }
    async readNotification(userId: string, key: string) { return this.store.transaction(async (db) => { const n = await this.required(db, 'notification', key); ensure(n.userId === userId, 404, 'NOT_FOUND', 'Notification not found.'); return db.update('notification', key, { readAt: this.now() }); }); }
    async report(userId: string, rideId: string, input: unknown) { const reason = v.text(v.object(input).reason, 'Report', 10, 1000); return this.store.transaction(async (db) => { const u = await this.actor(db, userId), r = await this.required(db, 'ride', rideId); ensure(r.campusId === u.campusId, 404, 'NOT_FOUND', 'Ride not found.'); ensure(!(await db.list('report', { where: { reporterId: userId, rideId, status: 'OPEN' }, take: 1 })).length, 409, 'ALREADY_REPORTED', 'You already have an open report for this ride.'); const report = await db.create('report', { id: id(), reporterId: userId, rideId, reason, status: 'OPEN', resolution: null, createdAt: this.now(), resolvedAt: null }); await this.audit(db, userId, 'REPORT_CREATED', report.id); return report; }); }
    async adminReports(userId: string) { return this.store.read(async (db) => { const u = await this.actor(db, userId); ensure(u.role === 'ADMIN', 403, 'FORBIDDEN', 'Moderator access required.'); return db.list('report', { orderBy: { createdAt: 'desc' }, take: 100 }); }); }
    async resolveReport(userId: string, key: string, input: unknown) { const resolution = v.text(v.object(input).resolution, 'Resolution', 5, 1000); return this.store.transaction(async (db) => { const u = await this.actor(db, userId); ensure(u.role === 'ADMIN', 403, 'FORBIDDEN', 'Moderator access required.'); const r = await this.required(db, 'report', key); await this.audit(db, userId, 'REPORT_RESOLVED', key); await this.notify(db, r.reporterId, 'Report reviewed', 'A moderator has reviewed your report. Thank you for helping keep the community accountable.', r.rideId); return db.update('report', key, { status: 'RESOLVED', resolution, resolvedAt: this.now() }); }); }
    async reviews(userId: string, rideId: string) { await this.ride(userId, rideId); return this.store.read(db => db.list('review', { where: { rideId }, orderBy: { createdAt: 'desc' }, take: 50 })); }
    async review(userId: string, rideId: string, input: unknown) { const b = v.object(input), rating = v.integer(b.rating, 'Rating', 1, 5), comment = v.text(b.comment ?? '', 'Comment', 0, 500); return this.store.transaction(async (db) => { await this.actor(db, userId); const r = await this.required(db, 'ride', rideId); ensure(r.status === 'COMPLETED' && r.driverId !== userId, 409, 'INVALID_STATE', 'Only completed trips can be reviewed by riders.'); ensure((await db.list('booking', { where: { rideId, riderId: userId, status: 'CONFIRMED' }, take: 1 })).length, 403, 'FORBIDDEN', 'Only confirmed riders can review this trip.'); return db.create('review', { id: id(), rideId, reviewerId: userId, rating, comment, createdAt: this.now() }); }); }
    async calendar(userId: string, rideId: string) { return this.store.read(async (db) => { const r = await this.threadPermission(db, userId, rideId); ensure(r.status !== 'CANCELLED', 409, 'RIDE_CLOSED', 'This ride was cancelled.'); const origin = await this.required(db, 'hub', r.originHubId), dest = await this.required(db, 'hub', r.destinationHubId); const stamp = (s: string) => s.replace(/[-:]/g, '').replace(/\.\d{3}/, ''); const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r/g, ''); return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CampusLoop//Trips//EN', 'BEGIN:VEVENT', `UID:${r.id}@campusloop.local`, `DTSTAMP:${stamp(this.now())}`, `DTSTART:${stamp(r.departureAt)}`, `DTEND:${stamp(r.arrivalAt)}`, `SUMMARY:${escape('CampusLoop ride to ' + dest.name)}`, `LOCATION:${escape(origin.name)}`, 'DESCRIPTION:Driver-scheduled carpool. Check CampusLoop for cancellations.', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n'); }); }
    /** Called only by the trusted mail worker, never exposed through HTTP. */
    async claimMail(): Promise<Outbox | null> { return this.store.transaction(async (db) => { const stale = new Date(this.clock.now().getTime() - 300000).toISOString(); const m = (await db.list('outbox', { where: { sentAt: null, attempts: { lt: 5 }, availableAt: { lte: this.now() }, OR: [{ claimedAt: null }, { claimedAt: { lt: stale } }] }, orderBy: { createdAt: 'asc' }, take: 1 }))[0]; return m ? db.update('outbox', m.id, { claimedAt: this.now(), attempts: m.attempts + 1 }) : null; }); }
    async finishMail(key: string, success: boolean) { await this.store.transaction(async (db) => { const m = await db.get('outbox', key); if (!m)
        return; if (success)
        await db.update('outbox', key, { sentAt: this.now(), claimedAt: null, body: '[delivered; content removed]', to: '' });
    else
        await db.update('outbox', key, { claimedAt: null, availableAt: new Date(this.clock.now().getTime() + Math.min(3600000, 30000 * 2 ** m.attempts)).toISOString() }); }); }
}
