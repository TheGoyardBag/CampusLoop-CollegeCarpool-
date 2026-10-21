import type { ApiRequest, ApiResponse } from './types';
import { CarpoolService } from './service';
import { AppError, ensure } from './errors';
import { id } from './crypto';
import { localParts, addDays, weekday } from './time';
export const cookieName = (secure: boolean) => secure ? '__Host-campusloop' : 'campusloop_session';
export function readCookie(header: string | undefined, name: string): string | undefined {
    const item = header?.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
    if (!item)
        return undefined;
    try {
        return decodeURIComponent(item.slice(name.length + 1));
    }
    catch {
        return undefined;
    }
}
export class ApiRouter {
    private secure: boolean;
    constructor(public readonly service: CarpoolService) { this.secure = new URL(service.config.origin).protocol === 'https:'; }
    async handle(req: ApiRequest): Promise<ApiResponse> {
        const requestId = id();
        const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Request-Id': requestId, 'Referrer-Policy': 'no-referrer' };
        try {
            const method = req.method.toUpperCase(), url = new URL(req.path, 'http://localhost'), p = url.pathname.replace(/\/$/, '');
            ensure(p.startsWith('/api/'), 404, 'NOT_FOUND', 'Endpoint not found.');
            if (method !== 'GET' && method !== 'HEAD') {
                ensure(req.headers.origin === this.service.config.origin && req.headers['x-campusloop-client'] === 'web', 403, 'CSRF', 'This action must originate from the configured application.');
                ensure((req.headers['content-type'] ?? '').startsWith('application/json'), 415, 'CONTENT_TYPE', 'Use application/json.');
            }
            const cookie = readCookie(req.headers.cookie, cookieName(this.secure));
            let body: unknown, status = 200;
            if (p === '/api/health' && method === 'GET') {
                await this.service.store.read(db => db.list('campus', { take: 1 }));
                body = { status: 'ok', mode: this.service.config.demo ? 'DEMO' : 'APPLICATION' };
            }
            else if (p === '/api/catalog' && method === 'GET')
                body = await this.service.catalog();
            else if (p.startsWith('/api/auth/') && method === 'POST') {
                await this.service.rateLimit(`auth:${req.ip}`, 30, 900000);
                switch (p) {
                    case '/api/auth/register':
                        body = await this.service.register(req.body);
                        status = 202;
                        break;
                    case '/api/auth/verify':
                        body = await this.service.verifyEmail(req.body);
                        break;
                    case '/api/auth/login': {
                        const result = await this.service.login(req.body);
                        headers['Set-Cookie'] = `${cookieName(this.secure)}=${result.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor((Date.parse(result.expiresAt) - this.service.clock.now().getTime()) / 1000)}${this.secure ? '; Secure' : ''}`;
                        body = { user: result.user };
                        break;
                    }
                    case '/api/auth/logout':
                        body = await this.service.logout(cookie ?? '');
                        headers['Set-Cookie'] = `${cookieName(this.secure)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${this.secure ? '; Secure' : ''}`;
                        break;
                    case '/api/auth/request-reset':
                        body = await this.service.requestReset(req.body);
                        status = 202;
                        break;
                    case '/api/auth/reset':
                        body = await this.service.resetPassword(req.body);
                        break;
                    default: throw new AppError(404, 'NOT_FOUND', 'Endpoint not found.');
                }
            }
            else {
                const user = await this.service.authenticate(cookie);
                await this.service.rateLimit(`user:${user.id}`, 240);
                const segments = p.split('/').filter(Boolean).map(decodeURIComponent);
                const key = segments[2] ?? '';
                if (p === '/api/me' && method === 'GET')
                    body = await this.service.me(user.id);
                else if (p === '/api/me' && method === 'PATCH')
                    body = await this.service.profile(user.id, req.body);
                else if (p === '/api/summary' && method === 'GET') {
                    const [mine, bookings, notifications, courses, me] = await Promise.all([this.service.myRides(user.id), this.service.myBookings(user.id), this.service.notifications(user.id), this.service.courses(user.id), this.service.me(user.id)]);
                    let suggestedDate = localParts(this.service.clock.now(), me.campus.timezone).date;
                    if (localParts(this.service.clock.now(), me.campus.timezone).minute > 7 * 60)
                        suggestedDate = addDays(suggestedDate, 1);
                    while (weekday(suggestedDate) > 5)
                        suggestedDate = addDays(suggestedDate, 1);
                    body = { suggestedDate, upcomingConfirmed: bookings.filter(b => b.status === 'CONFIRMED' && b.ride.arrivalAt > this.service.now()).length, upcomingOffers: mine.filter(r => r.status === 'OPEN' && r.arrivalAt > this.service.now()).length, unread: notifications.filter(n => !n.readAt).length, weeklyClasses: courses.length };
                }
                else if (p === '/api/courses' && method === 'GET')
                    body = await this.service.courses(user.id);
                else if (p === '/api/courses' && method === 'POST') {
                    body = await this.service.addCourse(user.id, req.body);
                    status = 201;
                }
                else if (segments[1] === 'courses' && segments.length === 3 && method === 'DELETE')
                    body = await this.service.removeCourse(user.id, key);
                else if (p === '/api/vehicles' && method === 'GET')
                    body = await this.service.vehicles(user.id);
                else if (p === '/api/vehicles' && method === 'POST') {
                    body = await this.service.addVehicle(user.id, req.body);
                    status = 201;
                }
                else if (p === '/api/matches' && method === 'GET') {
                    const q: Record<string, unknown> = Object.fromEntries(url.searchParams);
                    for (const k of ['bufferMinutes', 'maxWalkMeters', 'maxCostCents'])
                        if (q[k] !== undefined)
                            q[k] = Number(q[k]);
                    for (const k of ['accessible', 'quiet', 'includeWaitlist'])
                        if (q[k] !== undefined) {
                            ensure(q[k] === 'true' || q[k] === 'false', 400, 'INVALID_INPUT', 'Boolean query values must be true or false.');
                            q[k] = q[k] === 'true';
                        }
                    body = await this.service.matches(user.id, q);
                }
                else if (p === '/api/rides' && method === 'POST') {
                    body = await this.service.offer(user.id, req.body);
                    status = 201;
                }
                else if (p === '/api/rides/mine' && method === 'GET')
                    body = await this.service.myRides(user.id);
                else if (p === '/api/bookings' && method === 'GET')
                    body = await this.service.myBookings(user.id);
                else if (p === '/api/driver/requests' && method === 'GET')
                    body = await this.service.driverRequests(user.id);
                else if (segments[1] === 'rides' && segments.length >= 3) {
                    const action = segments[3];
                    if (segments.length === 3 && method === 'GET')
                        body = await this.service.ride(user.id, key);
                    else if (action === 'bookings' && method === 'POST') {
                        body = await this.service.requestSeat(user.id, key, req.body, req.headers['idempotency-key'] ?? '');
                        status = 201;
                    }
                    else if (action === 'cancel' && method === 'POST')
                        body = await this.service.cancelRide(user.id, key);
                    else if (action === 'complete' && method === 'POST')
                        body = await this.service.completeRide(user.id, key);
                    else if (action === 'messages' && method === 'GET')
                        body = await this.service.messages(user.id, key);
                    else if (action === 'messages' && method === 'POST') {
                        body = await this.service.sendMessage(user.id, key, req.body);
                        status = 201;
                    }
                    else if (action === 'report' && method === 'POST') {
                        body = await this.service.report(user.id, key, req.body);
                        status = 201;
                    }
                    else if (action === 'reviews' && method === 'GET')
                        body = await this.service.reviews(user.id, key);
                    else if (action === 'reviews' && method === 'POST') {
                        body = await this.service.review(user.id, key, req.body);
                        status = 201;
                    }
                    else if (action === 'calendar.ics' && method === 'GET') {
                        body = await this.service.calendar(user.id, key);
                        headers['Content-Type'] = 'text/calendar; charset=utf-8';
                        headers['Content-Disposition'] = 'attachment; filename="campusloop-trip.ics"';
                    }
                    else
                        throw new AppError(404, 'NOT_FOUND', 'Endpoint not found.');
                }
                else if (segments[1] === 'bookings' && segments.length === 4 && method === 'POST' && ['approve', 'decline', 'cancel'].includes(segments[3]!))
                    body = await this.service.actOnBooking(user.id, key, segments[3] as 'approve' | 'decline' | 'cancel');
                else if (p === '/api/notifications' && method === 'GET')
                    body = await this.service.notifications(user.id);
                else if (segments[1] === 'notifications' && segments[3] === 'read' && method === 'POST')
                    body = await this.service.readNotification(user.id, key);
                else if (p === '/api/admin/reports' && method === 'GET')
                    body = await this.service.adminReports(user.id);
                else if (segments[1] === 'admin' && segments[2] === 'reports' && segments[4] === 'resolve' && method === 'POST')
                    body = await this.service.resolveReport(user.id, segments[3]!, req.body);
                else
                    throw new AppError(404, 'NOT_FOUND', 'Endpoint not found.');
            }
            return { status, headers, body };
        }
        catch (error) {
            const e = error instanceof AppError ? error : new AppError(500, 'INTERNAL_ERROR', 'The request could not be completed.');
            if (e.status === 429)
                headers['Retry-After'] = '60';
            return { status: e.status, headers, body: { error: { code: e.code, message: e.message, requestId } } };
        }
    }
}
