import express from 'express';
import { transferMoneyHandler } from '../controllers/transferController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { createTransferSchema } from '../validators/transferValidator.js';

const router = express.Router();

// Money transfer between accounts (/api/transfers)
router.post(
  '/',
  validateRequest({
    body: createTransferSchema
  }),
  transferMoneyHandler
);

export default router;
