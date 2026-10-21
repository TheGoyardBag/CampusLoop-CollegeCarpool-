import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '@campusloop/core';
import type { Repository, Store, Table, Tables, Query, Where } from '@campusloop/core';
const dateFields: Record<string, string[]> = { "campus": [], "hub": [], "user": ["emailVerifiedAt", "suspendedAt", "createdAt"], "session": ["expiresAt", "createdAt"], "actionToken": ["expiresAt", "usedAt"], "course": [], "vehicle": [], "ride": ["departureAt", "arrivalAt", "createdAt"], "booking": ["createdAt", "updatedAt"], "message": ["createdAt"], "notification": ["readAt", "createdAt"], "report": ["createdAt", "resolvedAt"], "audit": ["createdAt"], "outbox": ["availableAt", "sentAt", "claimedAt", "createdAt"], "idempotency": ["expiresAt"], "rateBucket": ["expiresAt"], "review": ["createdAt"] };
function normalize(value: any): any { if (value instanceof Date)
    return value.toISOString(); if (Array.isArray(value))
    return value.map(normalize); if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)])); return value; }
function dates(table: Table, input: any): any { const output = { ...input }; for (const field of dateFields[table] ?? []) {
    if (output[field] === undefined || output[field] === null)
        continue;
    const v = output[field];
    output[field] = typeof v === 'string' ? new Date(v) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) ? x.map(y => new Date(y as string)) : typeof x === 'string' ? new Date(x) : x]));
} for (const k of ['OR', 'AND'])
    if (output[k])
        output[k] = output[k].map((x: any) => dates(table, x)); return output; }
class PrismaRepository implements Repository {
    constructor(private client: any) { }
    async get<K extends Table>(table: K, id: string): Promise<Tables[K] | null> { return normalize(await this.client[table].findUnique({ where: { id } })); }
    async list<K extends Table>(table: K, q: Query = {}): Promise<Tables[K][]> { return normalize(await this.client[table].findMany({ where: dates(table, q.where ?? {}), take: q.take ?? 200, orderBy: q.orderBy ? Object.entries(q.orderBy).map(([k, v]) => ({ [k]: v })) : undefined })); }
    async create<K extends Table>(table: K, row: Tables[K]): Promise<Tables[K]> { return normalize(await this.client[table].create({ data: dates(table, row) })); }
    async update<K extends Table>(table: K, id: string, change: Partial<Tables[K]>): Promise<Tables[K]> { const data = dates(table, change); delete data.id; return normalize(await this.client[table].update({ where: { id }, data })); }
    async remove<K extends Table>(table: K, id: string): Promise<void> { await this.client[table].deleteMany({ where: { id } }); }
}
/** All side effects inside transactions are database writes, including the outbox. */
export class PrismaStore implements Store {
    constructor(public readonly client: PrismaClient) { }
    async read<T>(fn: (db: Repository) => Promise<T>): Promise<T> { return fn(new PrismaRepository(this.client)); }
    async transaction<T>(fn: (db: Repository) => Promise<T>): Promise<T> {
        for (let attempt = 0; attempt < 6; attempt++) {
            try {
                return await this.client.$transaction(tx => fn(new PrismaRepository(tx)), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 15000 });
            }
            catch (e) {
                const code = (e as {
                    code?: string;
                }).code;
                if (code === 'P2034' && attempt < 5) {
                    await new Promise(r => setTimeout(r, 10 * 2 ** attempt + Math.floor(Math.random() * 10)));
                    continue;
                }
                if (code === 'P2034')
                    throw new AppError(409, 'RETRY', 'Concurrent update. Retry the action.');
                if (code === 'P2002')
                    throw new AppError(409, 'CONFLICT', 'This record already exists.');
                if (code === 'P2025')
                    throw new AppError(404, 'NOT_FOUND', 'Record not found.');
                throw e;
            }
        }
        throw new AppError(503, 'UNAVAILABLE', 'The database is busy.');
    }
}
