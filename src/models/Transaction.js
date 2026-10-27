import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Account ID is required'],
      index: true
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required'],
      enum: {
        values: ['credit', 'debit'],
        message: 'Transaction type must be either "credit" or "debit"'
      }
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: [true, 'Transaction amount is required'],
      validate: {
        validator: function (v) {
          if (!v) return false;
          return parseFloat(v.toString()) > 0;
        },
        message: 'Transaction amount must be greater than zero'
      }
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [255, 'Description cannot exceed 255 characters']
    },
    reference_id: {
      type: String,
      required: [true, 'Reference ID is required'],
      trim: true,
      minlength: [1, 'Reference ID cannot be empty']
    },
    created_at: {
      type: Date,
      default: Date.now,
      immutable: true
    }
  },
  {
    versionKey: false,
    toJSON: {
      transform: (doc, ret) => {
        ret.transaction_id = ret._id.toString();
        ret.account_id = ret.account_id.toString();
        if (ret.amount !== undefined && ret.amount !== null) {
          ret.amount = parseFloat(ret.amount.toString());
        }
        return ret;
      }
    },
    toObject: {
      transform: (doc, ret) => {
        ret.transaction_id = ret._id.toString();
        ret.account_id = ret.account_id.toString();
        if (ret.amount !== undefined && ret.amount !== null) {
          ret.amount = parseFloat(ret.amount.toString());
        }
        return ret;
      }
    }
  }
);

// Compound unique index ensuring reference_id is unique per account
// while allowing the same reference_id across different accounts
transactionSchema.index({ account_id: 1, reference_id: 1 }, { unique: true });

// Compound index for efficient transaction history listing and sorting
transactionSchema.index({ account_id: 1, created_at: -1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
