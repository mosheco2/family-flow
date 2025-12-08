const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ACCESS_EX_DEFAULT = '15m';
const REFRESH_EX_DEFAULT = '7d';

function parseEnvExpiry(envValue, fallback) {
  if (!envValue) return fallback;
  return envValue;
}

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

async function comparePassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

function issueAccessToken(payload) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = parseEnvExpiry(process.env.ACCESS_TOKEN_EXPIRES, ACCESS_EX_DEFAULT);
  return jwt.sign(payload, secret, { expiresIn });
}

function issueRefreshToken(payload) {
  const secret = process.env.JWT_REFRESH_SECRET;
  const expiresIn = parseEnvExpiry(process.env.REFRESH_TOKEN_EXPIRES, REFRESH_EX_DEFAULT);
  return jwt.sign(payload, secret, { expiresIn });
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};