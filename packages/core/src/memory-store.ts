import type { Repository, Store, Tables, Table, Query, Where, Comparison, Scalar } from './types';
import { AppError } from './errors';
export const tableNames: Table[] = ['campus', 'hub', 'user', 'session', 'actionToken', 'course', 'vehicle', 'ride', 'booking', 'message', 'notification', 'report', 'audit', 'outbox', 'idempotency', 'rateBucket', 'review'];
export type Snapshot = {
    [K in Table]: Tables[K][];
};
export function emptySnapshot(): Snapshot { return Object.fromEntries(tableNames.map(t => [t, []])) as unknown as Snapshot; }
export function matches(row: object, where: Where = {}): boolean {
    const r = row as Record<string, Scalar>;
    return Object.entries(where).every(([k, v]) => {
        if (v === undefined)
            return true;
        if (k === 'OR')
            return (v as Where[]).some(x => matches(row, x));
        if (k === 'AND')
            return (v as Where[]).every(x => matches(row, x));
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            const c = v as Comparison;
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
const unique: Partial<Record<Table, string[][]>> = { user: [['email']], session: [['tokenHash']], actionToken: [['tokenHash']], booking: [['rideId', 'riderId']], idempotency: [['userId', 'key']], review: [['rideId', 'reviewerId']] };
class MemoryRepository implements Repository {
    constructor(private data: Snapshot) { }
    async get<K extends Table>(table: K, key: string): Promise<Tables[K] | null> { return structuredClone(this.data[table].find(x => x.id === key) ?? null) as Tables[K] | null; }
    async list<K extends Table>(table: K, q: Query = {}): Promise<Tables[K][]> {
        let rows = (this.data[table] as Tables[K][]).filter(x => matches(x, q.where));
        if (q.orderBy)
            rows.sort((a, b) => { for (const [k, direction] of Object.entries(q.orderBy!)) {
                const x = (a as any)[k], y = (b as any)[k];
                if (x !== y)
                    return (x < y ? -1 : 1) * (direction === 'asc' ? 1 : -1);
            } return 0; });
        return structuredClone(rows.slice(0, q.take ?? 200));
    }
    async create<K extends Table>(table: K, row: Tables[K]): Promise<Tables[K]> {
        const rows = this.data[table] as Tables[K][];
        if (rows.some(x => x.id === row.id) || unique[table]?.some(keys => rows.some(x => keys.every(k => (x as any)[k] === (row as any)[k]))))
            throw new AppError(409, 'CONFLICT', 'The record already exists.');
        rows.push(structuredClone(row));
        return structuredClone(row);
    }
    async update<K extends Table>(table: K, key: string, change: Partial<Tables[K]>): Promise<Tables[K]> {
        const rows = this.data[table] as Tables[K][];
        const i = rows.findIndex(x => x.id === key);
        if (i < 0)
            throw new AppError(404, 'NOT_FOUND', 'Record not found.');
        const next = { ...rows[i], ...change, id: key } as Tables[K];
        if (unique[table]?.some(keys => rows.some((x, j) => j !== i && keys.every(k => (x as any)[k] === (next as any)[k]))))
            throw new AppError(409, 'CONFLICT', 'The record already exists.');
        rows[i] = next;
        return structuredClone(next);
    }
    async remove<K extends Table>(table: K, key: string): Promise<void> { const rows = this.data[table] as Tables[K][]; const i = rows.findIndex(x => x.id === key); if (i >= 0)
        rows.splice(i, 1); }
}
/** Serialized, process-local test/demo adapter. NOT a substitute for PostgreSQL. */
export class MemoryStore implements Store {
    private data: Snapshot;
    private tail: Promise<void> = Promise.resolve();
    constructor(initial: Snapshot = emptySnapshot(), private persist?: (data: Snapshot) => Promise<void>) { this.data = structuredClone(initial); }
    async read<T>(fn: (db: Repository) => Promise<T>): Promise<T> { await this.tail; return fn(new MemoryRepository(structuredClone(this.data))); }
    async transaction<T>(fn: (db: Repository) => Promise<T>): Promise<T> {
        const before = this.tail;
        let release!: () => void;
        this.tail = new Promise<void>(r => release = r);
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
    async snapshot(): Promise<Snapshot> { await this.tail; return structuredClone(this.data); }
}
