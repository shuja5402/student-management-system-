import './setup.js';
import request from 'supertest';
import { pool } from '../src/config/db.js';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';

export const app = createApp();

export async function resetDatabase() {
  await migrate();
  await pool.query('TRUNCATE audit_logs, refresh_tokens, students, users RESTART IDENTITY CASCADE');
}

export async function closeDatabase() {
  await pool.end();
}

export async function signUp(overrides = {}) {
  const body = { name: 'Test User', email: `user${Math.random().toString(36).slice(2, 8)}@example.com`, password: 'Passw0rdOK', ...overrides };
  const res = await request(app).post('/api/auth/register').send(body);
  return { res, body, token: res.body.accessToken, cookie: res.headers['set-cookie'] };
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

export const sampleStudent = (n = 1, extra = {}) => ({
  name: `Student ${n}`,
  rollNumber: `R-${n}`,
  batch: '2026',
  course: 'CSE',
  email: `student${n}@example.com`,
  ...extra,
});
