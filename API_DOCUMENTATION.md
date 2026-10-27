# Transaction Ledger API — API Documentation

This document provides a comprehensive reference for all endpoints implemented in the Transaction Ledger API.

Base URL: `http://localhost:3000`

---

## Response Envelope Convention

All API responses follow a uniform JSON structure.

### Success Format:
```json
{
  "success": true,
  "message": "Optional descriptive message",
  "data": { ... }
}
```

### Error Format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description of the error",
    "details": [
      {
        "field": "fieldName",
        "message": "Validation message"
      }
    ]
  }
}
```

---

## 1. Accounts

### 1.1 Create Account

- **Method**: `POST`
- **URL**: `/api/accounts`
- **Purpose**: Creates a new ledger account. Initial balance is strictly set to `0.00` by the server.

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `name` | String | Yes | Name of the account holder. Non-empty string. |

> **Note**: Supplying a `balance` field or unauthorized attributes results in `HTTP 400 Bad Request`.

#### Example Request
```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Shreyash Patil"
  }'
```

#### Success Response (`HTTP 201 Created`)
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "account_id": "664b59f3c7e0f215d88691a0",
    "name": "Shreyash Patil",
    "balance": 0,
    "created_at": "2026-10-27T17:00:00.000Z"
  }
}
```

#### Error Responses
- `HTTP 400 Bad Request` — Missing or invalid name:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request data",
      "details": [
        {
          "field": "name",
          "message": "Account name cannot be empty"
        }
      ]
    }
  }
  ```
- `HTTP 400 Bad Request` — Client attempted to supply initial balance:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request data",
      "details": [
        {
          "field": "balance",
          "message": "Clients are not permitted to set the initial account balance"
        }
      ]
    }
  }
  ```

---

### 1.2 Get Account Balance

- **Method**: `GET`
- **URL**: `/api/accounts/:id/balance`
- **Purpose**: Retrieves the current settled balance for an account.

#### Path Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | String (Hex 24) | Yes | MongoDB Account ID. |

#### Example Request
```bash
curl -X GET http://localhost:3000/api/accounts/664b59f3c7e0f215d88691a0/balance
```

#### Success Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "data": {
    "account_id": "664b59f3c7e0f215d88691a0",
    "balance": 1000
  }
}
```

#### Error Responses
- `HTTP 400 Bad Request` — Malformed Account ID:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request data",
      "details": [
        {
          "field": "id",
          "message": "Invalid account ID format"
        }
      ]
    }
  }
  ```
- `HTTP 404 Not Found` — Account does not exist:
  ```json
  {
    "success": false,
    "error": {
      "code": "ACCOUNT_NOT_FOUND",
      "message": "Account with ID '664b59f3c7e0f215d88691a0' not found"
    }
  }
  ```

---

## 2. Transactions

### 2.1 Create Credit or Debit Transaction

- **Method**: `POST`
- **URL**: `/api/accounts/:id/transactions`
- **Purpose**: Creates an immutable ledger transaction (credit or debit) and updates the account balance atomically.

#### Path Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | String (Hex 24) | Yes | MongoDB Account ID. |

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `type` | String | Yes | `"credit"` or `"debit"`. |
| `amount` | Number | Yes | Positive finite number with at most 2 decimal places. |
| `reference_id` | String | Yes | Non-empty unique transaction reference for this account. |
| `description` | String | No | Optional notes or description (max 255 chars). |

#### Example Request (Credit)
```bash
curl -X POST http://localhost:3000/api/accounts/664b59f3c7e0f215d88691a0/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "credit",
    "amount": 1000,
    "description": "Initial deposit",
    "reference_id": "REF001"
  }'
```

#### Example Request (Debit)
```bash
curl -X POST http://localhost:3000/api/accounts/664b59f3c7e0f215d88691a0/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "debit",
    "amount": 300,
    "description": "Online shopping",
    "reference_id": "REF002"
  }'
```

#### Success Response (`HTTP 201 Created`)
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "transaction_id": "664b5a28c7e0f215d88691a4",
    "account_id": "664b59f3c7e0f215d88691a0",
    "type": "credit",
    "amount": 1000,
    "description": "Initial deposit",
    "reference_id": "REF001",
    "balance": 1000,
    "created_at": "2026-10-27T17:05:00.000Z"
  }
}
```

#### Error Responses
- `HTTP 400 Bad Request` — Validation Error (e.g. negative amount or invalid type):
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request data",
      "details": [
        {
          "field": "amount",
          "message": "Amount must be greater than zero"
        }
      ]
    }
  }
  ```
- `HTTP 404 Not Found` — Account does not exist:
  ```json
  {
    "success": false,
    "error": {
      "code": "ACCOUNT_NOT_FOUND",
      "message": "Account with ID '664b59f3c7e0f215d88691a0' not found"
    }
  }
  ```
- `HTTP 409 Conflict` — Insufficient balance for debit:
  ```json
  {
    "success": false,
    "error": {
      "code": "INSUFFICIENT_BALANCE",
      "message": "The account does not have sufficient balance for this debit transaction"
    }
  }
  ```
- `HTTP 409 Conflict` — Duplicate `reference_id` for this account:
  ```json
  {
    "success": false,
    "error": {
      "code": "DUPLICATE_TRANSACTION",
      "message": "A transaction with reference_id 'REF001' already exists for this account"
    }
  }
  ```

