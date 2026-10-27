import mongoose from 'mongoose';
import { Account } from '../models/Account.js';
import { ApiError } from '../utils/ApiError.js';

export const createAccount = async ({ name }) => {
  // Always initialize balance to exactly 0.00 Decimal128
  // Server strictly manages initial balance and timestamps
  const account = await Account.create({
    name,
    balance: mongoose.Types.Decimal128.fromString('0.00')
  });

  return account;
};

export const getAccountById = async (accountId) => {
  const account = await Account.findById(accountId);
  if (!account) {
    throw ApiError.notFound(`Account with ID '${accountId}' not found`, 'ACCOUNT_NOT_FOUND');
  }
  return account;
};

export const getAccountBalance = async (accountId) => {
  const account = await getAccountById(accountId);
  return {
    account_id: account._id.toString(),
    balance: parseFloat(account.balance.toString())
  };
};
