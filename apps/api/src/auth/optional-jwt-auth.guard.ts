import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    _error: any,
    user: any,
    _info: any,
    _context: ExecutionContext,
    _status?: any
  ): TUser {
    return (user ?? null) as TUser;
  }
}
