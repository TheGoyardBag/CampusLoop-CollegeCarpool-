import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const id = () => randomUUID();
export const randomToken = () => randomBytes(32).toString('base64url');
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const key = await scrypt(password, salt, 64) as Buffer;
    return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
    const [kind, salt, key] = encoded.split(':');
    if (kind !== 'scrypt' || !salt || !key || !/^[0-9a-f]{128}$/.test(key))
        return false;
    const derived = await scrypt(password, salt, 64) as Buffer;
    return timingSafeEqual(derived, Buffer.from(key, 'hex'));
}
