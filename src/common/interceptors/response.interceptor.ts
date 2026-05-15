// src/common/interceptors/response.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';

interface RequestData<T> {
  message?: string;
  data?: T;
}

interface SuccessResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  RequestData<T>,
  unknown
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<RequestData<T>>,
  ): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) return next.handle();

    return next.handle().pipe(
      map(
        (data: RequestData<T>): SuccessResponse<T> => ({
          success: true,
          message: data?.message ?? 'Success',
          data: data?.data ?? null,
        }),
      ),
    );
  }
}
