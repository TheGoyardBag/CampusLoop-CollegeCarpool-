"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localParts = localParts;
exports.zonedInstant = zonedInstant;
exports.weekday = weekday;
exports.addDays = addDays;
exports.overlaps = overlaps;
exports.durationMinutes = durationMinutes;
exports.datesBetween = datesBetween;
const errors_1 = require("./errors");
const validate_1 = require("./validate");
const formatters = new Map();
function localParts(iso, timezone) {
    let format = formatters.get(timezone);
    if (!format) {
        format = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
        formatters.set(timezone, format);
    }
    const entries = format.formatToParts(new Date(iso));
    const p = Object.fromEntries(entries.map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}
/** Reject gaps AND ambiguous fall-back minutes rather than silently moving a ride. */
function zonedInstant(date, time, timezone) {
    (0, validate_1.dateOnly)(date);
    const m = (0, validate_1.minute)(time);
    const nominal = Date.parse(`${date}T${time}:00Z`);
    const candidates = [];
    // IANA offsets in supported campus zones are multiples of 15 minutes.
    for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
        const candidate = new Date(nominal - offset * 60000);
        const p = localParts(candidate, timezone);
        if (p.date === date && p.minute === m)
            candidates.push(candidate.toISOString());
    }
    (0, errors_1.ensure)(candidates.length === 1, 400, 'AMBIGUOUS_TIME', candidates.length ? 'This local time occurs twice due to daylight saving time. Choose another time.' : 'This local time does not exist due to daylight saving time. Choose another time.');
    return candidates[0];
}
function weekday(date) { const d = new Date(`${(0, validate_1.dateOnly)(date)}T12:00:00Z`).getUTCDay(); return d === 0 ? 7 : d; }
function addDays(date, days) { const d = new Date(`${(0, validate_1.dateOnly)(date)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function overlaps(a, b, c, d) { return a < d && c < b; }
function durationMinutes(a, b) { return (Date.parse(b) - Date.parse(a)) / 60000; }
function datesBetween(from, to, days) {
    (0, validate_1.dateOnly)(from);
    (0, validate_1.dateOnly)(to);
    const diff = (Date.parse(to) - Date.parse(from)) / 86400000;
    (0, errors_1.ensure)(diff >= 0 && diff <= 27, 400, 'INVALID_RANGE', 'A recurring offer can cover at most 28 days.');
    return Array.from({ length: diff + 1 }, (_, i) => addDays(from, i)).filter(d => days.includes(weekday(d)));
}
