import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthResponse, PublicUser } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginRequest } from './dto/login.request.js';
import { Public } from './public.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() credentials: LoginRequest): Promise<AuthResponse> {
    return this.authService.login(credentials);
  }

  @Get('me')
  me(@CurrentUser() user: Express.User): { user: PublicUser } {
    const { sub, ...rest } = user;
    return { user: { id: sub, ...rest } };
  }
}
