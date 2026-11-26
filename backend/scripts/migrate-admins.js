const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/user');
const Admin = require('../models/admin');
const AdminLoginHistory = require('../models/adminLoginHistory');

async function moveLoginHistory(db) {
  const oldAdminCollection = db.collection('atudta_admins');
  const oldLoginEvents = await oldAdminCollection.find({
    userId: { $exists: true },
    loggedInAt: { $exists: true },
    password: { $exists: false }
  }).toArray();

  for (const event of oldLoginEvents) {
    await AdminLoginHistory.collection.updateOne(
      { _id: event._id },
      {
        $setOnInsert: {
          userId: event.userId,
          email: event.email,
          loggedInAt: event.loggedInAt
        }
      },
      { upsert: true }
    );
    const savedEvent = await AdminLoginHistory.collection.findOne({ _id: event._id });
    if (!savedEvent) {
      throw new Error('Could not preserve an existing admin login record.');
    }
    await oldAdminCollection.deleteOne({ _id: event._id });
  }

  return oldLoginEvents.length;
}

async function moveAdminAccounts(db) {
  const legacyAdmins = await User.collection.find({ role: 'Admin' }).toArray();

  for (const legacyAdmin of legacyAdmins) {
    const existingById = await Admin.collection.findOne({ _id: legacyAdmin._id });
    const existingByEmail = await Admin.collection.findOne({ email: legacyAdmin.email });
    if (existingByEmail && String(existingByEmail._id) !== String(legacyAdmin._id)) {
      throw new Error('An Admin account with a different ID already uses a legacy Admin email.');
    }

    if (!existingById) {
      const adminLevel = legacyAdmin.adminLevel === 'super_admin'
        ? 'super_admin'
        : 'sub_admin';
      await Admin.create({
        _id: legacyAdmin._id,
        name: legacyAdmin.name,
        email: legacyAdmin.email,
        role: 'Admin',
        password: legacyAdmin.password,
        contactNumber: legacyAdmin.contactNumber,
        address: legacyAdmin.address,
        adminLevel,
        createdBy: legacyAdmin.createdBy || null,
        deletedAt: legacyAdmin.deletedAt || null,
        createdAt: legacyAdmin.createdAt,
        updatedAt: legacyAdmin.updatedAt
      });
    }

    const migratedAdmin = await Admin.collection.findOne({ _id: legacyAdmin._id });
    if (!migratedAdmin ||
        migratedAdmin.email !== legacyAdmin.email ||
        migratedAdmin.password !== legacyAdmin.password) {
      throw new Error('Could not verify the migrated Admin account; the original was kept.');
    }

    await User.collection.deleteOne({ _id: legacyAdmin._id, role: 'Admin' });
  }

  return legacyAdmins.length;
}

async function migrateAdmins() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is required.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const movedLoginHistory = await moveLoginHistory(db);
  const movedAdminAccounts = await moveAdminAccounts(db);
  console.log(`Moved ${movedAdminAccounts} Admin account(s) to atudta_admins.`);
  console.log(`Preserved ${movedLoginHistory} login record(s) in atudta_admin_login_history.`);
}

migrateAdmins()
  .catch(error => {
    console.error('Could not migrate Admin accounts:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
