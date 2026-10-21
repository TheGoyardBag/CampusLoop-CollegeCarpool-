import { ensure } from './errors';
import { dateOnly, minute } from './validate';
const formatters = new Map<string, Intl.DateTimeFormat>();
export function localParts(iso: string | Date, timezone: string) {
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
export function zonedInstant(date: string, time: string, timezone: string): string {
    dateOnly(date);
    const m = minute(time);
    const nominal = Date.parse(`${date}T${time}:00Z`);
    const candidates: string[] = [];
    // IANA offsets in supported campus zones are multiples of 15 minutes.
    for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
        const candidate = new Date(nominal - offset * 60000);
        const p = localParts(candidate, timezone);
        if (p.date === date && p.minute === m)
            candidates.push(candidate.toISOString());
    }
    ensure(candidates.length === 1, 400, 'AMBIGUOUS_TIME', candidates.length ? 'This local time occurs twice due to daylight saving time. Choose another time.' : 'This local time does not exist due to daylight saving time. Choose another time.');
    return candidates[0]!;
}
export function weekday(date: string): number { const d = new Date(`${dateOnly(date)}T12:00:00Z`).getUTCDay(); return d === 0 ? 7 : d; }
export function addDays(date: string, days: number): string { const d = new Date(`${dateOnly(date)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function overlaps(a: number, b: number, c: number, d: number): boolean { return a < d && c < b; }
export function durationMinutes(a: string, b: string): number { return (Date.parse(b) - Date.parse(a)) / 60000; }
export function datesBetween(from: string, to: string, days: number[]): string[] {
    dateOnly(from);
    dateOnly(to);
    const diff = (Date.parse(to) - Date.parse(from)) / 86400000;
    ensure(diff >= 0 && diff <= 27, 400, 'INVALID_RANGE', 'A recurring offer can cover at most 28 days.');
    return Array.from({ length: diff + 1 }, (_, i) => addDays(from, i)).filter(d => days.includes(weekday(d)));
}
