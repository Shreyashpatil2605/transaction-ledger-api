import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
      minlength: [1, 'Account name cannot be empty']
    },
    balance: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
      // Prevent balance from ever being saved as negative in database
      validate: {
        validator: function (v) {
          if (!v) return false;
          return parseFloat(v.toString()) >= 0;
        },
        message: 'Account balance cannot be negative'
      }
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
        ret.account_id = ret._id.toString();
        if (ret.balance !== undefined && ret.balance !== null) {
          ret.balance = parseFloat(ret.balance.toString());
        }
        return ret;
      }
    },
    toObject: {
      transform: (doc, ret) => {
        ret.account_id = ret._id.toString();
        if (ret.balance !== undefined && ret.balance !== null) {
          ret.balance = parseFloat(ret.balance.toString());
        }
        return ret;
      }
    }
  }
);

export const Account = mongoose.model('Account', accountSchema);
