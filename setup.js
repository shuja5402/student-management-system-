process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://sms:sms@localhost:5432/sms_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789-abcdefghijklmnop';
process.env.DATA_ENCRYPTION_KEY = 'test-encryption-key-0123456789-abcdefghijklmnop';
process.env.BCRYPT_ROUNDS = '4';
