export class ApiError extends Error {
  /**
   * Custom Application Error
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Application-specific error code
   * @param {string} message - Human-readable error message
   * @param {Array|object|null} details - Optional structured error details
   */
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST', details = null) {
    return new ApiError(400, code, message, details);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static conflict(code, message) {
    return new ApiError(409, code, message);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_SERVER_ERROR') {
    return new ApiError(500, code, message);
  }
}
