import { ensure } from './errors';
export function object(value: unknown): Record<string, unknown> {
    ensure(value !== null && typeof value === 'object' && !Array.isArray(value), 400, 'INVALID_INPUT', 'Expected a JSON object.');
    return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, min = 1, max = 120): string {
    ensure(typeof value === 'string', 400, 'INVALID_INPUT', `${label} must be text.`);
    const v = value.trim();
    ensure(v.length >= min && v.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v), 400, 'INVALID_INPUT', `${label} must contain ${min}–${max} characters.`);
    return v;
}
export function integer(value: unknown, label: string, min: number, max: number): number {
    ensure(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max, 400, 'INVALID_INPUT', `${label} must be an integer between ${min} and ${max}.`);
    return value;
}
export function bool(value: unknown, defaultValue = false): boolean {
    if (value === undefined)
        return defaultValue;
    ensure(typeof value === 'boolean', 400, 'INVALID_INPUT', 'Expected true or false.');
    return value;
}
export function oneOf<T extends string>(value: unknown, values: readonly T[]): T {
    ensure(typeof value === 'string' && values.includes(value as T), 400, 'INVALID_INPUT', `Expected ${values.join(', ')}.`);
    return value as T;
}
export function email(value: unknown): string {
    const v = text(value, 'Email', 3, 254).toLowerCase();
    ensure(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v), 400, 'INVALID_INPUT', 'Enter a valid email address.');
    return v;
}
export function password(value: unknown): string {
    ensure(typeof value === 'string' && value.length >= 12 && value.length <= 128, 400, 'INVALID_INPUT', 'Password must contain 12–128 characters.');
    return value;
}
export function dateOnly(value: unknown): string {
    const v = text(value, 'Date', 10, 10);
    const d = new Date(`${v}T00:00:00.000Z`);
    ensure(/^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v, 400, 'INVALID_INPUT', 'Date must be a valid YYYY-MM-DD date.');
    return v;
}
export function minute(value: unknown): number {
    const v = text(value, 'Time', 5, 5);
    ensure(/^([01]\d|2[0-3]):[0-5]\d$/.test(v), 400, 'INVALID_INPUT', 'Time must use 24-hour HH:mm format.');
    const [h, m] = v.split(':').map(Number);
    return h! * 60 + m!;
}
export function hhmm(value: number): string { return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`; }
