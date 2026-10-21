export class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) { super(message); }
}
export async function api<T>(path: string, options: {
    method?: string;
    body?: unknown;
    key?: string;
    signal?: AbortSignal;
} = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', cache: 'no-store', signal: options.signal, headers: { Accept: 'application/json', ...(method !== 'GET' ? { 'Content-Type': 'application/json', 'X-CampusLoop-Client': 'web' } : {}), ...(options.key ? { 'Idempotency-Key': options.key } : {}) }, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    const result = await response.json();
    if (!response.ok)
        throw new ApiError(response.status, result.error?.code ?? 'HTTP_ERROR', result.error?.message ?? 'Request failed.');
    return result as T;
}
export const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(cents / 100);
export const time = (value: string, timezone: string) => new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
export const day = (value: string, timezone: string) => new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value));
export const initials = (name: string) => name.split(' ').slice(0, 2).map(x => x[0]).join('');
export const mins = (n: number) => `${Math.floor(n / 60).toString().padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
