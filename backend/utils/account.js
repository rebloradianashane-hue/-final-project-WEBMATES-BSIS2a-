const crypto = require('crypto');
const { promisify } = require('util');
const User = require('../models/user');

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

async function verifyPassword(password, storedPassword) {
  const [algorithm, salt, storedKey] = String(storedPassword || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !storedKey || !/^[a-f0-9]{128}$/i.test(storedKey)) {
    return false;
  }

  const key = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(key, Buffer.from(storedKey, 'hex'));
}

function isValidBirthdate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const birthdate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(birthdate.getTime()) || birthdate.toISOString().slice(0, 10) !== value) {
    return false;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return birthdate <= today;
}

async function createAccount(account) {
  const user = new User({
    ...account,
    email: account.email.trim().toLowerCase(),
    password: await hashPassword(account.password)
  });
  return user.save();
}

function publicAccount(user) {
  const account = user.toObject ? user.toObject() : { ...user };
  const { _id, password, __v, ...safeAccount } = account;
  return {
    ...safeAccount,
    id: String(_id || account.id),
    contact: safeAccount.contactNumber
  };
}

module.exports = { createAccount, hashPassword, isValidBirthdate, publicAccount, verifyPassword };