---

### 2.2 Get Transaction History

- **Method**: `GET`
- **URL**: `/api/accounts/:id/transactions`
- **Purpose**: Retrieves a paginated list of transactions for an account, sorted from newest to oldest (`created_at` descending).

#### Path Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | String (Hex 24) | Yes | MongoDB Account ID. |

#### Query Parameters
| Parameter | Type | Default | Description |
|---|---|---|---|
| `type` | String | Optional | Filter by `"credit"` or `"debit"`. Omit to return both. |
| `page` | Integer | `1` | Page number (must be `>= 1`). |
| `limit` | Integer | `10` | Records per page (must be between `1` and `100`). |

#### Example Requests
```bash
# Retrieve all transactions with default pagination (page 1, limit 10)
curl -X GET http://localhost:3000/api/accounts/664b59f3c7e0f215d88691a0/transactions

# Filter by credit transactions
curl -X GET "http://localhost:3000/api/accounts/664b59f3c7e0f215d88691a0/transactions?type=credit"

# Filter by debit transactions with custom pagination
curl -X GET "http://localhost:3000/api/accounts/664b59f3c7e0f215d88691a0/transactions?type=debit&page=1&limit=5"
```

#### Success Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transaction_id": "664b5a3ac7e0f215d88691a6",
        "account_id": "664b59f3c7e0f215d88691a0",
        "type": "debit",
        "amount": 300,
        "description": "Online shopping",
        "reference_id": "REF002",
        "created_at": "2026-10-27T17:06:00.000Z"
      },
      {
        "transaction_id": "664b5a28c7e0f215d88691a4",
        "account_id": "664b59f3c7e0f215d88691a0",
        "type": "credit",
        "amount": 1000,
        "description": "Initial deposit",
        "reference_id": "REF001",
        "created_at": "2026-10-27T17:05:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "pageSize": 10,
      "totalRecords": 2,
      "totalPages": 1
    }
  }
}
```

#### Error Responses
- `HTTP 400 Bad Request` — Invalid query parameter (e.g. invalid type or negative page):
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request data",
      "details": [
        {
          "field": "page",
          "message": "Page must be a positive integer greater than or equal to 1"
        }
      ]
    }
  }
  ```
- `HTTP 404 Not Found` — Account does not exist.

---

## 3. Money Transfer (Bonus Feature)

### 3.1 Transfer Money Between Accounts

- **Method**: `POST`
- **URL**: `/api/transfers`
- **Purpose**: Atomically debits source account, credits destination account, and writes both ledger entries within a single ACID transaction.

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `from_account_id` | String (Hex 24) | Yes | Source Account ID. |
| `to_account_id` | String (Hex 24) | Yes | Destination Account ID (must differ from `from_account_id`). |
| `amount` | Number | Yes | Positive finite number with at most 2 decimal places. |
| `reference_id` | String | Yes | Unique reference identifier for the transfer operation. |
| `description` | String | No | Optional description (max 255 chars). |

#### Example Request
```bash
curl -X POST http://localhost:3000/api/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "from_account_id": "664b59f3c7e0f215d88691a0",
    "to_account_id": "664b59f3c7e0f215d88691a1",
    "amount": 300,
    "reference_id": "TRANSFER001",
    "description": "Transfer between accounts"
  }'
```

#### Success Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "message": "Money transfer completed successfully",
  "data": {
    "reference_id": "TRANSFER001",
    "amount": 300,
    "description": "Transfer between accounts",
    "from_account": {
      "account_id": "664b59f3c7e0f215d88691a0",
      "balance": 700
    },
    "to_account": {
      "account_id": "664b59f3c7e0f215d88691a1",
      "balance": 1300
    },
    "transactions": {
      "debit_transaction_id": "664b5b01c7e0f215d88691a8",
      "credit_transaction_id": "664b5b01c7e0f215d88691a9"
    },
    "created_at": "2026-10-27T17:10:00.000Z"
  }
}
```

#### Error Responses
- `HTTP 400 Bad Request` — Source and destination accounts are identical:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request data",
      "details": [
        {
          "field": "to_account_id",
          "message": "Source and destination accounts must be different"
        }
      ]
    }
  }
  ```
- `HTTP 404 Not Found` — Account not found:
  ```json
  {
    "success": false,
    "error": {
      "code": "SOURCE_ACCOUNT_NOT_FOUND",
      "message": "Source account with ID '664b59f3c7e0f215d88691a0' not found"
    }
  }
  ```
- `HTTP 409 Conflict` — Insufficient funds in source account:
  ```json
  {
    "success": false,
    "error": {
      "code": "INSUFFICIENT_BALANCE",
      "message": "Source account does not have sufficient balance for this transfer"
    }
  }
  ```
- `HTTP 409 Conflict` — Duplicate reference ID:
  ```json
  {
    "success": false,
    "error": {
      "code": "DUPLICATE_TRANSACTION",
      "message": "A transfer or transaction with reference_id 'TRANSFER001' has already been processed"
    }
  }
  ```

---

## 4. Health Check

### 4.1 Service Health
- **Method**: `GET`
- **URL**: `/health`
- **Purpose**: Liveness and uptime check.

#### Success Response (`HTTP 200 OK`)
```json
{
  "status": "ok",
  "uptime": 128.45,
  "timestamp": "2026-10-27T17:15:00.000Z"
}
```
