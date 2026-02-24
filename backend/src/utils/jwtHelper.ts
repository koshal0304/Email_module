import jwt from 'jsonwebtoken';
import { config } from '../config';

export function signOnlyofficePayload(payload: object): string {
    return jwt.sign(payload, config.onlyofficeJwtSecret, { algorithm: 'HS256' });
}

export function verifyOnlyofficeToken(token: string): any {
    try {
        return jwt.verify(token, config.onlyofficeJwtSecret);
    } catch (error) {
        throw new Error('Invalid ONLYOFFICE token');
    }
}
