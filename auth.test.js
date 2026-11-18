import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, bearer, closeDatabase, resetDatabase, signUp } from './helpers.js';
import { pool } from '../src/config/db.js';

describe('authentication', () => {
  before(resetDatabase);
  after(closeDatabase);

  it('registers a user, hashes the password and makes the first account an admin', async () => {
    const { res, body } = await signUp({ email: 'first@example.com' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'admin');
    assert.ok(res.body.accessToken);
    assert.equal(res.body.user.password_hash, undefined);

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', ['first@example.com']);
    assert.notEqual(rows[0].password_hash, body.password);
    assert.match(rows[0].password_hash, /^\$2[aby]\$/);
  });

  it('gives later accounts the staff role', async () => {
    const { res } = await signUp();
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'staff');
  });

  it('rejects invalid registration input with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'short' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Validation failed');
    const fields = res.body.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ['email', 'name', 'password']);
  });

  it('rejects a duplicate email with 409, ignoring case', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Someone', email: 'FIRST@example.com', password: 'Passw0rdOK' });
    assert.equal(res.status, 409);
  });

  it('logs in with valid credentials and rejects bad ones with the same message', async () => {
    const ok = await request(app).post('/api/auth/login').send({ email: 'first@example.com', password: 'Passw0rdOK' });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.accessToken);

    const wrongPassword = await request(app).post('/api/auth/login').send({ email: 'first@example.com', password: 'wrong-pass1' });
    const unknownUser = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'Passw0rdOK' });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownUser.status, 401);
    assert.equal(wrongPassword.body.error, unknownUser.body.error);
  });

  it('locks an account after repeated failed logins', async () => {
    const { body } = await signUp({ email: 'lock@example.com' });
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ email: body.email, password: 'wrong-pass1' });
    }
    const res = await request(app).post('/api/auth/login').send({ email: body.email, password: body.password });
    assert.equal(res.status, 429);
  });

  it('requires a valid token on protected routes', async () => {
    assert.equal((await request(app).get('/api/students')).status, 401);
    assert.equal((await request(app).get('/api/students').set(bearer('garbage'))).status, 401);
    assert.equal((await request(app).get('/api/auth/me')).status, 401);
  });

  it('returns the current user from /me', async () => {
    const { token } = await signUp({ email: 'me@example.com' });
    const res = await request(app).get('/api/auth/me').set(bearer(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'me@example.com');
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const agent = request.agent(app);
    const reg = await agent.post('/api/auth/register').send({ name: 'Rotate', email: 'rotate@example.com', password: 'Passw0rdOK' });
    const firstCookie = reg.headers['set-cookie'][0].split(';')[0];

    const refreshed = await agent.post('/api/auth/refresh');
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.body.accessToken);

    const replay = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    assert.equal(replay.status, 401);

    const afterReplay = await agent.post('/api/auth/refresh');
    assert.equal(afterReplay.status, 401);
  });

  it('revokes the refresh token on logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Bye', email: 'bye@example.com', password: 'Passw0rdOK' });
    assert.equal((await agent.post('/api/auth/logout')).status, 204);
    assert.equal((await agent.post('/api/auth/refresh')).status, 401);
  });
});
