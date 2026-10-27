/**
 * Express middleware to validate request body, params, and/or query with Zod schemas.
 * Replaces req.body, req.params, req.query with parsed & sanitized values.
 */
export const validateRequest = ({ body, params, query }) => {
  return (req, res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }
      if (params) {
        const parsedParams = params.parse(req.params);
        Object.defineProperty(req, 'params', {
          value: parsedParams,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }
      if (query) {
        const parsedQuery = query.parse(req.query);
        // Express 5 defines req.query with a getter on prototype.
        // Defining an own property safely overrides it.
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
