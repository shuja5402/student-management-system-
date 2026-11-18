import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, bearer, closeDatabase, resetDatabase, sampleStudent, signUp } from './helpers.js';
import { pool } from '../src/config/db.js';

describe('students API', () => {
  let admin;
  let staff;

  before(async () => {
    await resetDatabase();
    admin = await signUp({ email: 'admin@example.com' });
    staff = await signUp({ email: 'staff@example.com' });
  });
  after(closeDatabase);

  it('creates a student and returns 201', async () => {
    const res = await request(app).post('/api/students').set(bearer(staff.token)).send(sampleStudent(1, { phone: '+919876543210' }));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.rollNumber, 'R-1');
    assert.equal(res.body.data.phone, '+919876543210');
  });

  it('stores the phone number encrypted at rest', async () => {
    const { rows } = await pool.query('SELECT phone_encrypted FROM students WHERE roll_number = $1', ['R-1']);
    assert.ok(rows[0].phone_encrypted.startsWith('v1:'));
    assert.ok(!rows[0].phone_encrypted.includes('9876543210'));
  });

  it('rejects malformed input with 400 and field details', async () => {
    const res = await request(app)
      .post('/api/students')
      .set(bearer(staff.token))
      .send({ name: '', rollNumber: '!!', batch: '', course: '', email: 'bad' });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.length >= 4);
  });

  it('rejects duplicate roll numbers and emails with 409', async () => {
    const dupRoll = await request(app).post('/api/students').set(bearer(staff.token)).send(sampleStudent(2, { rollNumber: 'r-1' }));
    assert.equal(dupRoll.status, 409);
    const dupEmail = await request(app).post('/api/students').set(bearer(staff.token)).send(sampleStudent(3, { email: 'STUDENT1@example.com' }));
    assert.equal(dupEmail.status, 409);
  });

  it('lists with search, filters, sorting and pagination', async () => {
    for (let n = 2; n <= 12; n += 1) {
      await request(app).post('/api/students').set(bearer(staff.token)).send(sampleStudent(n, { course: n % 2 ? 'ECE' : 'CSE' }));
    }
    const page1 = await request(app).get('/api/students?limit=5&sort=name&order=desc').set(bearer(staff.token));
    assert.equal(page1.status, 200);
    assert.equal(page1.body.data.length, 5);
    assert.equal(page1.body.meta.total, 12);
    assert.equal(page1.body.meta.totalPages, 3);

    const search = await request(app).get('/api/students?search=student9').set(bearer(staff.token));
    assert.equal(search.body.data.length, 1);

    const ece = await request(app).get('/api/students?course=ece').set(bearer(staff.token));
    assert.ok(ece.body.data.every((s) => s.course === 'ECE'));

    const wildcard = await request(app).get('/api/students?search=%25').set(bearer(staff.token));
    assert.equal(wildcard.body.data.length, 0);
  });

  it('does not expose phone numbers in the list view', async () => {
    const res = await request(app).get('/api/students?search=student1@').set(bearer(staff.token));
    assert.equal(res.body.data[0].phone, undefined);
  });

  it('reports dashboard stats', async () => {
    const res = await request(app).get('/api/students/stats').set(bearer(staff.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.totalStudents, 12);
    assert.equal(res.body.totalCourses, 2);
    assert.equal(res.body.totalBatches, 1);
  });

  it('fetches, updates and 404s correctly', async () => {
    const got = await request(app).get('/api/students/1').set(bearer(staff.token));
    assert.equal(got.status, 200);

    const updated = await request(app)
      .put('/api/students/1')
      .set(bearer(staff.token))
      .send(sampleStudent(1, { name: 'Renamed Student', phone: '' }));
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.name, 'Renamed Student');
    assert.equal(updated.body.data.phone, null);

    assert.equal((await request(app).get('/api/students/9999').set(bearer(staff.token))).status, 404);
    assert.equal((await request(app).put('/api/students/9999').set(bearer(staff.token)).send(sampleStudent(99))).status, 404);
    assert.equal((await request(app).get('/api/students/abc').set(bearer(staff.token))).status, 400);
  });

  it('only lets admins delete students', async () => {
    const denied = await request(app).delete('/api/students/1').set(bearer(staff.token));
    assert.equal(denied.status, 403);

    const ok = await request(app).delete('/api/students/1').set(bearer(admin.token));
    assert.equal(ok.status, 200);
    assert.equal((await request(app).delete('/api/students/1').set(bearer(admin.token))).status, 404);
  });

  it('keeps an audit trail visible to admins only', async () => {
    const forbidden = await request(app).get('/api/audit-logs').set(bearer(staff.token));
    assert.equal(forbidden.status, 403);
    const res = await request(app).get('/api/audit-logs?limit=100').set(bearer(admin.token));
    assert.equal(res.status, 200);
    const actions = new Set(res.body.data.map((a) => a.action));
    assert.ok(actions.has('create') && actions.has('update') && actions.has('delete'));
  });

  it('returns JSON 404 for unknown API routes and 400 for bad JSON', async () => {
    assert.equal((await request(app).get('/api/nope')).status, 404);
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    assert.equal(bad.status, 400);
  });

  it('reports health', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.database, 'up');
  });
});
