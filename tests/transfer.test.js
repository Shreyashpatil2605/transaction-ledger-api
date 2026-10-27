import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { startTestDB, stopTestDB, clearTestDB } from './setup.js';

describe('Money Transfer API Tests (Bonus Feature)', () => {
  let sourceAccountId;
  let destAccountId;

  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create source account and fund it with 1000
    const srcRes = await request(app).post('/api/accounts').send({ name: 'Alice Source' });
    sourceAccountId = srcRes.body.data.account_id;
    await request(app)
      .post(`/api/accounts/${sourceAccountId}/transactions`)
      .send({ type: 'credit', amount: 1000, reference_id: 'SEED_SRC' });

    // Create destination account and fund it with 200
    const dstRes = await request(app).post('/api/accounts').send({ name: 'Bob Dest' });
    destAccountId = dstRes.body.data.account_id;
    await request(app)
      .post(`/api/accounts/${destAccountId}/transactions`)
      .send({ type: 'credit', amount: 200, reference_id: 'SEED_DST' });
  });

  it('Should successfully transfer money between accounts and update both balances', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .send({
        from_account_id: sourceAccountId,
        to_account_id: destAccountId,
        amount: 300,
        reference_id: 'TRF_SUCCESS_01',
        description: 'Payment for services'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(300);
    expect(res.body.data.from_account.balance).toBe(700);
    expect(res.body.data.to_account.balance).toBe(500);
    expect(res.body.data.transactions.debit_transaction_id).toBeDefined();
    expect(res.body.data.transactions.credit_transaction_id).toBeDefined();

    // Verify source balance endpoint
    const srcBal = await request(app).get(`/api/accounts/${sourceAccountId}/balance`);
    expect(srcBal.body.data.balance).toBe(700);

    // Verify dest balance endpoint
    const dstBal = await request(app).get(`/api/accounts/${destAccountId}/balance`);
    expect(dstBal.body.data.balance).toBe(500);

    // Verify transactions history on source (should have 2: seed credit and transfer debit)
    const srcHistory = await request(app).get(`/api/accounts/${sourceAccountId}/transactions`);
    expect(srcHistory.body.data.transactions).toHaveLength(2);
    expect(srcHistory.body.data.transactions[0].type).toBe('debit');
    expect(srcHistory.body.data.transactions[0].amount).toBe(300);

    // Verify transactions history on dest (should have 2: seed credit and transfer credit)
    const dstHistory = await request(app).get(`/api/accounts/${destAccountId}/transactions`);
    expect(dstHistory.body.data.transactions).toHaveLength(2);
    expect(dstHistory.body.data.transactions[0].type).toBe('credit');
    expect(dstHistory.body.data.transactions[0].amount).toBe(300);
  });

  it('Should reject transfer when source account has insufficient balance', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .send({
        from_account_id: sourceAccountId,
        to_account_id: destAccountId,
        amount: 5000, // Exceeds balance of 1000
        reference_id: 'TRF_OVERDRAW'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');

    // Verify balances remain untouched
    const srcBal = await request(app).get(`/api/accounts/${sourceAccountId}/balance`);
    expect(srcBal.body.data.balance).toBe(1000);

    const dstBal = await request(app).get(`/api/accounts/${destAccountId}/balance`);
    expect(dstBal.body.data.balance).toBe(200);
  });

  it('Should reject transfer when source and destination accounts are identical', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .send({
        from_account_id: sourceAccountId,
        to_account_id: sourceAccountId,
        amount: 100,
        reference_id: 'TRF_SELF'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body.error)).toContain('different');
  });

  it('Should reject transfer when destination account does not exist', async () => {
    const nonexistentId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/transfers')
      .send({
        from_account_id: sourceAccountId,
        to_account_id: nonexistentId,
        amount: 100,
        reference_id: 'TRF_NO_DEST'
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DESTINATION_ACCOUNT_NOT_FOUND');

    // Source balance should remain untouched
    const srcBal = await request(app).get(`/api/accounts/${sourceAccountId}/balance`);
    expect(srcBal.body.data.balance).toBe(1000);
  });

  it('Should reject duplicate transfer reference_id', async () => {
    const payload = {
      from_account_id: sourceAccountId,
      to_account_id: destAccountId,
      amount: 100,
      reference_id: 'TRF_DUP_REF'
    };

    const res1 = await request(app).post('/api/transfers').send(payload);
    expect(res1.status).toBe(200);

    const res2 = await request(app).post('/api/transfers').send(payload);
    expect(res2.status).toBe(409);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error.code).toBe('DUPLICATE_TRANSACTION');

    // Verify source balance only debited once: 1000 - 100 = 900
    const srcBal = await request(app).get(`/api/accounts/${sourceAccountId}/balance`);
    expect(srcBal.body.data.balance).toBe(900);
  });
});
