/**
 * Seeds an admin account plus realistic demo doctors and patients.
 *   npm run seed                 # 50 doctors, 2000 patients (wipes doctors/patients)
 *   npm run seed -- --doctors=10 --patients=200
 */
import { CONDITIONS, GENDERS, PATIENT_STATUSES, SPECIALIZATIONS } from '@doctor-tracker/shared';
import { faker } from '@faker-js/faker';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { connectDatabase, disconnectDatabase } from '../db/connect';
import { Doctor } from '../models/doctor.model';
import { Patient } from '../models/patient.model';
import { User } from '../models/user.model';
import { hashPassword } from '../modules/auth/auth.service';

const HOSPITALS = [
  'City General Hospital',
  "St. Mary's Medical Center",
  'Riverside Clinic',
  'Northview Health',
  'Green Valley Hospital',
  'Lakeside Medical Institute',
  'Sunrise Children’s Hospital',
  'Metro Heart Center',
];

function arg(name: string, fallback: number): number {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match ? Number(match.split('=')[1]) : fallback;
}

const phone = () =>
  `+1 ${faker.string.numeric(3)}-${faker.string.numeric(3)}-${faker.string.numeric(4)}`;

async function seed() {
  const doctorCount = arg('doctors', 50);
  const patientCount = arg('patients', 2000);
  faker.seed(42);

  await connectDatabase(env.MONGODB_URI);
  await Promise.all([User.syncIndexes(), Doctor.syncIndexes(), Patient.syncIndexes()]);

  // Admin (idempotent)
  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  await User.updateOne(
    { email: env.SEED_ADMIN_EMAIL.toLowerCase() },
    { $set: { name: env.SEED_ADMIN_NAME, passwordHash, role: 'admin' } },
    { upsert: true },
  );
  logger.info(`Admin ready: ${env.SEED_ADMIN_EMAIL}`);

  await Promise.all([Doctor.deleteMany({}), Patient.deleteMany({})]);

  const now = Date.now();
  const yearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000);

  const doctors = Array.from({ length: doctorCount }, (_, i) => {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    const createdAt = faker.date.between({ from: yearAgo, to: new Date(now) });
    return {
      _id: new Types.ObjectId(),
      name: `${first} ${last}`, // "Dr." is added by the UI
      specialization: faker.helpers.arrayElement(SPECIALIZATIONS),
      hospital: faker.helpers.arrayElement(HOSPITALS),
      phone: phone(),
      email: `${first}.${last}.${i}@doctortracker.dev`.toLowerCase().replace(/[^a-z0-9.@]/g, ''),
      patientCount: 0,
      createdAt,
      updatedAt: createdAt,
    };
  });

  // Skewed distribution so "patients per doctor" is interesting: some doctors are much busier,
  // and doctors who joined earlier have had more time to accumulate patients.
  const weights = doctors.map((d) => {
    const tenureDays = Math.max(1, (now - d.createdAt.getTime()) / 86_400_000);
    return faker.number.int({ min: 1, max: 10 }) ** 2 * tenureDays;
  });
  const counts = new Map<string, number>();

  const patients = Array.from({ length: patientCount }, () => {
    const doctor = faker.helpers.weightedArrayElement(
      doctors.map((d, i) => ({ value: d, weight: weights[i]! })),
    );
    // Visits can only happen after the doctor joined; recent months are busier.
    const visitDate = faker.date.between({ from: doctor.createdAt, to: new Date(now) });
    counts.set(doctor._id.toString(), (counts.get(doctor._id.toString()) ?? 0) + 1);
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    return {
      name: `${first} ${last}`,
      age: faker.number.int({ min: 1, max: 95 }),
      gender: faker.helpers.weightedArrayElement([
        { value: GENDERS[0], weight: 48 },
        { value: GENDERS[1], weight: 48 },
        { value: GENDERS[2], weight: 4 },
      ]),
      phone: phone(),
      email: faker.datatype.boolean(0.8)
        ? faker.internet.email({ firstName: first, lastName: last }).toLowerCase()
        : undefined,
      condition: faker.helpers.arrayElement(CONDITIONS),
      status: faker.helpers.weightedArrayElement([
        { value: PATIENT_STATUSES[0], weight: 60 },
        { value: PATIENT_STATUSES[1], weight: 32 },
        { value: PATIENT_STATUSES[2], weight: 8 },
      ]),
      doctor: doctor._id,
      visitDate,
      notes: faker.datatype.boolean(0.4) ? faker.lorem.sentence() : undefined,
      createdAt: visitDate,
      updatedAt: visitDate,
    };
  });

  for (const doctor of doctors) doctor.patientCount = counts.get(doctor._id.toString()) ?? 0;

  // Raw driver inserts keep the historical createdAt values (Mongoose would overwrite them).
  await Doctor.collection.insertMany(doctors);
  for (let i = 0; i < patients.length; i += 1000) {
    await Patient.collection.insertMany(patients.slice(i, i + 1000).map(compact));
  }

  logger.info(`Seeded ${doctors.length} doctors and ${patients.length} patients`);
  logger.info(`Login with ${env.SEED_ADMIN_EMAIL} / ${env.SEED_ADMIN_PASSWORD}`);
}

/** Drops `undefined` optional fields so the raw driver doesn't store them as null. */
function compact<T extends Record<string, unknown>>(doc: T): T {
  return Object.fromEntries(Object.entries(doc).filter(([, v]) => v !== undefined)) as T;
}

seed()
  .catch((error) => {
    logger.fatal({ err: error }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
