'use strict';

const crypto = require('crypto');

/**
 * AES-256-GCM encryption for uploaded resume files (SRS 5.3: encrypted at rest).
 * Stored layout: [12-byte IV][16-byte auth tag][ciphertext]
 */
function keyFromHex(hexKey) {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey || '')) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes).');
  }
  return Buffer.from(hexKey, 'hex');
}

function encrypt(buffer, hexKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFromHex(hexKey), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

function decrypt(blob, hexKey) {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const data = blob.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyFromHex(hexKey), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

module.exports = { encrypt, decrypt, sha256 };
