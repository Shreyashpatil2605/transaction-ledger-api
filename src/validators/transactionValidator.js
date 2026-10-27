import { z } from 'zod';

// Regex to ensure precision does not exceed 2 decimal places
const decimalPlacesRegex = /^\d+(\.\d{1,2})?$/;

export const createTransactionSchema = z
  .object({
    type: z.enum(['credit', 'debit'], {
      errorMap: () => ({ message: 'Transaction type must be either "credit" or "debit"' })
    }),
    amount: z
      .number({
        required_error: 'Amount is required',
        invalid_type_error: 'Amount must be a number'
      })
      .finite('Amount must be a finite number')
      .positive('Amount must be greater than zero')
      .refine(
        (val) => decimalPlacesRegex.test(val.toString()),
        'Amount cannot have more than 2 decimal places'
      ),
    reference_id: z
      .string({
        required_error: 'Reference ID is required',
        invalid_type_error: 'Reference ID must be a string'
      })
      .trim()
      .min(1, 'Reference ID cannot be empty'),
    description: z
      .string({
        invalid_type_error: 'Description must be a string'
      })
      .trim()
      .max(255, 'Description cannot exceed 255 characters')
      .optional()
  })
  .strict({
    message: 'Request payload contains unrecognized or server-managed fields'
  });

export const getTransactionsQuerySchema = z.object({
  type: z
    .enum(['credit', 'debit'], {
      errorMap: () => ({ message: 'Transaction type filter must be either "credit" or "debit"' })
    })
    .optional(),
  page: z
    .string()
    .optional()
    .default('1')
    .refine((val) => /^\d+$/.test(val) && parseInt(val, 10) >= 1, {
      message: 'Page must be a positive integer greater than or equal to 1'
    })
    .transform((val) => parseInt(val, 10)),
  limit: z
    .string()
    .optional()
    .default('10')
    .refine((val) => /^\d+$/.test(val) && parseInt(val, 10) >= 1 && parseInt(val, 10) <= 100, {
      message: 'Limit must be a positive integer between 1 and 100'
    })
    .transform((val) => parseInt(val, 10))
});
