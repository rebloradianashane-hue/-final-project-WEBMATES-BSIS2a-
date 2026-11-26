const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const mongoose = require('mongoose');
const Admin = require('../models/admin');
const User = require('../models/user');
const { createAdminAccount, hashPassword } = require('../utils/account');

const adminDetails = {
  name: process.env.ADMIN_NAME || 'ATUDTA Admin',
  email: (process.env.ADMIN_EMAIL || 'admin@atudta.com').trim().toLowerCase(),
  contactNumber: process.env.ADMIN_CONTACT_NUMBER || '09000000000',
  address: process.env.ADMIN_ADDRESS || 'Polangui, Albay',
  role: 'Admin',
  adminLevel: 'super_admin'
};

async function seedAdmin() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is required.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const legacyAdmin = await User.findOne({
    email: adminDetails.email,
    role: 'Admin'
  });
  if (legacyAdmin) {
    throw new Error('Run scripts/migrate-admins.js before seeding the Admin account.');
  }

  const existingAdmin = await Admin.findOne({ email: adminDetails.email }).select('+password');
  if (existingAdmin) {
    existingAdmin.adminLevel = 'super_admin';
    existingAdmin.createdBy = null;
    if (process.env.ADMIN_PASSWORD) {
      existingAdmin.password = await hashPassword(process.env.ADMIN_PASSWORD);
    }
    await existingAdmin.save();
    console.log(`Admin account is already ready: ${adminDetails.email}`);
    return;
  }

  const temporaryPassword = process.env.ADMIN_PASSWORD ||
    `${crypto.randomBytes(6).toString('base64').replace(/[^A-Za-z0-9]/g, '')}A1`;

  await createAdminAccount({
    ...adminDetails,
    password: temporaryPassword
  });

  console.log(`Admin account created: ${adminDetails.email}`);
  console.log(`Temporary password: ${temporaryPassword}`);
  console.log('Change this password after the first login.');
}

seedAdmin()
  .catch(error => {
    console.error('Could not create the admin account:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
