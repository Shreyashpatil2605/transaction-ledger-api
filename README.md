# Transaction Ledger API

A production-quality financial Transaction Ledger API built with **Node.js**, **Express.js**, and **MongoDB with Mongoose**, designed with **ACID multi-document transactions**, **strict concurrency safety**, and **precision-safe monetary arithmetic**.

---

## 1. Project Overview

The **Transaction Ledger API** provides double-entry-style immutable ledger accounting for managing account balances, processing credit/debit operations, recording atomic transfers between accounts, and retrieving paginated, filterable transaction histories.

### Key Highlights
- **Guaranteed Consistency & Atomicity**: Every balance change and ledger record insertion is executed inside a MongoDB multi-document ACID transaction.
- **Race Condition Prevention**: Employs concurrency-safe conditional atomic updates (`$gte: amount` with `$inc: -amount`) to prevent race conditions and overdrawing.
- **Precision-Safe Monetary Math**: Utilizes MongoDB's native `Decimal128` data type (IEEE 754-2008) to completely eliminate JavaScript binary floating-point rounding errors.
- **Strict Ledger Immutability**: Append-only architecture with no update or delete endpoints.
- **Idempotency Protection**: Compound database index `{ account_id: 1, reference_id: 1 }` uniquely guarantees that duplicate transaction requests are rejected without altering balances.
- **Bonus Feature Implemented**: High-assurance atomic money transfer endpoint (`POST /api/transfers`) with full rollback guarantees and duplicate prevention.

---

## 2. Technology Stack

- **Runtime**: Node.js (v18+) with native ES Modules (`"type": "module"`)
- **Web Framework**: Express.js (v5)
- **Database & ODM**: MongoDB (v6+) with Mongoose (v9)
- **Validation**: Zod schema validation
- **Configuration**: dotenv
- **Development Tooling**: Nodemon
- **Testing**: Vitest, Supertest, and `mongodb-memory-server` (in-memory replica set testing)

---

## 3. Project Structure

```text
transaction-ledger-api/
├── src/
│   ├── config/
│   │   └── db.js                       # MongoDB connection & lifecycle management
│   ├── models/
│   │   ├── Account.js                  # Account model schema with Decimal128 balance
│   │   └── Transaction.js              # Immutable Transaction model with compound unique indexes
│   ├── controllers/
│   │   ├── accountController.js        # Account HTTP request/response handlers
│   │   ├── transactionController.js    # Transaction HTTP request/response handlers
│   │   └── transferController.js       # Money transfer HTTP request/response handlers
│   ├── services/
│   │   ├── accountService.js           # Account business logic & balance retrieval
│   │   ├── transactionService.js       # Transaction business logic & ACID session execution
│   │   └── transferService.js          # Two-legged atomic money transfer logic
│   ├── routes/
│   │   ├── accountRoutes.js            # Account endpoints (/api/accounts)
│   │   ├── transactionRoutes.js        # Transaction endpoints (/api/accounts/:id/transactions)
│   │   └── transferRoutes.js           # Transfer endpoints (/api/transfers)
│   ├── validators/
│   │   ├── accountValidator.js         # Zod schemas for account creation & ID format
│   │   ├── transactionValidator.js     # Zod schemas for transactions & history pagination
│   │   └── transferValidator.js        # Zod schemas for money transfer payloads
│   ├── middleware/
│   │   ├── validateRequest.js          # Request payload/params/query validation middleware
│   │   ├── notFound.js                 # 404 handler for unmatched routes
│   │   └── errorHandler.js             # Centralized error handler with structured responses
│   ├── utils/
│   │   └── ApiError.js                 # Custom operational API error class
│   ├── app.js                          # Express application setup and route mounting
│   └── server.js                       # HTTP server entry point with graceful shutdown
├── tests/
│   ├── setup.js                        # Test database setup with in-memory replica set
│   ├── account.test.js                 # Scenarios 1–5: Account creation and balance tests
│   ├── transaction.test.js             # Scenarios 6–17: Credit, debit, validation, concurrency
│   ├── history.test.js                 # Scenarios 18–23: History, filtering, pagination, sorting
│   ├── atomicity.test.js               # Scenarios 24–25: ACID rollback verification tests
│   └── transfer.test.js                # Bonus: Money transfer atomicity and edge cases
├── .env.example                        # Environment variables template
├── .gitignore                          # Git ignore rules
├── package.json                        # Node.js project manifest & scripts
├── vitest.config.js                    # Vitest configuration
├── ASSUMPTIONS.md                      # Detailed architectural assumptions and design choices
├── API_DOCUMENTATION.md                # Comprehensive endpoint reference
└── README.md                           # Project guide and documentation
```

---

## 4. Prerequisites

