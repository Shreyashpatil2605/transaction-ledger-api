import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Account } from '../src/models/Account.js';
import { Transaction } from '../src/models/Transaction.js';

let replSet;

export const startTestDB = async () => {
  if (replSet) return;
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  const uri = replSet.getUri();
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: true
  });

  // Ensure all database indexes (especially compound unique index) are completely built
  await Account.init();
  await Transaction.init();
};

export const stopTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
};

export const clearTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
};
