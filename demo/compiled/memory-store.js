"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStore = exports.tableNames = void 0;
exports.emptySnapshot = emptySnapshot;
exports.matches = matches;
const errors_1 = require("./errors");
exports.tableNames = ['campus', 'hub', 'user', 'session', 'actionToken', 'course', 'vehicle', 'ride', 'booking', 'message', 'notification', 'report', 'audit', 'outbox', 'idempotency', 'rateBucket', 'review'];
function emptySnapshot() { return Object.fromEntries(exports.tableNames.map(t => [t, []])); }
function matches(row, where = {}) {
    const r = row;
    return Object.entries(where).every(([k, v]) => {
        if (v === undefined)
            return true;
        if (k === 'OR')
            return v.some(x => matches(row, x));
        if (k === 'AND')
            return v.every(x => matches(row, x));
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            const c = v;
            const actual = r[k];
            if (actual === undefined)
                return false;
            return (c.in === undefined || c.in.includes(actual)) && (c.not === undefined || actual !== c.not) &&
                (c.lt === undefined || (actual !== null && c.lt !== null && actual < c.lt)) && (c.lte === undefined || (actual !== null && c.lte !== null && actual <= c.lte)) &&
                (c.gt === undefined || (actual !== null && c.gt !== null && actual > c.gt)) && (c.gte === undefined || (actual !== null && c.gte !== null && actual >= c.gte));
        }
        return r[k] === v;
    });
}
const unique = { user: [['email']], session: [['tokenHash']], actionToken: [['tokenHash']], booking: [['rideId', 'riderId']], idempotency: [['userId', 'key']], review: [['rideId', 'reviewerId']] };
class MemoryRepository {
    data;
    constructor(data) {
        this.data = data;
    }
    async get(table, key) { return structuredClone(this.data[table].find(x => x.id === key) ?? null); }
    async list(table, q = {}) {
        let rows = this.data[table].filter(x => matches(x, q.where));
        if (q.orderBy)
            rows.sort((a, b) => {
                for (const [k, direction] of Object.entries(q.orderBy)) {
                    const x = a[k], y = b[k];
                    if (x !== y)
                        return (x < y ? -1 : 1) * (direction === 'asc' ? 1 : -1);
                }
                return 0;
            });
        return structuredClone(rows.slice(0, q.take ?? 200));
    }
    async create(table, row) {
        const rows = this.data[table];
        if (rows.some(x => x.id === row.id) || unique[table]?.some(keys => rows.some(x => keys.every(k => x[k] === row[k]))))
            throw new errors_1.AppError(409, 'CONFLICT', 'The record already exists.');
        rows.push(structuredClone(row));
        return structuredClone(row);
    }
    async update(table, key, change) {
        const rows = this.data[table];
        const i = rows.findIndex(x => x.id === key);
        if (i < 0)
            throw new errors_1.AppError(404, 'NOT_FOUND', 'Record not found.');
        const next = { ...rows[i], ...change, id: key };
        if (unique[table]?.some(keys => rows.some((x, j) => j !== i && keys.every(k => x[k] === next[k]))))
            throw new errors_1.AppError(409, 'CONFLICT', 'The record already exists.');
        rows[i] = next;
        return structuredClone(next);
    }
    async remove(table, key) {
        const rows = this.data[table];
        const i = rows.findIndex(x => x.id === key);
        if (i >= 0)
            rows.splice(i, 1);
    }
}
/** Serialized, process-local test/demo adapter. NOT a substitute for PostgreSQL. */
class MemoryStore {
    persist;
    data;
    tail = Promise.resolve();
    constructor(initial = emptySnapshot(), persist) {
        this.persist = persist;
        this.data = structuredClone(initial);
    }
    async read(fn) { await this.tail; return fn(new MemoryRepository(structuredClone(this.data))); }
    async transaction(fn) {
        const before = this.tail;
        let release;
        this.tail = new Promise(r => release = r);
        await before;
        const copy = structuredClone(this.data);
        try {
            const result = await fn(new MemoryRepository(copy));
            if (this.persist)
                await this.persist(copy);
            this.data = copy;
            return result;
        }
        finally {
            release();
        }
    }
    async snapshot() { await this.tail; return structuredClone(this.data); }
}
exports.MemoryStore = MemoryStore;
