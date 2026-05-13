import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtPayload } from '../types/jwt.types';

@Injectable()
export class PaidGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    if (user.isGuest) {
      throw new ForbiddenException(
        'Guests must create a free account to access this feature',
      );
    }

    if (!user.isPaid) {
      throw new ForbiddenException(
        'An active Pro subscription is required to access this feature',
      );
    }

    return true;
  }
}
