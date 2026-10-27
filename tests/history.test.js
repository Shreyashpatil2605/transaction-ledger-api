import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { startTestDB, stopTestDB, clearTestDB } from './setup.js';

describe('Transaction History API Tests', () => {
  let accountId;

  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create an account
    const accRes = await request(app).post('/api/accounts').send({ name: 'History User' });
    accountId = accRes.body.data.account_id;

    // Seed 4 transactions: 2 credits, 2 debits with small delays to ensure distinct created_at
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'credit', amount: 500, reference_id: 'TX_1', description: 'Credit 1' });

    await new Promise((resolve) => setTimeout(resolve, 50));

    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'debit', amount: 100, reference_id: 'TX_2', description: 'Debit 1' });

    await new Promise((resolve) => setTimeout(resolve, 50));

    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'credit', amount: 200, reference_id: 'TX_3', description: 'Credit 2' });

    await new Promise((resolve) => setTimeout(resolve, 50));

    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'debit', amount: 50, reference_id: 'TX_4', description: 'Debit 2' });
  });

  // 18. Return all transactions when type is omitted
  it('Scenario 18: Should return all transactions when type is omitted', async () => {
    const res = await request(app).get(`/api/accounts/${accountId}/transactions`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactions).toHaveLength(4);
    expect(res.body.data.pagination.totalRecords).toBe(4);
  });

  // 19. Filter credit transactions
  it('Scenario 19: Should filter credit transactions', async () => {
    const res = await request(app).get(`/api/accounts/${accountId}/transactions?type=credit`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactions).toHaveLength(2);
    expect(res.body.data.pagination.totalRecords).toBe(2);
    for (const tx of res.body.data.transactions) {
      expect(tx.type).toBe('credit');
    }
  });

  // 20. Filter debit transactions
  it('Scenario 20: Should filter debit transactions', async () => {
    const res = await request(app).get(`/api/accounts/${accountId}/transactions?type=debit`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactions).toHaveLength(2);
    expect(res.body.data.pagination.totalRecords).toBe(2);
    for (const tx of res.body.data.transactions) {
      expect(tx.type).toBe('debit');
    }
  });

  // 21. Return newest transactions first
  it('Scenario 21: Should return newest transactions first in descending order', async () => {
    const res = await request(app).get(`/api/accounts/${accountId}/transactions`);

    expect(res.status).toBe(200);
    const txs = res.body.data.transactions;
    expect(txs).toHaveLength(4);

    // Latest created should be TX_4, then TX_3, TX_2, TX_1
    expect(txs[0].reference_id).toBe('TX_4');
    expect(txs[1].reference_id).toBe('TX_3');
    expect(txs[2].reference_id).toBe('TX_2');
    expect(txs[3].reference_id).toBe('TX_1');

    for (let i = 0; i < txs.length - 1; i++) {
      const current = new Date(txs[i].created_at).getTime();
      const next = new Date(txs[i + 1].created_at).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  // 22. Verify pagination metadata
  it('Scenario 22: Should correctly paginate and provide pagination metadata', async () => {
    const page1Res = await request(app).get(
      `/api/accounts/${accountId}/transactions?page=1&limit=2`
    );

    expect(page1Res.status).toBe(200);
    expect(page1Res.body.data.transactions).toHaveLength(2);
    expect(page1Res.body.data.pagination).toEqual({
      currentPage: 1,
      pageSize: 2,
      totalRecords: 4,
      totalPages: 2
    });

    const page2Res = await request(app).get(
      `/api/accounts/${accountId}/transactions?page=2&limit=2`
    );

    expect(page2Res.status).toBe(200);
    expect(page2Res.body.data.transactions).toHaveLength(2);
    expect(page2Res.body.data.pagination).toEqual({
      currentPage: 2,
      pageSize: 2,
      totalRecords: 4,
      totalPages: 2
    });

    // Make sure page 1 and page 2 contain different transactions
    expect(page1Res.body.data.transactions[0].transaction_id).not.toBe(
      page2Res.body.data.transactions[0].transaction_id
    );
  });

  // 23. Reject invalid pagination parameters
  it('Scenario 23: Should reject invalid pagination parameters', async () => {
    // Negative page
    const res1 = await request(app).get(`/api/accounts/${accountId}/transactions?page=-1`);
    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);

    // Page zero
    const res2 = await request(app).get(`/api/accounts/${accountId}/transactions?page=0`);
    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);

    // Non-numeric page
    const res3 = await request(app).get(`/api/accounts/${accountId}/transactions?page=abc`);
    expect(res3.status).toBe(400);

    // Limit out of range (> 100)
    const res4 = await request(app).get(`/api/accounts/${accountId}/transactions?limit=200`);
    expect(res4.status).toBe(400);

    // Invalid transaction type
    const res5 = await request(app).get(`/api/accounts/${accountId}/transactions?type=invalid`);
    expect(res5.status).toBe(400);
  });

  // Additional: Nonexistent account history returns 404
  it('Should return 404 when querying transactions for a nonexistent account', async () => {
    const nonexistentId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/accounts/${nonexistentId}/transactions`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  // Additional: Malformed account ID returns 400
  it('Should return 400 when an invalid account ID format is supplied for history', async () => {
    const res = await request(app).get('/api/accounts/bad-account-id/transactions');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Additional: Empty transaction history returns appropriate empty structure
  it('Should return an empty transactions array when an account has no transactions', async () => {
    const emptyAccRes = await request(app).post('/api/accounts').send({ name: 'Empty User' });
    const emptyAccountId = emptyAccRes.body.data.account_id;

    const res = await request(app).get(`/api/accounts/${emptyAccountId}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactions).toEqual([]);
    expect(res.body.data.pagination).toEqual({
      currentPage: 1,
      pageSize: 10,
      totalRecords: 0,
      totalPages: 0
    });
  });
});