- **Node.js**: `v18.0.0` or later (tested on `v24.5.0`)
- **npm**: `v9.0.0` or later
- **MongoDB**: Single-node replica set locally or a MongoDB Atlas cluster.
  *(Note: Multi-document database transactions require a MongoDB replica set. See setup instructions below).*

---

## 5. Quick Start & Installation

### Step 1: Clone and Navigate to the Repository
```bash
git clone <repository-url>
cd transaction-ledger-api
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Setup Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `MONGODB_URI` points to a MongoDB replica set:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/transaction_ledger?replicaSet=rs0
DEBUG_ERRORS=false
```

---

## 6. MongoDB Replica Set Setup

Because MongoDB multi-document transactions require replica set features, choose one of the following setups:

### Option A: Local Single-Node Replica Set (Recommended for Local Dev)

If you have MongoDB installed locally:
1. Start `mongod` with the `--replSet` flag:
   ```bash
   mongod --port 27017 --dbpath <path-to-data-directory> --replSet rs0
   ```
2. Open `mongosh` in a separate terminal:
   ```bash
   mongosh --port 27017
   ```
3. Initialize the replica set:
   ```javascript
   rs.initiate()
   ```
4. Update your `.env` file:
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/transaction_ledger?replicaSet=rs0
   ```

### Option B: Docker Container with Replica Set
```bash
docker run -d --name mongo-rs -p 27017:27017 mongo:7 mongod --replSet rs0 --bind_ip_all
docker exec -it mongo-rs mongosh --eval "rs.initiate()"
```

### Option C: MongoDB Atlas (Cloud)
1. Create a free shared M0 cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas). Atlas clusters are replica sets by default.
2. Set your connection string in `.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/transaction_ledger?retryWrites=true&w=majority
   ```

---

## 7. Running the Application

### Development Mode (with Nodemon hot-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

### Verify Service Health:
```bash
curl http://localhost:3000/health
```

---

## 8. Running Automated Tests

The test suite runs with **Vitest** and utilizes `mongodb-memory-server` to automatically provision an isolated, ephemeral single-node replica set (`MongoMemoryReplSet`). This allows testing full multi-document ACID transactions without requiring an external database cluster.

### Run all tests:
```bash
npm test
```

### Run tests in watch mode:
```bash
npm run test:watch
```

### Test Coverage Summary:
The test suite covers **37 automated test cases** encompassing all 25 assessment scenarios, edge-case validations, and bonus transfer tests:
1. **Account Tests (`account.test.js`)**:
   - Scenario 1: Create an account successfully with HTTP 201.
   - Scenario 2: Reject missing or empty account names with HTTP 400.
   - Scenario 3: Verify initial balance is always zero.
   - Scenario 4: Reject client attempts to set initial balance.
   - Scenario 5: Return HTTP 404 for nonexistent account.
   - Malformed account ID format rejection.
2. **Transaction Tests (`transaction.test.js`)**:
   - Scenario 6: Create credit transaction and update balance.
   - Scenario 7: Create debit transaction and decrease balance.
   - Scenario 8: Reject zero amount.
   - Scenario 9: Reject negative amount.
   - Scenario 10: Reject invalid transaction type.
   - Scenario 11: Reject missing/empty reference ID.
   - Scenario 12: Reject debit exceeding available balance with HTTP 409 (`INSUFFICIENT_BALANCE`).
   - Scenario 13: Ensure failed debits do not alter balance or record ledger entries.
   - Scenario 14: Reject duplicate reference ID for the same account with HTTP 409 (`DUPLICATE_TRANSACTION`).
   - Scenario 15: Permit identical reference ID across different accounts.
   - Scenario 16: Ensure duplicate requests do not increment/decrement balance twice.
   - Scenario 17: Concurrent debit race-condition safety (5 concurrent debits competing for balance without overdrawing).
   - Rejection of transactions on nonexistent accounts with HTTP 404 (credit and debit).
   - Rejection of malformed account IDs on transaction routes with HTTP 400.
   - Rejection of client-supplied server-managed fields (`balance`, `transaction_id`).
3. **Transaction History Tests (`history.test.js`)**:
   - Scenario 18: Return all transactions when type is omitted.
   - Scenario 19: Filter by credit transactions (`?type=credit`).
   - Scenario 20: Filter by debit transactions (`?type=debit`).
   - Scenario 21: Verify newest-first ordering (`created_at` descending).
   - Scenario 22: Verify pagination metadata (`currentPage`, `pageSize`, `totalRecords`, `totalPages`).
   - Scenario 23: Reject invalid pagination parameters.
   - Return HTTP 404 when querying transactions for nonexistent account.
   - Return HTTP 400 for malformed account ID.
   - Return empty transactions array with zeroed pagination for empty accounts.
4. **Atomicity Tests (`atomicity.test.js`)**:
   - Scenario 24: Verify balance update rollback when transaction creation fails.
   - Scenario 25: Verify complete multi-step transfer rollback if any ledger entry fails.
5. **Transfer Tests (`transfer.test.js`)**:
   - Bonus money transfer success with updated balances on both accounts.
   - Insufficient balance rejection.
   - Same-account transfer rejection.
   - Nonexistent destination account rejection.
   - Duplicate transfer reference rejection.

---

## 9. API Summary

| Method | Endpoint | Description | Status Code |
|---|---|---|---|
| `POST` | `/api/accounts` | Create a new ledger account | `201 Created` |
| `GET` | `/api/accounts/:id/balance` | Retrieve current account balance | `200 OK` |
| `POST` | `/api/accounts/:id/transactions` | Create credit or debit transaction | `201 Created` |
| `GET` | `/api/accounts/:id/transactions` | Query paginated transaction history | `200 OK` |
| `POST` | `/api/transfers` | Transfer funds between accounts (Bonus) | `200 OK` |
| `GET` | `/health` | Service health and uptime | `200 OK` |

*For complete curl commands, request schemas, and error responses, see [API_DOCUMENTATION.md](file:///c:/Users/91842/Desktop/Transaction%20Ledger%20API/API_DOCUMENTATION.md).*

---

## 10. Database Schema and Indexes

### Account Collection (`accounts`)
```javascript
{
  _id: ObjectId,
  name: { type: String, required: true, trim: true },
  balance: { type: Decimal128, required: true, default: 0.00 },
  created_at: { type: Date, default: Date.now, immutable: true }
}
```

### Transaction Collection (`transactions`)
```javascript
{
  _id: ObjectId,
  account_id: { type: ObjectId, ref: 'Account', required: true, index: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Decimal128, required: true },
  description: { type: String, trim: true, default: '', maxlength: 255 },
  reference_id: { type: String, required: true, trim: true },
  created_at: { type: Date, default: Date.now, immutable: true }
}
```

### Indexes Enforced
1. **Compound Unique Index**:
   ```javascript
   { account_id: 1, reference_id: 1 } (unique: true)
   ```
   Enforces idempotency per account while allowing different accounts to use the same reference ID.
2. **History Sorting Index**:
   ```javascript
   { account_id: 1, created_at: -1 }
   ```
   Optimizes transaction queries and sorting performance for high-volume accounts.

---

## 11. Atomicity & Concurrency Design

### The Problem
In financial APIs, two major concurrency hazards exist:
1. **Race Conditions**: Two simultaneous requests each attempt to withdraw $60 from an account with $100 balance. If both check the balance first and then update, the balance becomes -$20.
2. **Partial Updates**: A balance update succeeds, but an unhandled error or network failure prevents the transaction log from persisting, causing ledger divergence.

### The Solution Implemented
1. **Conditional Atomic Updates**:
   Debits execute with a conditional check directly at the database engine level:
   ```javascript
   Account.findOneAndUpdate(
     { _id: accountId, balance: { $gte: amountDecimal } },
     { $inc: { balance: negativeAmountDecimal } },
     { session, returnDocument: 'after' }
   )
   ```
   MongoDB's document write lock ensures that only one operation modifies the account at a time. If the balance is insufficient, the document is not matched and no change occurs.
2. **Mongoose Transaction Sessions**:
   Balance updates and transaction creation participate in `session.withTransaction(async () => { ... })`.
   - If writing the ledger transaction fails (e.g. duplicate reference ID or server crash), MongoDB rolls back the balance decrement automatically.
   - If transient write conflicts occur under high concurrency, MongoDB's driver retry mechanism automatically retries the transaction.

---

## 12. Assumptions and Design Decisions

Detailed architectural rationale is available in [ASSUMPTIONS.md](file:///c:/Users/91842/Desktop/Transaction%20Ledger%20API/ASSUMPTIONS.md). Key decisions include:
- **Zero Balance Baseline**: Every new account starts at 0. Clients cannot supply an initial balance.
- **Decimal128 Representation**: Avoids floating-point math issues. Amounts validated up to 2 decimal places.
- **Append-Only Immutability**: Transactions cannot be modified or deleted via API.
- **Standardized Error Envelope**: Consistent error code structure (`VALIDATION_ERROR`, `INSUFFICIENT_BALANCE`, `DUPLICATE_TRANSACTION`, `ACCOUNT_NOT_FOUND`, etc.).
- **Unauthenticated Core Engine**: As specified by the assessment, authentication is omitted so the service operates as an internal ledger core.

---

## 13. License

ISC
