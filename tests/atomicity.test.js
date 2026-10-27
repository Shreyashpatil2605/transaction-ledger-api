import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { Account } from '../src/models/Account.js';
import { Transaction } from '../src/models/Transaction.js';
import { startTestDB, stopTestDB, clearTestDB } from './setup.js';
import * as transactionService from '../src/services/transactionService.js';
import * as transferService from '../src/services/transferService.js';

describe('Atomicity and Rollback Tests', () => {
  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  // 24. Verify that a failed transaction does not partially update the database
  it('Scenario 24: Should roll back balance update if transaction insertion fails (Atomicity)', async () => {
    // 1. Create account with 500 balance
    const acc = await Account.create({
      name: 'Atomicity Test Account',
      balance: mongoose.Types.Decimal128.fromString('500.00')
    });

    // 2. Pre-create a transaction with reference_id 'DUP_REF' for this account
    await Transaction.create({
      account_id: acc._id,
      type: 'credit',
      amount: mongoose.Types.Decimal128.fromString('500.00'),
      reference_id: 'DUP_REF'
    });

    // 3. Attempt a debit of 100 with the SAME reference_id 'DUP_REF'.
    // The balance decrement step would run first, but the Transaction.create will throw a duplicate-key error.
    await expect(
      transactionService.createTransaction(acc._id.toString(), {
        type: 'debit',
        amount: 100,
        reference_id: 'DUP_REF',
        description: 'Should abort'
      })
    ).rejects.toThrow();

    // 4. Verify account balance was NOT modified and rolled back to 500
    const accountAfter = await Account.findById(acc._id);
    expect(parseFloat(accountAfter.balance.toString())).toBe(500);

    // 5. Verify no extra transaction document was committed
    const totalTransactions = await Transaction.countDocuments({ account_id: acc._id });
    expect(totalTransactions).toBe(1);
  });

  // 25. Verify that money transfers roll back completely if any step fails
  it('Scenario 25: Should roll back entire transfer if any step fails', async () => {
    // 1. Create source account with balance 300
    const sourceAcc = await Account.create({
      name: 'Source Account',
      balance: mongoose.Types.Decimal128.fromString('300.00')
    });

    // 2. Create destination account with balance 100
    const destAcc = await Account.create({
      name: 'Dest Account',
      balance: mongoose.Types.Decimal128.fromString('100.00')
    });

    // 3. Pre-create a transaction on the destination account with reference_id 'TRANSFER_FAIL_REF'
    // This will cause destination ledger insertion to fail due to duplicate key
    await Transaction.create({
      account_id: destAcc._id,
      type: 'credit',
      amount: mongoose.Types.Decimal128.fromString('10.00'),
      reference_id: 'TRANSFER_FAIL_REF'
    });

    // 4. Attempt transfer from source to dest with the conflicting reference_id
    await expect(
      transferService.transferMoney({
        from_account_id: sourceAcc._id.toString(),
        to_account_id: destAcc._id.toString(),
        amount: 150,
        reference_id: 'TRANSFER_FAIL_REF',
        description: 'Transfer that will fail on destination ledger insert'
      })
    ).rejects.toThrow();

    // 5. Verify source account was NOT debited (still 300)
    const sourceAfter = await Account.findById(sourceAcc._id);
    expect(parseFloat(sourceAfter.balance.toString())).toBe(300);

    // 6. Verify dest account was NOT credited (still 100)
    const destAfter = await Account.findById(destAcc._id);
    expect(parseFloat(destAfter.balance.toString())).toBe(100);

    // 7. Verify source has zero transactions created
    const sourceTxCount = await Transaction.countDocuments({ account_id: sourceAcc._id });
    expect(sourceTxCount).toBe(0);
  });
});
