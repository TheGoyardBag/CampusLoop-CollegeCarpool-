"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CarpoolService = exports.publicUser = exports.activeBooking = void 0;
const errors_1 = require("./errors");
const v = __importStar(require("./validate"));
const crypto_1 = require("./crypto");
const time_1 = require("./time");
const matching_1 = require("./matching");
exports.activeBooking = ['REQUESTED', 'WAITLISTED', 'CONFIRMED'];
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, campusId: u.campusId, homeHubId: u.homeHubId, role: u.role, emailVerified: !!u.emailVerifiedAt });
exports.publicUser = publicUser;
class CarpoolService {
    store;
    config;
    clock;
    constructor(store, config, clock = { now: () => new Date() }) {
        this.store = store;
        this.config = config;
        this.clock = clock;
    }
    now() { return this.clock.now().toISOString(); }
    async required(db, table, key) {
        const x = await db.get(table, key);
        (0, errors_1.ensure)(x, 404, 'NOT_FOUND', 'The requested record was not found.');
        return x;
    }
    async actor(db, userId) { const u = await this.required(db, 'user', userId); (0, errors_1.ensure)(!u.suspendedAt, 403, 'SUSPENDED', 'This account is suspended.'); (0, errors_1.ensure)(u.emailVerifiedAt, 403, 'VERIFY_EMAIL', 'Verify your campus email first.'); return u; }
    async audit(db, actorId, action, entityId, detail = '') { await db.create('audit', { id: (0, crypto_1.id)(), actorId, action, entityId, detail, createdAt: this.now() }); }
    async notify(db, userId, title, body, rideId = null) {
        await db.create('notification', { id: (0, crypto_1.id)(), userId, title, body, rideId, readAt: null, createdAt: this.now() });
        const u = await db.get('user', userId);
        if (u)
            await this.email(db, u, title, body);
    }
    async email(db, u, subject, body) { await db.create('outbox', { id: (0, crypto_1.id)(), userId: u.id, to: u.email, subject, body, attempts: 0, availableAt: this.now(), sentAt: null, claimedAt: null, createdAt: this.now() }); }
    async rateLimit(key, limit, windowMs = 60000) {
        const n = this.clock.now().getTime(), bucket = `${(0, crypto_1.digest)(key)}:${Math.floor(n / windowMs)}`;
        await this.store.transaction(async (db) => {
            const old = await db.get('rateBucket', bucket);
            (0, errors_1.ensure)(!old || old.count < limit, 429, 'RATE_LIMIT', 'Too many requests. Please try again shortly.');
            if (old)
                await db.update('rateBucket', bucket, { count: old.count + 1 });
            else
                await db.create('rateBucket', { id: bucket, count: 1, expiresAt: new Date((Math.floor(n / windowMs) + 1) * windowMs).toISOString() });
        });
    }
    async catalog() { return this.store.read(async (db) => ({ campuses: await db.list('campus', { take: 50 }), hubs: await db.list('hub', { take: 500 }), demo: this.config.demo })); }
    async register(input) {
        const b = v.object(input), email = v.email(b.email), name = v.text(b.name, 'Name', 2, 60), campusId = v.text(b.campusId, 'Campus'), pw = v.password(b.password);
        const hash = await (0, crypto_1.hashPassword)(pw), token = (0, crypto_1.randomToken)();
        await this.store.transaction(async (db) => {
            const campus = await this.required(db, 'campus', campusId);
            (0, errors_1.ensure)(email.split('@')[1] === campus.emailDomain, 400, 'CAMPUS_EMAIL', `Use an email at ${campus.emailDomain}.`);
            const existing = (await db.list('user', { where: { email }, take: 1 }))[0];
            if (existing)
                return;
            const user = { id: (0, crypto_1.id)(), email, passwordHash: hash, name, campusId, homeHubId: null, role: 'STUDENT', emailVerifiedAt: null, suspendedAt: null, createdAt: this.now() };
            await db.create('user', user);
            await db.create('actionToken', { id: (0, crypto_1.id)(), userId: user.id, tokenHash: (0, crypto_1.digest)(token), purpose: 'VERIFY_EMAIL', expiresAt: new Date(this.clock.now().getTime() + 3600000).toISOString(), usedAt: null });
            await this.email(db, user, 'Verify your CampusLoop email', `Use this one-time verification code within 60 minutes:\n${token}\nOpen ${this.config.origin}/ and choose Verify email. Never share this code.`);
            await this.audit(db, user.id, 'ACCOUNT_REGISTERED', user.id);
        });
        return { message: 'If this address can be registered, a verification email has been queued.' };
    }
    async verifyEmail(input) {
        const token = v.text(v.object(input).token, 'Token', 20, 200);
        await this.store.transaction(async (db) => { const t = (await db.list('actionToken', { where: { tokenHash: (0, crypto_1.digest)(token), purpose: 'VERIFY_EMAIL', usedAt: null, expiresAt: { gt: this.now() } }, take: 1 }))[0]; (0, errors_1.ensure)(t, 400, 'INVALID_TOKEN', 'The verification code is invalid or expired.'); await db.update('actionToken', t.id, { usedAt: this.now() }); await db.update('user', t.userId, { emailVerifiedAt: this.now() }); await this.audit(db, t.userId, 'EMAIL_VERIFIED', t.userId); });
        return { message: 'Email verified. You can now sign in.' };
    }
    async login(input) {
        const b = v.object(input), email = v.email(b.email), pw = v.password(b.password);
        await this.rateLimit(`login-email:${email}`, 10, 900000);
        const user = await this.store.read(async (db) => (await db.list('user', { where: { email }, take: 1 }))[0] ?? null);
        // Perform equal-cost scrypt even if the account does not exist.
        const encoded = user?.passwordHash ?? `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
        const valid = await (0, crypto_1.verifyPassword)(pw, encoded);
        (0, errors_1.ensure)(user && valid, 401, 'INVALID_LOGIN', 'Email or password is incorrect.');
        const token = (0, crypto_1.randomToken)();
        const expiresAt = new Date(this.clock.now().getTime() + (this.config.sessionDays ?? 7) * 86400000).toISOString();
        await this.store.transaction(async (db) => { await this.actor(db, user.id); await db.create('session', { id: (0, crypto_1.id)(), userId: user.id, tokenHash: (0, crypto_1.digest)(token), expiresAt, createdAt: this.now() }); await this.audit(db, user.id, 'SIGNED_IN', user.id); });
        return { token, expiresAt, user: (0, exports.publicUser)(user) };
    }
    async authenticate(raw) { (0, errors_1.ensure)(raw && raw.length <= 200, 401, 'UNAUTHENTICATED', 'Please sign in.'); return this.store.read(async (db) => { const s = (await db.list('session', { where: { tokenHash: (0, crypto_1.digest)(raw), expiresAt: { gt: this.now() } }, take: 1 }))[0]; (0, errors_1.ensure)(s, 401, 'UNAUTHENTICATED', 'Session expired. Please sign in.'); return this.actor(db, s.userId); }); }
    async logout(raw) {
        await this.store.transaction(async (db) => {
            for (const s of await db.list('session', { where: { tokenHash: (0, crypto_1.digest)(raw) } }))
                await db.remove('session', s.id);
        });
        return { message: 'Signed out.' };
    }
    async requestReset(input) {
        const email = v.email(v.object(input).email);
        await this.rateLimit(`reset-email:${email}`, 3, 3600000);
        const raw = (0, crypto_1.randomToken)();
        await this.store.transaction(async (db) => {
            const u = (await db.list('user', { where: { email }, take: 1 }))[0];
            if (!u || u.suspendedAt)
                return;
            for (const t of await db.list('actionToken', { where: { userId: u.id, purpose: 'RESET_PASSWORD', usedAt: null } }))
                await db.update('actionToken', t.id, { usedAt: this.now() });
            await db.create('actionToken', { id: (0, crypto_1.id)(), userId: u.id, tokenHash: (0, crypto_1.digest)(raw), purpose: 'RESET_PASSWORD', expiresAt: new Date(this.clock.now().getTime() + 1800000).toISOString(), usedAt: null });
            await this.email(db, u, 'Reset your CampusLoop password', `Your one-time reset code (30 minutes):\n${raw}\nOpen ${this.config.origin}/ and choose Reset password.`);
        });
        return { message: 'If the account exists, a password-reset email has been queued.' };
    }
    async resetPassword(input) {
        const b = v.object(input), raw = v.text(b.token, 'Token', 20, 200), hash = await (0, crypto_1.hashPassword)(v.password(b.password));
        await this.store.transaction(async (db) => {
            const t = (await db.list('actionToken', { where: { tokenHash: (0, crypto_1.digest)(raw), purpose: 'RESET_PASSWORD', usedAt: null, expiresAt: { gt: this.now() } }, take: 1 }))[0];
            (0, errors_1.ensure)(t, 400, 'INVALID_TOKEN', 'The reset code is invalid or expired.');
            await db.update('user', t.userId, { passwordHash: hash });
            await db.update('actionToken', t.id, { usedAt: this.now() });
            for (const s of await db.list('session', { where: { userId: t.userId }, take: 10000 }))
                await db.remove('session', s.id);
            await this.audit(db, t.userId, 'PASSWORD_RESET', t.userId);
        });
        return { message: 'Password changed. All existing sessions have been revoked.' };
    }
    async me(userId) { return this.store.read(async (db) => { const u = await this.actor(db, userId); return { user: (0, exports.publicUser)(u), campus: await this.required(db, 'campus', u.campusId), demo: this.config.demo }; }); }
    async profile(userId, input) {
        const b = v.object(input);
        return this.store.transaction(async (db) => {
            const u = await this.actor(db, userId);
            const name = b.name === undefined ? u.name : v.text(b.name, 'Name', 2, 60);
            const homeHubId = b.homeHubId === null ? null : b.homeHubId === undefined ? u.homeHubId : v.text(b.homeHubId, 'Home hub');
            if (homeHubId) {
                const h = await this.required(db, 'hub', homeHubId);
                (0, errors_1.ensure)(h.campusId === u.campusId && !h.isCampus, 400, 'INVALID_HUB', 'Choose a public pickup hub in your campus community.');
            }
            return (0, exports.publicUser)(await db.update('user', u.id, { name, homeHubId }));
        });
    }
    async courses(userId) { return this.store.read(async (db) => { await this.actor(db, userId); return db.list('course', { where: { userId }, orderBy: { weekday: 'asc', startMinute: 'asc' }, take: 100 }); }); }
    async addCourse(userId, input) {
        const b = v.object(input);
        const course = { id: (0, crypto_1.id)(), userId, name: v.text(b.name, 'Course name', 2, 80), weekday: v.integer(b.weekday, 'Weekday', 1, 7), startMinute: v.minute(b.start), endMinute: v.minute(b.end), termStart: v.dateOnly(b.termStart), termEnd: v.dateOnly(b.termEnd) };
        (0, errors_1.ensure)(course.endMinute > course.startMinute, 400, 'INVALID_TIME', 'Class must end after it starts.');
        (0, errors_1.ensure)(course.termEnd >= course.termStart && (Date.parse(course.termEnd) - Date.parse(course.termStart)) / 86400000 <= 370, 400, 'INVALID_RANGE', 'Use an ordered term of at most 370 days.');
        return this.store.transaction(async (db) => {
            const u = await this.actor(db, userId);
            const existing = await db.list('course', { where: { userId }, take: 101 });
            (0, errors_1.ensure)(existing.length < 100, 400, 'LIMIT', 'At most 100 weekly schedule entries.');
            (0, errors_1.ensure)(!existing.some(c => c.weekday === course.weekday && c.termStart <= course.termEnd && c.termEnd >= course.termStart && (0, time_1.overlaps)(c.startMinute, c.endMinute, course.startMinute, course.endMinute)), 409, 'CLASS_CONFLICT', 'This class overlaps another scheduled class.');
            const campus = await this.required(db, 'campus', u.campusId);
            const rides = await this.activeRides(db, userId);
            for (const r of rides)
                (0, errors_1.ensure)(!this.courseConflicts(course, r, campus.timezone), 409, 'RIDE_CONFLICT', 'This class overlaps a ride you are driving or have confirmed.');
            await this.audit(db, userId, 'COURSE_ADDED', course.id);
            return db.create('course', course);
        });
    }
    async removeCourse(userId, courseId) { return this.store.transaction(async (db) => { await this.actor(db, userId); const c = await this.required(db, 'course', courseId); (0, errors_1.ensure)(c.userId === userId, 404, 'NOT_FOUND', 'Course not found.'); await db.remove('course', c.id); return { deleted: true }; }); }
    async vehicles(userId) { return this.store.read(db => db.list('vehicle', { where: { userId }, take: 10 })); }
    async addVehicle(userId, input) { const b = v.object(input); return this.store.transaction(async (db) => { await this.actor(db, userId); (0, errors_1.ensure)((await db.list('vehicle', { where: { userId }, take: 11 })).length < 10, 400, 'LIMIT', 'At most ten vehicles.'); return db.create('vehicle', { id: (0, crypto_1.id)(), userId, label: v.text(b.label, 'Vehicle', 2, 80), color: v.text(b.color, 'Color', 2, 40), seats: v.integer(b.seats, 'Passenger seats', 1, 7), accessible: v.bool(b.accessible) }); }); }
    courseConflicts(c, r, timezone) { const p = (0, time_1.localParts)(r.departureAt, timezone), a = (0, time_1.localParts)(r.arrivalAt, timezone); return c.weekday === (0, time_1.weekday)(p.date) && c.termStart <= p.date && c.termEnd >= p.date && (0, time_1.overlaps)(c.startMinute, c.endMinute, p.minute, a.minute); }
    async activeRides(db, userId) {
        const driven = await db.list('ride', { where: { driverId: userId, status: 'OPEN', arrivalAt: { gt: this.now() } }, take: 500 });
        const bookings = await db.list('booking', { where: { riderId: userId, status: 'CONFIRMED' }, take: 500 });
        const joined = bookings.length ? await db.list('ride', { where: { id: { in: bookings.map(b => b.rideId) }, status: 'OPEN', arrivalAt: { gt: this.now() } }, take: 500 }) : [];
        return [...driven, ...joined];
    }
    async checkAvailability(db, user, ride) {
        const campus = await this.required(db, 'campus', user.campusId);
        const courses = await db.list('course', { where: { userId: user.id }, take: 100 });
        (0, errors_1.ensure)(!courses.some(c => this.courseConflicts(c, ride, campus.timezone)), 409, 'CLASS_CONFLICT', 'The ride overlaps a class on your schedule.');
        const active = await this.activeRides(db, user.id);
        (0, errors_1.ensure)(!active.some(r => r.id !== ride.id && (0, time_1.overlaps)(Date.parse(r.departureAt), Date.parse(r.arrivalAt), Date.parse(ride.departureAt), Date.parse(ride.arrivalAt))), 409, 'RIDE_CONFLICT', 'This ride overlaps another confirmed trip.');
    }
    async offer(userId, input) {
        const b = v.object(input), originHubId = v.text(b.originHubId, 'Origin'), destinationHubId = v.text(b.destinationHubId, 'Destination'), vehicleId = v.text(b.vehicleId, 'Vehicle'), direction = v.oneOf(b.direction, ['TO_CAMPUS', 'FROM_CAMPUS']), date = v.dateOnly(b.date), departure = v.text(b.departure, 'Departure', 5, 5), arrival = v.text(b.arrival, 'Arrival', 5, 5), capacity = v.integer(b.capacity, 'Seats', 1, 7), costCents = v.integer(b.costCents, 'Contribution', 0, 3000), quiet = v.bool(b.quiet);
        let dates = [date];
        const recurring = b.repeatUntil !== undefined;
        if (recurring) {
            (0, errors_1.ensure)(Array.isArray(b.weekdays) && b.weekdays.length > 0 && b.weekdays.length <= 7, 400, 'INVALID_INPUT', 'Select repeat weekdays.');
            const days = [...new Set(b.weekdays.map(x => v.integer(x, 'Weekday', 1, 7)))];
            dates = (0, time_1.datesBetween)(date, v.dateOnly(b.repeatUntil), days);
            (0, errors_1.ensure)(dates.length > 0, 400, 'INVALID_RANGE', 'No selected weekdays in this range.');
        }
        const seriesId = recurring ? (0, crypto_1.id)() : null;
        return this.store.transaction(async (db) => {
            const u = await this.actor(db, userId), campus = await this.required(db, 'campus', u.campusId), origin = await this.required(db, 'hub', originHubId), destination = await this.required(db, 'hub', destinationHubId), vehicle = await this.required(db, 'vehicle', vehicleId);
            (0, errors_1.ensure)(vehicle.userId === userId && capacity <= vehicle.seats, 400, 'VEHICLE', 'Choose your own vehicle with enough passenger seats.');
            (0, errors_1.ensure)(origin.campusId === u.campusId && destination.campusId === u.campusId && origin.id !== destination.id, 400, 'INVALID_ROUTE', 'Both hubs must belong to your campus.');
            (0, errors_1.ensure)(direction === 'TO_CAMPUS' ? !origin.isCampus && destination.isCampus : origin.isCampus && !destination.isCampus, 400, 'INVALID_ROUTE', 'One end must be campus and the other a neighborhood hub.');
            const open = await db.list('ride', { where: { driverId: userId, status: 'OPEN', departureAt: { gt: this.now() } }, take: 501 });
            (0, errors_1.ensure)(open.length + dates.length <= 100, 400, 'LIMIT', 'At most 100 upcoming offers per driver.');
            const result = [];
            for (const d of dates) {
                const departureAt = (0, time_1.zonedInstant)(d, departure, campus.timezone), arrivalAt = (0, time_1.zonedInstant)(d, arrival, campus.timezone);
                (0, errors_1.ensure)(departureAt > this.now() && Date.parse(departureAt) - this.clock.now().getTime() <= 90 * 86400000, 400, 'INVALID_DATE', 'Publish a future ride within 90 days.');
                (0, errors_1.ensure)((0, time_1.durationMinutes)(departureAt, arrivalAt) >= 5 && (0, time_1.durationMinutes)(departureAt, arrivalAt) <= 180, 400, 'INVALID_TIME', 'A ride must take 5–180 minutes within one local day.');
                const ride = { id: (0, crypto_1.id)(), campusId: u.campusId, driverId: userId, vehicleId, originHubId, destinationHubId, direction, departureAt, arrivalAt, capacity, seatsUsed: 0, costCents, quiet, status: 'OPEN', seriesId, createdAt: this.now() };
                await this.checkAvailability(db, u, ride);
                await db.create('ride', ride);
                await this.audit(db, u.id, 'RIDE_OFFERED', ride.id, seriesId ?? 'single');
                result.push(ride);
            }
            return result;
        });
    }
    async view(db, ride, userId) {
        const driver = await this.required(db, 'user', ride.driverId), vehicle = await this.required(db, 'vehicle', ride.vehicleId), mine = (await db.list('booking', { where: { rideId: ride.id, riderId: userId }, take: 1 }))[0] ?? null;
        const { userId: owner, ...car } = vehicle;
        return { ...ride, driver: { id: driver.id, name: driver.name }, origin: await this.required(db, 'hub', ride.originHubId), destination: await this.required(db, 'hub', ride.destinationHubId), vehicle: car, availableSeats: ride.capacity - ride.seatsUsed, myBooking: mine };
    }
    async matches(userId, query) {
        return this.store.read(async (db) => {
            const u = await this.actor(db, userId), campus = await this.required(db, 'campus', u.campusId);
            (0, errors_1.ensure)(u.homeHubId, 400, 'SET_HOME_HUB', 'Select your pickup hub in Profile first.');
            const home = await this.required(db, 'hub', u.homeHubId), date = v.dateOnly(query.date), direction = v.oneOf(query.direction ?? 'TO_CAMPUS', ['TO_CAMPUS', 'FROM_CAMPUS']);
            const courses = await db.list('course', { where: { userId }, take: 100 });
            const raw = await db.list('ride', { where: { campusId: u.campusId, status: 'OPEN', driverId: { not: userId }, departureAt: { gt: this.now(), gte: (0, time_1.zonedInstant)(date, '00:00', campus.timezone), lt: (0, time_1.zonedInstant)((0, time_1.addDays)(date, 1), '00:00', campus.timezone) } }, orderBy: { departureAt: 'asc' }, take: 201 });
            const views = [];
            for (const r of raw.slice(0, 200)) {
                const driver = await db.get('user', r.driverId);
                if (!driver || driver.suspendedAt)
                    continue;
                views.push(await this.view(db, r, userId));
            }
            const active = await this.activeRides(db, userId);
            const free = views.filter(r => !active.some(a => a.id !== r.id && (0, time_1.overlaps)(Date.parse(a.departureAt), Date.parse(a.arrivalAt), Date.parse(r.departureAt), Date.parse(r.arrivalAt))) && !courses.some(c => this.courseConflicts(c, r, campus.timezone)));
            const result = (0, matching_1.rankRides)(free, courses, { date, timezone: campus.timezone, home, direction, bufferMinutes: v.integer(query.bufferMinutes ?? 10, 'Buffer', 0, 60), maxWalkKm: v.integer(query.maxWalkMeters ?? 3000, 'Max distance', 0, 10000) / 1000, maxCostCents: v.integer(query.maxCostCents ?? 1500, 'Contribution', 0, 3000), accessible: v.bool(query.accessible), quiet: v.bool(query.quiet), includeWaitlist: v.bool(query.includeWaitlist, true), manualMinute: query.targetTime ? v.minute(query.targetTime) : undefined });
            return { rides: result, date, timezone: campus.timezone, hasSchedule: courses.some(c => c.weekday === (0, time_1.weekday)(date) && c.termStart <= date && c.termEnd >= date), limited: raw.length > 200 };
        });
    }
    async ride(userId, rideId) { return this.store.read(async (db) => { const u = await this.actor(db, userId), r = await this.required(db, 'ride', rideId); (0, errors_1.ensure)(r.campusId === u.campusId, 404, 'NOT_FOUND', 'Ride not found.'); return this.view(db, r, userId); }); }
    async myRides(userId) { return this.store.read(async (db) => { await this.actor(db, userId); const rides = await db.list('ride', { where: { driverId: userId }, orderBy: { departureAt: 'desc' }, take: 100 }); return Promise.all(rides.map(r => this.view(db, r, userId))); }); }
    async myBookings(userId) { return this.store.read(async (db) => { await this.actor(db, userId); const items = await db.list('booking', { where: { riderId: userId }, orderBy: { createdAt: 'desc' }, take: 100 }); return Promise.all(items.map(async (b) => ({ ...b, ride: await this.view(db, await this.required(db, 'ride', b.rideId), userId) }))); }); }
    async driverRequests(userId) {
        return this.store.read(async (db) => {
            await this.actor(db, userId);
            const rides = await db.list('ride', { where: { driverId: userId, status: 'OPEN', arrivalAt: { gt: this.now() } }, take: 100 });
            if (!rides.length)
                return [];
            const bookings = await db.list('booking', { where: { rideId: { in: rides.map(r => r.id) }, status: { in: exports.activeBooking } }, orderBy: { createdAt: 'asc' }, take: 200 });
            return Promise.all(bookings.map(async (b) => { const u = await this.required(db, 'user', b.riderId); return { ...b, rider: { id: u.id, name: u.name }, ride: rides.find(r => r.id === b.rideId) }; }));
        });
    }
    async requestSeat(userId, rideId, input, key) {
        const b = v.object(input), note = v.text(b.note ?? '', 'Note', 0, 240), waitlist = v.bool(b.waitlist, true);
        v.text(key, 'Idempotency key', 8, 100);
        const requestHash = (0, crypto_1.digest)(JSON.stringify({ rideId, note, waitlist }));
        return this.store.transaction(async (db) => {
            const u = await this.actor(db, userId);
            const previous = (await db.list('idempotency', { where: { userId, key }, take: 1 }))[0];
            if (previous && previous.expiresAt > this.now()) {
                (0, errors_1.ensure)(previous.requestHash === requestHash, 409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used with different input.');
                return this.required(db, 'booking', previous.bookingId);
            }
            if (previous)
                await db.remove('idempotency', previous.id);
            const r = await this.required(db, 'ride', rideId);
            (0, errors_1.ensure)(r.campusId === u.campusId, 404, 'NOT_FOUND', 'Ride not found.');
            (0, errors_1.ensure)(r.driverId !== userId, 400, 'OWN_RIDE', 'You cannot book your own ride.');
            await this.actor(db, r.driverId);
            (0, errors_1.ensure)(r.status === 'OPEN' && r.departureAt > this.now(), 409, 'RIDE_CLOSED', 'This ride is no longer accepting requests.');
            const existing = (await db.list('booking', { where: { rideId, riderId: userId }, take: 1 }))[0];
            (0, errors_1.ensure)(!existing, 409, 'ALREADY_REQUESTED', 'You already requested this ride. View it in My trips.');
            await this.checkAvailability(db, u, r);
            const pending = await db.list('booking', { where: { rideId, status: { in: ['REQUESTED', 'WAITLISTED'] } }, take: 41 });
            (0, errors_1.ensure)(pending.length < 40, 409, 'REQUEST_LIMIT', 'This ride has reached its request limit.');
            const full = r.seatsUsed >= r.capacity;
            (0, errors_1.ensure)(!full || waitlist, 409, 'RIDE_FULL', 'No seats available. You may join the waitlist.');
            const booking = { id: (0, crypto_1.id)(), rideId, riderId: userId, status: full ? 'WAITLISTED' : 'REQUESTED', note, createdAt: this.now(), updatedAt: this.now() };
            await db.create('booking', booking);
            await db.create('idempotency', { id: (0, crypto_1.id)(), userId, key, requestHash, bookingId: booking.id, expiresAt: new Date(this.clock.now().getTime() + 86400000).toISOString() });
            await this.notify(db, r.driverId, full ? 'New waitlist entry' : 'New seat request', `${u.name} requested a seat. Open CampusLoop to review.`, r.id);
            await this.audit(db, userId, 'SEAT_REQUESTED', booking.id, booking.status);
            return booking;
        });
    }
    async actOnBooking(userId, bookingId, action) {
        return this.store.transaction(async (db) => {
            const u = await this.actor(db, userId), b = await this.required(db, 'booking', bookingId), r = await this.required(db, 'ride', b.rideId);
            (0, errors_1.ensure)(action === 'cancel' ? b.riderId === u.id : r.driverId === u.id, 403, 'FORBIDDEN', 'You cannot change this booking.');
            if (action === 'cancel' && b.status === 'CANCELLED')
                return b;
            if (action === 'decline' && b.status === 'DECLINED')
                return b;
            if (action === 'approve' && b.status === 'CONFIRMED')
                return b;
            (0, errors_1.ensure)(r.status === 'OPEN' && r.departureAt > this.now(), 409, 'RIDE_CLOSED', 'Changes are closed after departure or cancellation.');
            (0, errors_1.ensure)(exports.activeBooking.includes(b.status), 409, 'INVALID_STATE', 'This request has already been closed.');
            const confirmed = b.status === 'CONFIRMED';
            if (action === 'approve') {
                (0, errors_1.ensure)(r.seatsUsed < r.capacity, 409, 'RIDE_FULL', 'All seats are already confirmed.');
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
    async cancelRide(userId, rideId) {
        return this.store.transaction(async (db) => {
            const u = await this.actor(db, userId), r = await this.required(db, 'ride', rideId);
            (0, errors_1.ensure)(r.driverId === u.id || u.role === 'ADMIN', 403, 'FORBIDDEN', 'Only the driver or a moderator can cancel this ride.');
            if (r.status === 'CANCELLED')
                return r;
            (0, errors_1.ensure)(r.status === 'OPEN' && (u.role === 'ADMIN' || r.departureAt > this.now()), 409, 'INVALID_STATE', 'This ride cannot be cancelled.');
            const updated = await db.update('ride', r.id, { status: 'CANCELLED', seatsUsed: 0 });
            for (const b of await db.list('booking', { where: { rideId, status: { in: exports.activeBooking } }, take: 100 })) {
                await db.update('booking', b.id, { status: 'CANCELLED', updatedAt: this.now() });
                await this.notify(db, b.riderId, 'Ride cancelled', 'The ride has been cancelled. Your request is closed.', r.id);
            }
            await this.audit(db, u.id, 'RIDE_CANCELLED', r.id);
            return updated;
        });
    }
    async completeRide(userId, rideId) {
        return this.store.transaction(async (db) => {
            await this.actor(db, userId);
            const r = await this.required(db, 'ride', rideId);
            (0, errors_1.ensure)(r.driverId === userId, 403, 'FORBIDDEN', 'Only the driver can complete this ride.');
            (0, errors_1.ensure)(r.status === 'OPEN' && r.arrivalAt <= this.now(), 409, 'INVALID_STATE', 'A ride can be completed only after its scheduled arrival.');
            for (const b of await db.list('booking', { where: { rideId, status: { in: ['REQUESTED', 'WAITLISTED'] } }, take: 100 }))
                await db.update('booking', b.id, { status: 'DECLINED', updatedAt: this.now() });
            await this.audit(db, userId, 'RIDE_COMPLETED', r.id);
            return db.update('ride', r.id, { status: 'COMPLETED' });
        });
    }
    async threadPermission(db, userId, rideId) { const u = await this.actor(db, userId), r = await this.required(db, 'ride', rideId); (0, errors_1.ensure)(r.campusId === u.campusId, 404, 'NOT_FOUND', 'Ride not found.'); const b = (await db.list('booking', { where: { rideId, riderId: userId, status: 'CONFIRMED' }, take: 1 }))[0]; (0, errors_1.ensure)(r.driverId === userId || b, 403, 'FORBIDDEN', 'Only the driver and confirmed riders can access this trip thread.'); return r; }
    async messages(userId, rideId) { return this.store.read(async (db) => { await this.threadPermission(db, userId, rideId); const msgs = await db.list('message', { where: { rideId }, orderBy: { createdAt: 'desc', id: 'desc' }, take: 100 }); return Promise.all(msgs.reverse().map(async (m) => ({ ...m, author: (await this.required(db, 'user', m.userId)).name }))); }); }
    async sendMessage(userId, rideId, input) { const text = v.text(v.object(input).text, 'Message', 1, 1000); return this.store.transaction(async (db) => { const r = await this.threadPermission(db, userId, rideId); (0, errors_1.ensure)(r.status === 'OPEN', 409, 'THREAD_CLOSED', 'This trip thread is read-only.'); return db.create('message', { id: (0, crypto_1.id)(), rideId, userId, text, createdAt: this.now() }); }); }
    async notifications(userId) { return this.store.read(db => db.list('notification', { where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 })); }
    async readNotification(userId, key) { return this.store.transaction(async (db) => { const n = await this.required(db, 'notification', key); (0, errors_1.ensure)(n.userId === userId, 404, 'NOT_FOUND', 'Notification not found.'); return db.update('notification', key, { readAt: this.now() }); }); }
    async report(userId, rideId, input) { const reason = v.text(v.object(input).reason, 'Report', 10, 1000); return this.store.transaction(async (db) => { const u = await this.actor(db, userId), r = await this.required(db, 'ride', rideId); (0, errors_1.ensure)(r.campusId === u.campusId, 404, 'NOT_FOUND', 'Ride not found.'); (0, errors_1.ensure)(!(await db.list('report', { where: { reporterId: userId, rideId, status: 'OPEN' }, take: 1 })).length, 409, 'ALREADY_REPORTED', 'You already have an open report for this ride.'); const report = await db.create('report', { id: (0, crypto_1.id)(), reporterId: userId, rideId, reason, status: 'OPEN', resolution: null, createdAt: this.now(), resolvedAt: null }); await this.audit(db, userId, 'REPORT_CREATED', report.id); return report; }); }
    async adminReports(userId) { return this.store.read(async (db) => { const u = await this.actor(db, userId); (0, errors_1.ensure)(u.role === 'ADMIN', 403, 'FORBIDDEN', 'Moderator access required.'); return db.list('report', { orderBy: { createdAt: 'desc' }, take: 100 }); }); }
    async resolveReport(userId, key, input) { const resolution = v.text(v.object(input).resolution, 'Resolution', 5, 1000); return this.store.transaction(async (db) => { const u = await this.actor(db, userId); (0, errors_1.ensure)(u.role === 'ADMIN', 403, 'FORBIDDEN', 'Moderator access required.'); const r = await this.required(db, 'report', key); await this.audit(db, userId, 'REPORT_RESOLVED', key); await this.notify(db, r.reporterId, 'Report reviewed', 'A moderator has reviewed your report. Thank you for helping keep the community accountable.', r.rideId); return db.update('report', key, { status: 'RESOLVED', resolution, resolvedAt: this.now() }); }); }
    async reviews(userId, rideId) { await this.ride(userId, rideId); return this.store.read(db => db.list('review', { where: { rideId }, orderBy: { createdAt: 'desc' }, take: 50 })); }
    async review(userId, rideId, input) { const b = v.object(input), rating = v.integer(b.rating, 'Rating', 1, 5), comment = v.text(b.comment ?? '', 'Comment', 0, 500); return this.store.transaction(async (db) => { await this.actor(db, userId); const r = await this.required(db, 'ride', rideId); (0, errors_1.ensure)(r.status === 'COMPLETED' && r.driverId !== userId, 409, 'INVALID_STATE', 'Only completed trips can be reviewed by riders.'); (0, errors_1.ensure)((await db.list('booking', { where: { rideId, riderId: userId, status: 'CONFIRMED' }, take: 1 })).length, 403, 'FORBIDDEN', 'Only confirmed riders can review this trip.'); return db.create('review', { id: (0, crypto_1.id)(), rideId, reviewerId: userId, rating, comment, createdAt: this.now() }); }); }
    async calendar(userId, rideId) { return this.store.read(async (db) => { const r = await this.threadPermission(db, userId, rideId); (0, errors_1.ensure)(r.status !== 'CANCELLED', 409, 'RIDE_CLOSED', 'This ride was cancelled.'); const origin = await this.required(db, 'hub', r.originHubId), dest = await this.required(db, 'hub', r.destinationHubId); const stamp = (s) => s.replace(/[-:]/g, '').replace(/\.\d{3}/, ''); const escape = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r/g, ''); return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CampusLoop//Trips//EN', 'BEGIN:VEVENT', `UID:${r.id}@campusloop.local`, `DTSTAMP:${stamp(this.now())}`, `DTSTART:${stamp(r.departureAt)}`, `DTEND:${stamp(r.arrivalAt)}`, `SUMMARY:${escape('CampusLoop ride to ' + dest.name)}`, `LOCATION:${escape(origin.name)}`, 'DESCRIPTION:Driver-scheduled carpool. Check CampusLoop for cancellations.', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n'); }); }
    /** Called only by the trusted mail worker, never exposed through HTTP. */
    async claimMail() { return this.store.transaction(async (db) => { const stale = new Date(this.clock.now().getTime() - 300000).toISOString(); const m = (await db.list('outbox', { where: { sentAt: null, attempts: { lt: 5 }, availableAt: { lte: this.now() }, OR: [{ claimedAt: null }, { claimedAt: { lt: stale } }] }, orderBy: { createdAt: 'asc' }, take: 1 }))[0]; return m ? db.update('outbox', m.id, { claimedAt: this.now(), attempts: m.attempts + 1 }) : null; }); }
    async finishMail(key, success) {
        await this.store.transaction(async (db) => {
            const m = await db.get('outbox', key);
            if (!m)
                return;
            if (success)
                await db.update('outbox', key, { sentAt: this.now(), claimedAt: null, body: '[delivered; content removed]', to: '' });
            else
                await db.update('outbox', key, { claimedAt: null, availableAt: new Date(this.clock.now().getTime() + Math.min(3600000, 30000 * 2 ** m.attempts)).toISOString() });
        });
    }
}
exports.CarpoolService = CarpoolService;
