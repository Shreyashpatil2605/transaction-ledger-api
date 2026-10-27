import { z } from 'zod';

export const createAccountSchema = z
  .object({
    name: z
      .string({
        required_error: 'Account name is required',
        invalid_type_error: 'Account name must be a string'
      })
      .trim()
      .min(1, 'Account name cannot be empty'),
    balance: z.any().optional()
  })
  .strict()
  .refine((data) => data.balance === undefined, {
    message: 'Clients are not permitted to set the initial account balance',
    path: ['balance']
  });

export const accountIdParamSchema = z.object({
  id: z
    .string({
      required_error: 'Account ID is required'
    })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid account ID format')
});
