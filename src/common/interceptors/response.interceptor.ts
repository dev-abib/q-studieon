// src/common/interceptors/response.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  SuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<RequestData<T>>,
  ): Observable<SuccessResponse<T>> {
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
