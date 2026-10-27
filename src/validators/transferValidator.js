import { z } from 'zod';

const decimalPlacesRegex = /^\d+(\.\d{1,2})?$/;

export const createTransferSchema = z
  .object({
    from_account_id: z
      .string({
        required_error: 'Source account ID (from_account_id) is required',
        invalid_type_error: 'Source account ID must be a string'
      })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid source account ID format'),
    to_account_id: z
      .string({
        required_error: 'Destination account ID (to_account_id) is required',
        invalid_type_error: 'Destination account ID must be a string'
      })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid destination account ID format'),
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
  })
  .refine((data) => data.from_account_id !== data.to_account_id, {
    message: 'Source and destination accounts must be different',
    path: ['to_account_id']
  });
