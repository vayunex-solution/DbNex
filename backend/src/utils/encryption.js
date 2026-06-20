const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a consistent 32-byte key from the environment variable.
 */
function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY is not set in environment variables.');
  return crypto.scryptSync(key, 'dbnex-salt-vayunex', KEY_LENGTH);
}

/**
 * Encrypts a plain-text password for secure database storage.
 * @param {string} plainText - The plain text password
 * @returns {string} - base64 encoded: iv:authTag:ciphertext
 */
function encrypt(plainText) {
  if (!plainText) return '';
  
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  
  // Store: iv|authTag|ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts an encrypted credential from the database.
 * @param {string} encryptedText - The encrypted string in iv:authTag:ciphertext format
 * @returns {string} - The plain text password
 */
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  
  const key = getKey();
  const parts = encryptedText.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format.');
  }
  
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = { encrypt, decrypt };
