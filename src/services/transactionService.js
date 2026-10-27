import mongoose from 'mongoose';
import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';
import { ApiError } from '../utils/ApiError.js';
import { getAccountById } from './accountService.js';

/**
 * Creates a credit or debit transaction with ACID guarantees.
 * Uses MongoDB multi-document transactions and conditional atomic updates.
 */
export const createTransaction = async (accountId, { type, amount, description, reference_id }) => {
  const session = await mongoose.startSession();

  const amountDecimal = mongoose.Types.Decimal128.fromString(amount.toFixed(2));
  const negativeAmountDecimal = mongoose.Types.Decimal128.fromString((-amount).toFixed(2));

  let createdTransaction = null;
  let finalBalance = null;

  try {
    await session.withTransaction(async () => {
      let updatedAccount = null;

      if (type === 'credit') {
        // Atomic balance increment within the transaction session
        updatedAccount = await Account.findOneAndUpdate(
          { _id: accountId },
          { $inc: { balance: amountDecimal } },
          { session, returnDocument: 'after' }
        );

        if (!updatedAccount) {
          throw ApiError.notFound(`Account with ID '${accountId}' not found`, 'ACCOUNT_NOT_FOUND');
        }
      } else if (type === 'debit') {
        // Concurrency-safe atomic conditional update:
        // Ensures the balance is only debited if balance >= amountDecimal
        updatedAccount = await Account.findOneAndUpdate(
          {
            _id: accountId,
            balance: { $gte: amountDecimal }
          },
          {
            $inc: { balance: negativeAmountDecimal }
          },
          { session, returnDocument: 'after' }
        );

        if (!updatedAccount) {
          // Check if account exists to distinguish 404 from 409 insufficient funds
          const account = await Account.findById(accountId).session(session);
          if (!account) {
            throw ApiError.notFound(
              `Account with ID '${accountId}' not found`,
              'ACCOUNT_NOT_FOUND'
            );
          }
          throw ApiError.conflict(
            'INSUFFICIENT_BALANCE',
            'The account does not have sufficient balance for this debit transaction'
          );
        }
      }

      // Record transaction ledger entry
      try {
        const [tx] = await Transaction.create(
          [
            {
              account_id: accountId,
              type,
              amount: amountDecimal,
              description: description || '',
              reference_id
            }
          ],
          { session }
        );
        createdTransaction = tx;
      } catch (err) {
        if (err.code === 11000) {
          throw ApiError.conflict(
            'DUPLICATE_TRANSACTION',
            `A transaction with reference_id '${reference_id}' already exists for this account`
          );
        }
        throw err;
      }

      finalBalance = parseFloat(updatedAccount.balance.toString());
    });

    return {
      transaction: createdTransaction,
      balance: finalBalance
    };
  } finally {
    await session.endSession();
  }
};

/**
 * Retrieves paginated transaction history for a given account.
 */
export const getAccountTransactions = async (accountId, { type, page = 1, limit = 10 }) => {
  // 1. Verify account exists
  await getAccountById(accountId);

  // 2. Build query filter
  const filter = { account_id: accountId };
  if (type) {
    filter.type = type;
  }

  // 3. Count matching records
  const totalRecords = await Transaction.countDocuments(filter);
  const totalPages = totalRecords === 0 ? 0 : Math.ceil(totalRecords / limit);

  // 4. Retrieve records sorted by newest first
  const skip = (page - 1) * limit;
  const transactions = await Transaction.find(filter)
    .sort({ created_at: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .lean({ getters: true });

  const formattedTransactions = transactions.map((t) => ({
    transaction_id: t._id.toString(),
    account_id: t.account_id.toString(),
    type: t.type,
    amount: parseFloat(t.amount.toString()),
    description: t.description || '',
    reference_id: t.reference_id,
    created_at: t.created_at
  }));

  return {
    transactions: formattedTransactions,
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalRecords,
      totalPages
    }
  };
};
