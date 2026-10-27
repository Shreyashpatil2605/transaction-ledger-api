# Assumptions & Architecture Decisions

This document details the architectural choices, data integrity assumptions, and design rationale for the **Transaction Ledger API**.

---

## 1. Core Architectural Assumptions

### 1.1 Account Identifiers
- **Server-Managed Identifiers**: Account IDs are generated strictly by the database server as 24-character hexadecimal MongoDB ObjectIds (`_id`).
- **Input Validation**: Any client-supplied account ID in URL path parameters or request bodies must conform to the 24-character hexadecimal format. Non-conforming IDs are rejected upfront with `HTTP 400 Bad Request` (`VALIDATION_ERROR` or `INVALID_ID`).
- **Client Overrides Prohibited**: Clients cannot specify or override the `_id` or `account_id` field.

### 1.2 Initial Account Balances
- **Guaranteed Zero Baseline**: Every newly created account always starts with a balance of exactly zero (`0.00`).
- **Rejection of Initial Balance**: If a client includes a `balance` field in `POST /api/accounts`, the request is strictly rejected with `HTTP 400 Bad Request` (`VALIDATION_ERROR`).
- **No Direct Mutation**: No API endpoint allows directly overwriting or setting an account balance. All balance modifications must originate through committed ledger transactions.

### 1.3 Precision-Safe Monetary Representation
- **Avoidance of Binary Floating-Point Errors**: Standard IEEE 754 floating-point numbers in JavaScript suffer from rounding artifacts (e.g., `0.1 + 0.2 = 0.30000000000000004`).
- **Chosen Representation**: The database utilizes MongoDB's native `Decimal128` data type for all monetary balances and transaction amounts.
- **Validation**: Incoming monetary amounts are validated with Zod to ensure they are finite, strictly positive (`> 0`), and have at most two decimal places (cents/paise precision).
- **Atomic Math in Database Engine**: Increments and decrements are performed directly within MongoDB using `$inc: { balance: Decimal128 }`, completely eliminating in-memory floating-point calculation errors.
- **Serialization**: In API responses, amounts and balances are parsed to standard numbers for JSON interoperability while preserving precision.

### 1.4 Ledger Immutability
- **Append-Only Ledger**: Transactions represent historical events that have already occurred. Once created and committed, a transaction record is strictly immutable.
- **No Update or Delete Endpoints**: The API provides no `PUT`, `PATCH`, or `DELETE` routes for `/api/accounts/:id/transactions` or `/api/transfers`.
- **Audit Trail**: Any subsequent adjustments must be made by creating corresponding offsetting ledger transactions.

### 1.5 Idempotency and Reference ID Scope
- **Unique Per Account**: Transaction `reference_id` is unique *within the scope of an individual account*. This is enforced via a compound unique database index:
  ```javascript
  { account_id: 1, reference_id: 1 } (unique: true)
  ```
- **Cross-Account Reuse**: The same `reference_id` may safely be used across different accounts without conflict.
- **Duplicate Prevention**: If a client submits a transaction with an existing `reference_id` for that account, the request fails with `HTTP 409 Conflict` (`DUPLICATE_TRANSACTION`), ensuring that network retries or accidental double submissions never duplicate financial effects.

### 1.6 Concurrency & Atomicity Guarantees
- **Conditional Atomic Decrement**: For debits and transfers, account balances are updated conditionally using:
  ```javascript
  Account.findOneAndUpdate(
    { _id: accountId, balance: { $gte: amountDecimal } },
    { $inc: { balance: negativeAmountDecimal } },
    { session, returnDocument: 'after' }
  )
  ```
  This guarantees that race conditions between concurrent requests cannot cause an account balance to drop below zero.
- **ACID Database Transactions**: Account balance adjustments and ledger record insertions participate in the same MongoDB multi-document transaction session. If any operation fails or encounters an unhandled exception, the entire session aborts and rolls back all database modifications.
- **Replica Set Prerequisite**: MongoDB multi-document transactions require a replica set (or sharded cluster). In development and production, a replica set connection is mandatory. For automated testing, an in-memory single-node replica set (`MongoMemoryReplSet`) is provisioned dynamically.

### 1.7 Money Transfer Architecture (Bonus Feature)
- **Atomic Two-Legged Operation**: The `/api/transfers` endpoint executes source account debit, destination account credit, and both transaction ledger entries (debit for source, credit for destination) within a single ACID transaction.
- **Account Disjointness**: A user cannot transfer funds to the same account (`from_account_id !== to_account_id`).
- **Transfer Reference Scope**: The transfer's `reference_id` is applied to both ledger entries. If the source account has already processed this `reference_id`, the duplicate is rejected with `HTTP 409 Conflict`, guaranteeing end-to-end idempotency.

### 1.8 Authentication and Authorization
- **Design Decision**: Authentication (e.g., JWT, OAuth, or API keys) is deliberately excluded from this version because it was not required by the assessment specification. The service functions as an internal core ledger engine. Authentication and authorization can be added as upstream middleware or at an API Gateway layer.

---

## 2. Error Response Convention

All errors follow a standardized, predictable contract:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable explanation of what went wrong",
    "details": [] // Optional array for validation failure details
  }
}
```

HTTP status codes map directly to semantic errors:
- `400 Bad Request`: Validation failure, missing fields, malformed ID, or invalid query parameters.
- `404 Not Found`: Target account does not exist.
- `409 Conflict`: Insufficient balance or duplicate transaction reference ID.
- `500 Internal Server Error`: Unhandled internal database or server error. Stack traces and database internals are suppressed in production.
- `503 Service Unavailable`: Database connection or network timeout.
