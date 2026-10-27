import * as transactionService from '../services/transactionService.js';

export const createTransactionHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, amount, description, reference_id } = req.body;

    const result = await transactionService.createTransaction(id, {
      type,
      amount,
      description,
      reference_id
    });

    return res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: {
        transaction_id: result.transaction._id.toString(),
        account_id: result.transaction.account_id.toString(),
        type: result.transaction.type,
        amount: parseFloat(result.transaction.amount.toString()),
        description: result.transaction.description || '',
        reference_id: result.transaction.reference_id,
        balance: result.balance,
        created_at: result.transaction.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAccountTransactionsHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, page, limit } = req.query;

    const result = await transactionService.getAccountTransactions(id, {
      type,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
