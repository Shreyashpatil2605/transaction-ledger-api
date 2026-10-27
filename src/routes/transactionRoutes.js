import express from 'express';
import {
  createTransactionHandler,
  getAccountTransactionsHandler
} from '../controllers/transactionController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { accountIdParamSchema } from '../validators/accountValidator.js';
import {
  createTransactionSchema,
  getTransactionsQuerySchema
} from '../validators/transactionValidator.js';

// mergeParams: true allows accessing :id from the parent router (e.g. /api/accounts/:id/transactions)
const router = express.Router({ mergeParams: true });

router.post(
  '/',
  validateRequest({
    params: accountIdParamSchema,
    body: createTransactionSchema
  }),
  createTransactionHandler
);

router.get(
  '/',
  validateRequest({
    params: accountIdParamSchema,
    query: getTransactionsQuerySchema
  }),
  getAccountTransactionsHandler
);

export default router;
