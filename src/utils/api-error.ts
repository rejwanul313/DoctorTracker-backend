import { ERROR_CODES, type ApiErrorDetail, type ErrorCode } from '@doctor-tracker/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: ApiErrorDetail[]) {
    return new ApiError(400, ERROR_CODES.VALIDATION_ERROR, message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, ERROR_CODES.UNAUTHORIZED, message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(resource = 'Resource') {
    return new ApiError(404, ERROR_CODES.NOT_FOUND, `${resource} not found`);
  }

  static conflict(code: ErrorCode, message: string) {
    return new ApiError(409, code, message);
  }
}
