export class AppError extends Error {
    constructor(public readonly status: number, public readonly code: string, message: string) { super(message); this.name = 'AppError'; }
}
export function fail(status: number, code: string, message: string): never { throw new AppError(status, code, message); }
export function ensure(condition: unknown, status: number, code: string, message: string): asserts condition { if (!condition)
    fail(status, code, message); }
