import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

export const errorHandler = (err, req, res, next) => {
  // If headers are already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // 1. Handled Application Errors
  if (err instanceof ApiError) {
    const response = {
      success: false,
      error: {
        code: err.code,
        message: err.message
      }
    };
    if (err.details) {
      response.error.details = err.details;
    }
    return res.status(err.statusCode).json(response);
  }

  // 2. Zod Schema Validation Errors
  if (err instanceof ZodError || err.name === 'ZodError') {
    const issues = err.issues || err.errors || [];
    const details = issues.map((e) => ({
      field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
      message: e.message
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details
      }
    });
  }

  // 3. Syntax error from express.json() (Malformed JSON)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body'
      }
    });
  }

  // 4. Mongoose CastError (e.g. invalid ObjectId format)
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: `Invalid format for field '${err.path}': '${err.value}'`
      }
    });
  }

  // 5. MongoDB Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    const duplicateFields = Object.keys(err.keyPattern || err.keyValue || {});
    let code = 'DUPLICATE_KEY_ERROR';
    let message = 'A duplicate resource already exists';

    if (duplicateFields.includes('account_id') && duplicateFields.includes('reference_id')) {
      code = 'DUPLICATE_TRANSACTION';
      message = 'A transaction with this reference_id already exists for this account';
    } else if (duplicateFields.includes('reference_id')) {
      code = 'DUPLICATE_REFERENCE';
      message = 'A record with this reference_id already exists';
    }

    return res.status(409).json({
      success: false,
      error: {
        code,
        message
      }
    });
  }

  // 6. MongoDB / Network Connection Errors
  if (
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoTimeoutError'
  ) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Unable to connect to the database. Please try again later.'
      }
    });
  }

  // 7. Generic Internal Server Error (Hide internal details and stack traces)
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction && process.env.NODE_ENV !== 'test') {
    console.error('[Unhandled Server Error]:', err);
  }
  const response = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred'
    }
  };

  // Only attach debug details in development/test if not in production
  if (!isProduction && process.env.DEBUG_ERRORS === 'true') {
    response.error.debug = err.message;
    response.error.stack = err.stack;
  }

  return res.status(500).json(response);
};
