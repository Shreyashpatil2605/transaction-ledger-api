import { MongoMemoryReplSet } from 'mongodb-memory-server';

async function main() {
  try {
    const replSet = await MongoMemoryReplSet.create({
      instanceOpts: [{ port: 27017 }],
      replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' }
    });
    console.log('ReplSet started on URI:', replSet.getUri());
    await replSet.stop();
    console.log('Stopped.');
  } catch (err) {
    console.error('Failed:', err.message);
  }
}
main();
