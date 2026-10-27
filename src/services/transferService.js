import mongoose from 'mongoose';
import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Executes an atomic transfer between two accounts.
 * Debits source, credits destination, and writes two ledger entries within a single ACID transaction.
 */
export const transferMoney = async ({
  from_account_id,
  to_account_id,
  amount,
  reference_id,
  description
}) => {
  if (from_account_id === to_account_id) {
    throw ApiError.badRequest(
      'Source and destination accounts must be different',
      'INVALID_TRANSFER_ACCOUNTS'
    );
  }

  const session = await mongoose.startSession();
  const amountDecimal = mongoose.Types.Decimal128.fromString(amount.toFixed(2));
  const negativeAmountDecimal = mongoose.Types.Decimal128.fromString((-amount).toFixed(2));

  let transferResult = null;

  try {
    await session.withTransaction(async () => {
      // 1. Verify existence of destination account first
      const destinationAccount = await Account.findById(to_account_id).session(session);
      if (!destinationAccount) {
        throw ApiError.notFound(
          `Destination account with ID '${to_account_id}' not found`,
          'DESTINATION_ACCOUNT_NOT_FOUND'
        );
      }

      // 2. Atomically debit source account conditionally (must have balance >= amount)
      const updatedSourceAccount = await Account.findOneAndUpdate(
        {
          _id: from_account_id,
          balance: { $gte: amountDecimal }
        },
        {
          $inc: { balance: negativeAmountDecimal }
        },
        { session, returnDocument: 'after' }
      );

      if (!updatedSourceAccount) {
        const sourceAccount = await Account.findById(from_account_id).session(session);
        if (!sourceAccount) {
          throw ApiError.notFound(
            `Source account with ID '${from_account_id}' not found`,
            'SOURCE_ACCOUNT_NOT_FOUND'
          );
        }
        throw ApiError.conflict(
          'INSUFFICIENT_BALANCE',
          'Source account does not have sufficient balance for this transfer'
        );
      }

      // 3. Atomically credit destination account
      const updatedDestinationAccount = await Account.findOneAndUpdate(
        { _id: to_account_id },
        { $inc: { balance: amountDecimal } },
        { session, returnDocument: 'after' }
      );

      // 4. Record ledger entries for both accounts
      let debitTx;
      let creditTx;

      try {
        // Record debit transaction for source
        const [dTx] = await Transaction.create(
          [
            {
              account_id: from_account_id,
              type: 'debit',
              amount: amountDecimal,
              description: description || `Transfer to account ${to_account_id}`,
              reference_id
            }
          ],
          { session }
        );
        debitTx = dTx;

        // Record credit transaction for destination
        const [cTx] = await Transaction.create(
          [
            {
              account_id: to_account_id,
              type: 'credit',
              amount: amountDecimal,
              description: description || `Transfer from account ${from_account_id}`,
              reference_id
            }
          ],
          { session }
        );
        creditTx = cTx;
      } catch (err) {
        if (err.code === 11000) {
          throw ApiError.conflict(
            'DUPLICATE_TRANSACTION',
            `A transfer or transaction with reference_id '${reference_id}' has already been processed`
          );
        }
        throw err;
      }

      transferResult = {
        reference_id,
        amount,
        description: description || '',
        from_account: {
          account_id: from_account_id,
          balance: parseFloat(updatedSourceAccount.balance.toString())
        },
        to_account: {
          account_id: to_account_id,
          balance: parseFloat(updatedDestinationAccount.balance.toString())
        },
        transactions: {
          debit_transaction_id: debitTx._id.toString(),
          credit_transaction_id: creditTx._id.toString()
        },
        created_at: debitTx.created_at
      };
    });

    return transferResult;
  } finally {
    await session.endSession();
  }
};
