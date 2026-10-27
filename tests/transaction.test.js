import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { startTestDB, stopTestDB, clearTestDB } from './setup.js';

describe('Transaction API Tests', () => {
  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  // Helper to create an account
  const createTestAccount = async (name = 'Test User') => {
    const res = await request(app).post('/api/accounts').send({ name });
    return res.body.data;
  };

  // 6. Create a credit transaction
  it('Scenario 6: Should create a credit transaction and update balance', async () => {
    const account = await createTestAccount();
    const res = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 1000,
        description: 'Initial deposit',
        reference_id: 'REF001'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('credit');
    expect(res.body.data.amount).toBe(1000);
    expect(res.body.data.balance).toBe(1000);
    expect(res.body.data.reference_id).toBe('REF001');
    expect(res.body.data.transaction_id).toBeDefined();

    // Verify balance via balance endpoint
    const balRes = await request(app).get(`/api/accounts/${account.account_id}/balance`);
    expect(balRes.body.data.balance).toBe(1000);
  });

  // 7. Create a debit transaction
  it('Scenario 7: Should create a debit transaction and decrease balance', async () => {
    const account = await createTestAccount();

    // First credit 1000
    await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 1000,
        reference_id: 'DEP001'
      });

    // Debit 300
    const res = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'debit',
        amount: 300,
        description: 'Shopping',
        reference_id: 'REF002'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('debit');
    expect(res.body.data.amount).toBe(300);
    expect(res.body.data.balance).toBe(700);

    const balRes = await request(app).get(`/api/accounts/${account.account_id}/balance`);
    expect(balRes.body.data.balance).toBe(700);
  });

  // 8. Reject a zero amount
  it('Scenario 8: Should reject a transaction with zero amount', async () => {
    const account = await createTestAccount();
    const res = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 0,
        reference_id: 'REF_ZERO'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // 9. Reject a negative amount
  it('Scenario 9: Should reject a transaction with negative amount', async () => {
    const account = await createTestAccount();
    const res = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: -150,
        reference_id: 'REF_NEG'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // 10. Reject an invalid transaction type
  it('Scenario 10: Should reject an invalid transaction type', async () => {
    const account = await createTestAccount();
    const res = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'transfer_invalid',
        amount: 100,
        reference_id: 'REF_TYPE'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // 11. Reject a missing reference_id
  it('Scenario 11: Should reject missing or empty reference_id', async () => {
    const account = await createTestAccount();

    // Missing reference_id
    const res1 = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 100
      });
    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);

    // Empty reference_id
    const res2 = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 100,
        reference_id: '   '
      });
    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
  });

  // 12. Reject a debit when funds are insufficient
  it('Scenario 12: Should reject a debit when funds are insufficient with HTTP 409', async () => {
    const account = await createTestAccount();

    // Account has 0 balance, attempt to debit 50
    const res = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'debit',
        amount: 50,
        reference_id: 'OVERDRAW_REF'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });

  // 13. Ensure failed debits do not change the balance
  it('Scenario 13: Should ensure failed debits do not alter balance or record a transaction', async () => {
    const account = await createTestAccount();

    // Credit 100
    await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 100,
        reference_id: 'CREDIT_100'
      });

    // Debit 200 (should fail)
    const failRes = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'debit',
        amount: 200,
        reference_id: 'FAILED_DEBIT'
      });
    expect(failRes.status).toBe(409);

    // Verify balance is still exactly 100
    const balRes = await request(app).get(`/api/accounts/${account.account_id}/balance`);
    expect(balRes.body.data.balance).toBe(100);

    // Verify no debit transaction was saved
    const txRes = await request(app).get(`/api/accounts/${account.account_id}/transactions`);
    expect(txRes.body.data.transactions).toHaveLength(1);
    expect(txRes.body.data.transactions[0].reference_id).toBe('CREDIT_100');
  });

  // 14. Reject duplicate references for the same account
  it('Scenario 14: Should reject duplicate reference_id for the same account with HTTP 409', async () => {
    const account = await createTestAccount();

    const res1 = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 500,
        reference_id: 'UNIQUE_REF_01'
      });
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 200,
        reference_id: 'UNIQUE_REF_01'
      });
    expect(res2.status).toBe(409);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error.code).toBe('DUPLICATE_TRANSACTION');
  });

  // 15. Allow the same reference for different accounts
  it('Scenario 15: Should permit the same reference_id across different accounts', async () => {
    const account1 = await createTestAccount('User 1');
    const account2 = await createTestAccount('User 2');

    const res1 = await request(app)
      .post(`/api/accounts/${account1.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 250,
        reference_id: 'SHARED_REF_100'
      });
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post(`/api/accounts/${account2.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 750,
        reference_id: 'SHARED_REF_100'
      });
    expect(res2.status).toBe(201);
  });

  // 16. Ensure duplicate requests do not change the balance twice
  it('Scenario 16: Should ensure duplicate requests do not change the balance twice', async () => {
    const account = await createTestAccount();

    // First request
    const res1 = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 400,
        reference_id: 'IDEMPOTENT_REF'
      });
    expect(res1.status).toBe(201);

    // Duplicate request
    const res2 = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 400,
        reference_id: 'IDEMPOTENT_REF'
      });
    expect(res2.status).toBe(409);

    // Balance must be 400, not 800
    const balRes = await request(app).get(`/api/accounts/${account.account_id}/balance`);
    expect(balRes.body.data.balance).toBe(400);
  });

  // 17. Test concurrent debit requests
  it('Scenario 17: Should safely handle concurrent debit requests without overdrawing', async () => {
    const account = await createTestAccount('Concurrency Test User');

    // Deposit 100
    await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 100,
        reference_id: 'INITIAL_100'
      });

    // Execute 5 concurrent debit requests of 30 each (3 * 30 = 90 <= 100, so exactly 3 should succeed, 2 should fail)
    const promises = [1, 2, 3, 4, 5].map((i) =>
      request(app)
        .post(`/api/accounts/${account.account_id}/transactions`)
        .send({
          type: 'debit',
          amount: 30,
          reference_id: `CONCURRENT_DEBIT_${i}`
        })
    );

    const results = await Promise.all(promises);

    const successful = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 409);

    expect(successful).toHaveLength(3);
    expect(rejected).toHaveLength(2);

    for (const r of rejected) {
      expect(r.body.error.code).toBe('INSUFFICIENT_BALANCE');
    }

    // Final balance must be 100 - (3 * 30) = 10
    const balRes = await request(app).get(`/api/accounts/${account.account_id}/balance`);
    expect(balRes.body.data.balance).toBe(10);
  });

  // Additional: Nonexistent account handling on transactions
  it('Should return 404 when creating a transaction for a nonexistent account', async () => {
    const nonexistentId = new mongoose.Types.ObjectId().toString();

    // Credit on nonexistent account
    const resCredit = await request(app)
      .post(`/api/accounts/${nonexistentId}/transactions`)
      .send({
        type: 'credit',
        amount: 100,
        reference_id: 'NONEXIST_CREDIT'
      });
    expect(resCredit.status).toBe(404);
    expect(resCredit.body.success).toBe(false);
    expect(resCredit.body.error.code).toBe('ACCOUNT_NOT_FOUND');

    // Debit on nonexistent account
    const resDebit = await request(app)
      .post(`/api/accounts/${nonexistentId}/transactions`)
      .send({
        type: 'debit',
        amount: 100,
        reference_id: 'NONEXIST_DEBIT'
      });
    expect(resDebit.status).toBe(404);
    expect(resDebit.body.success).toBe(false);
    expect(resDebit.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  // Additional: Malformed account ID handling
  it('Should return 400 when an invalid account ID format is supplied', async () => {
    const res = await request(app)
      .post('/api/accounts/invalid-account-id/transactions')
      .send({
        type: 'credit',
        amount: 100,
        reference_id: 'MALFORMED_ID'
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Additional: Prohibit client from overriding server-managed fields
  it('Should reject requests containing unrecognized or server-managed fields', async () => {
    const account = await createTestAccount();
    const res = await request(app)
      .post(`/api/accounts/${account.account_id}/transactions`)
      .send({
        type: 'credit',
        amount: 100,
        reference_id: 'REF_EXTRA',
        balance: 999999, // Prohibited server-managed field
        transaction_id: 'arbitrary_tx_id'
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
