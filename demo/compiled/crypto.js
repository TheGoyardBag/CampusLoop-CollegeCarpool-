"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.digest = exports.randomToken = exports.id = void 0;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const node_crypto_1 = require("node:crypto");
const node_util_1 = require("node:util");
const scrypt = (0, node_util_1.promisify)(node_crypto_1.scrypt);
const id = () => (0, node_crypto_1.randomUUID)();
exports.id = id;
const randomToken = () => (0, node_crypto_1.randomBytes)(32).toString('base64url');
exports.randomToken = randomToken;
const digest = (s) => (0, node_crypto_1.createHash)('sha256').update(s).digest('hex');
exports.digest = digest;
async function hashPassword(password) {
    const salt = (0, node_crypto_1.randomBytes)(16).toString('hex');
    const key = await scrypt(password, salt, 64);
    return `scrypt:${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password, encoded) {
    const [kind, salt, key] = encoded.split(':');
    if (kind !== 'scrypt' || !salt || !key || !/^[0-9a-f]{128}$/.test(key))
        return false;
    const derived = await scrypt(password, salt, 64);
    return (0, node_crypto_1.timingSafeEqual)(derived, Buffer.from(key, 'hex'));
}
