// =============================================================================
// Encryption Utilities
// =============================================================================
// AES-256-GCM encryption for sensitive data (OAuth tokens)
// =============================================================================

import crypto from 'crypto';
import { config } from '../config';
import { createLogger } from './logger';

const logger = createLogger('Encryption');

// =============================================================================
// Constants
// =============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const ENCODING: BufferEncoding = 'base64';

// =============================================================================
// Key Derivation
// =============================================================================

function deriveKey(secret: string): Buffer {
    // Use PBKDF2 to derive a consistent 32-byte key from the secret
    return crypto.pbkdf2Sync(secret, 'email-backend-salt', 100000, 32, 'sha256');
}

// =============================================================================
// Encryption
// =============================================================================

/**
 * Encrypts a plaintext string using AES-256-GCM
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded encrypted string (IV + ciphertext + authTag)
 */
export function encrypt(plaintext: string): string {
    if (!plaintext) {
        return '';
    }

    const key = deriveKey(config.encryption.key);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Combine IV + encrypted data + auth tag
    const combined = Buffer.concat([iv, encrypted, authTag]);

    return combined.toString(ENCODING);
}

// =============================================================================
// Decryption
// =============================================================================

/**
 * Decrypts a Base64-encoded encrypted string
 * @param encryptedText - The encrypted string to decrypt
 * @returns The original plaintext string
 */
export function decrypt(encryptedText: string): string {
    if (!encryptedText) {
        return '';
    }

    try {
        const key = deriveKey(config.encryption.key);
        const combined = Buffer.from(encryptedText, ENCODING);

        // Extract IV, encrypted data, and auth tag
        const iv = combined.subarray(0, IV_LENGTH);
        const authTag = combined.subarray(combined.length - TAG_LENGTH);
        const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

        return decrypted.toString('utf8');
    } catch (error) {
        logger.error('Decryption failed', error);
        throw new Error('Failed to decrypt data');
    }
}

// =============================================================================
// Token Encryption Helpers
// =============================================================================

/**
 * Encrypts OAuth tokens for secure storage
 */
export function encryptToken(token: string): string {
    return encrypt(token);
}

/**
 * Decrypts OAuth tokens for use
 */
export function decryptToken(encryptedToken: string): string {
    return decrypt(encryptedToken);
}

// =============================================================================
// Hash Utilities
// =============================================================================

/**
 * Creates a SHA-256 hash of the input
 */
export function hash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Creates an HMAC-SHA256 signature
 */
export function hmacSign(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verifies an HMAC-SHA256 signature
 */
export function hmacVerify(data: string, signature: string, secret: string): boolean {
    const expectedSignature = hmacSign(data, secret);
    return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
    );
}

// =============================================================================
// Random Generation
// =============================================================================

/**
 * Generates a cryptographically secure random string
 */
export function generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Generates a UUID v4
 */
export function generateUuid(): string {
    return crypto.randomUUID();
}
