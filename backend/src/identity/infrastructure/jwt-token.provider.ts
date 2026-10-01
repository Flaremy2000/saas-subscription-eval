import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../domain/auth.types.js';
import type { TokenProvider } from '../domain/token-provider.js';

@Injectable()
export class JwtTokenProvider implements TokenProvider {
  constructor(private readonly jwtService: JwtService) {}

  sign(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }
}
