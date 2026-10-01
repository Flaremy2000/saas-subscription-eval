import type { JwtPayload } from './auth.types.js';

export interface TokenProvider {
  sign(payload: JwtPayload): Promise<string>;
}

export const TOKEN_PROVIDER = Symbol('TokenProvider');
