import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'backend', '.env');
const example = path.join(root, 'backend', '.env.example');

if (fs.existsSync(target)) {
  console.log('backend/.env already exists, leaving it untouched');
  process.exit(0);
}

const secret = () => crypto.randomBytes(48).toString('base64url');
const content = fs
  .readFileSync(example, 'utf8')
  .replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${secret()}`)
  .replace(/^DATA_ENCRYPTION_KEY=.*$/m, `DATA_ENCRYPTION_KEY=${secret()}`);

fs.writeFileSync(target, content, { mode: 0o600 });
console.log('Created backend/.env with freshly generated secrets.');
console.log('Edit DATABASE_URL in that file if your PostgreSQL credentials differ.');
