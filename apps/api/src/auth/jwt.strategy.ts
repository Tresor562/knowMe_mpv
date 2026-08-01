import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET')
    });
  }

  validate(payload: {
    sub: string;
    username: string;
    role?: string;
    sid?: string;
  }) {
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role ?? 'USER',
      sessionId: payload.sid
    };
  }
}
