import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { startTestDB, stopTestDB, clearTestDB } from './setup.js';

describe('Account API Tests', () => {
  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  // 1. Create an account successfully
  it('Scenario 1: Should create an account successfully with HTTP 201', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({ name: 'Shreyash Patil' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.account_id).toBeDefined();
    expect(res.body.data.name).toBe('Shreyash Patil');
    expect(res.body.data.balance).toBe(0);
    expect(res.body.data.created_at).toBeDefined();
  });

  // 2. Reject a missing account name
  it('Scenario 2: Should reject a missing or empty account name with HTTP 400', async () => {
    // Missing name
    const res1 = await request(app)
      .post('/api/accounts')
      .send({});
    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);
    expect(res1.body.error.code).toBe('VALIDATION_ERROR');

    // Empty string name
    const res2 = await request(app)
      .post('/api/accounts')
      .send({ name: '   ' });
    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);

    // Non-string name
    const res3 = await request(app)
      .post('/api/accounts')
      .send({ name: 12345 });
    expect(res3.status).toBe(400);
    expect(res3.body.success).toBe(false);
  });

  // 3. Ensure the initial balance is zero
  it('Scenario 3: Should ensure the initial balance is always zero', async () => {
    const createRes = await request(app)
      .post('/api/accounts')
      .send({ name: 'Alice Smith' });

    expect(createRes.status).toBe(201);
    const accountId = createRes.body.data.account_id;

    const balanceRes = await request(app).get(`/api/accounts/${accountId}/balance`);
    expect(balanceRes.status).toBe(200);
    expect(balanceRes.body.success).toBe(true);
    expect(balanceRes.body.data.account_id).toBe(accountId);
    expect(balanceRes.body.data.balance).toBe(0);
  });

  // 4. Prevent the client from setting the initial balance
  it('Scenario 4: Should prevent client from setting the initial balance', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({
        name: 'Bob Jones',
        balance: 5000
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body.error)).toContain('balance');
  });

  // 5. Return 404 for a nonexistent account
  it('Scenario 5: Should return 404 for a nonexistent account', async () => {
    const nonexistentId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/accounts/${nonexistentId}/balance`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  // Additional: Validate malformed account ID format
  it('Should return 400 when an invalid account ID format is supplied', async () => {
    const res = await request(app).get('/api/accounts/invalid-id-123/balance');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
