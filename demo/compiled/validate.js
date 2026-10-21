"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.object = object;
exports.text = text;
exports.integer = integer;
exports.bool = bool;
exports.oneOf = oneOf;
exports.email = email;
exports.password = password;
exports.dateOnly = dateOnly;
exports.minute = minute;
exports.hhmm = hhmm;
const errors_1 = require("./errors");
function object(value) {
    (0, errors_1.ensure)(value !== null && typeof value === 'object' && !Array.isArray(value), 400, 'INVALID_INPUT', 'Expected a JSON object.');
    return value;
}
function text(value, label, min = 1, max = 120) {
    (0, errors_1.ensure)(typeof value === 'string', 400, 'INVALID_INPUT', `${label} must be text.`);
    const v = value.trim();
    (0, errors_1.ensure)(v.length >= min && v.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v), 400, 'INVALID_INPUT', `${label} must contain ${min}–${max} characters.`);
    return v;
}
function integer(value, label, min, max) {
    (0, errors_1.ensure)(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max, 400, 'INVALID_INPUT', `${label} must be an integer between ${min} and ${max}.`);
    return value;
}
function bool(value, defaultValue = false) {
    if (value === undefined)
        return defaultValue;
    (0, errors_1.ensure)(typeof value === 'boolean', 400, 'INVALID_INPUT', 'Expected true or false.');
    return value;
}
function oneOf(value, values) {
    (0, errors_1.ensure)(typeof value === 'string' && values.includes(value), 400, 'INVALID_INPUT', `Expected ${values.join(', ')}.`);
    return value;
}
function email(value) {
    const v = text(value, 'Email', 3, 254).toLowerCase();
    (0, errors_1.ensure)(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v), 400, 'INVALID_INPUT', 'Enter a valid email address.');
    return v;
}
function password(value) {
    (0, errors_1.ensure)(typeof value === 'string' && value.length >= 12 && value.length <= 128, 400, 'INVALID_INPUT', 'Password must contain 12–128 characters.');
    return value;
}
function dateOnly(value) {
    const v = text(value, 'Date', 10, 10);
    const d = new Date(`${v}T00:00:00.000Z`);
    (0, errors_1.ensure)(/^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v, 400, 'INVALID_INPUT', 'Date must be a valid YYYY-MM-DD date.');
    return v;
}
function minute(value) {
    const v = text(value, 'Time', 5, 5);
    (0, errors_1.ensure)(/^([01]\d|2[0-3]):[0-5]\d$/.test(v), 400, 'INVALID_INPUT', 'Time must use 24-hour HH:mm format.');
    const [h, m] = v.split(':').map(Number);
    return h * 60 + m;
}
function hhmm(value) { return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`; }
