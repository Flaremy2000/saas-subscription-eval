import { type ExecutionContext, UnauthorizedException, createParamDecorator } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Express.User => {
    const request = context.switchToHttp().getRequest<{ user?: Express.User }>();
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }
    return request.user;
  },
);
