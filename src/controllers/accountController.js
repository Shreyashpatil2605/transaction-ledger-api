import * as accountService from '../services/accountService.js';

export const createAccountHandler = async (req, res, next) => {
  try {
    const account = await accountService.createAccount({ name: req.body.name });
    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        account_id: account._id.toString(),
        name: account.name,
        balance: parseFloat(account.balance.toString()),
        created_at: account.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAccountBalanceHandler = async (req, res, next) => {
  try {
    const data = await accountService.getAccountBalance(req.params.id);
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};
