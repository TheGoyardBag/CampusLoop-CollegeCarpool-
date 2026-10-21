"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineKm = haversineKm;
exports.classWindow = classWindow;
exports.rankRides = rankRides;
const time_1 = require("./time");
function haversineKm(a, b) {
    const rad = (x) => x * Math.PI / 180;
    const dlat = rad(b.lat - a.lat), dlng = rad(b.lng - a.lng);
    const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
function classWindow(courses, date) {
    const cs = courses.filter(c => c.weekday === (0, time_1.weekday)(date) && c.termStart <= date && c.termEnd >= date);
    if (!cs.length)
        return null;
    return { first: Math.min(...cs.map(c => c.startMinute)), last: Math.max(...cs.map(c => c.endMinute)) };
}
/** Transparent heuristic, not ML or road-routing. Timing comes from driver schedules. */
function rankRides(rides, courses, options) {
    const window = classWindow(courses, options.date);
    const target = options.manualMinute ?? (options.direction === 'TO_CAMPUS' ? window?.first : window?.last);
    return rides.flatMap(ride => {
        if (ride.direction !== options.direction || ride.costCents > options.maxCostCents || ride.status !== 'OPEN')
            return [];
        if (!options.includeWaitlist && ride.availableSeats <= 0)
            return [];
        if (options.accessible && !ride.vehicle.accessible)
            return [];
        if (options.quiet && !ride.quiet)
            return [];
        const depart = (0, time_1.localParts)(ride.departureAt, options.timezone), arrive = (0, time_1.localParts)(ride.arrivalAt, options.timezone);
        if (depart.date !== options.date || arrive.date !== options.date)
            return [];
        const hub = options.direction === 'TO_CAMPUS' ? ride.origin : ride.destination;
        const distance = haversineKm(options.home, hub);
        if (distance > options.maxWalkKm)
            return [];
        const gap = target === undefined ? null : options.direction === 'TO_CAMPUS' ? target - arrive.minute : depart.minute - target;
        if (gap !== null && (gap < options.bufferMinutes || gap > 120))
            return [];
        const reasons = [`${distance.toFixed(1)} km straight-line from your selected hub`];
        if (gap !== null)
            reasons.push(options.direction === 'TO_CAMPUS' ? `Arrives ${gap} min before ${options.manualMinute === undefined ? 'your first class' : 'your target time'}` : `Leaves ${gap} min after ${options.manualMinute === undefined ? 'your last class' : 'your target time'}`);
        else
            reasons.push('No classes on this day; compare the listed ride times');
        if (ride.availableSeats === 0)
            reasons.push('Full ride: join the waitlist');
        const score = Math.max(0, Math.round(100 - distance * 12 - (gap === null ? 12 : Math.abs(gap - options.bufferMinutes) * .35) - ride.costCents / 200 - (ride.availableSeats === 0 ? 15 : 0)));
        return [{ ...ride, score, reasons, walkKm: Number(distance.toFixed(2)), scheduleGapMinutes: gap }];
    }).sort((a, b) => b.score - a.score || a.departureAt.localeCompare(b.departureAt) || a.id.localeCompare(b.id));
}
