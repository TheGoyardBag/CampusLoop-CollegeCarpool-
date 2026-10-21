"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.fail = fail;
exports.ensure = ensure;
class AppError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
function fail(status, code, message) { throw new AppError(status, code, message); }
function ensure(condition, status, code, message) {
    if (!condition)
        fail(status, code, message);
}
