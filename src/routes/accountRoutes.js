import express from 'express';
import {
  createAccountHandler,
  getAccountBalanceHandler
} from '../controllers/accountController.js';
import transactionRoutes from './transactionRoutes.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createAccountSchema,
  accountIdParamSchema
} from '../validators/accountValidator.js';

const router = express.Router();

// Account creation
router.post(
  '/',
  validateRequest({
    body: createAccountSchema
  }),
  createAccountHandler
);

// Account balance retrieval
router.get(
  '/:id/balance',
  validateRequest({
    params: accountIdParamSchema
  }),
  getAccountBalanceHandler
);

// Sub-router for transaction operations on an account (/api/accounts/:id/transactions)
router.use('/:id/transactions', transactionRoutes);

export default router;
