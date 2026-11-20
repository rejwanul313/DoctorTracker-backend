import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';
// Imported for their side effect of registering the models on the default connection.
import '../models/doctor.model';
import '../models/patient.model';
import '../models/user.model';

// Each test file gets its own database so files can run in parallel without interfering.
beforeAll(async () => {
  await mongoose.connect(inject('mongoUri'), { dbName: `test-${randomUUID()}` });
  // Text indexes must exist for $text queries, so build every index up front.
  await mongoose.connection.syncIndexes();
});

afterEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
