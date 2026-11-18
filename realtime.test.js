import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import request from 'supertest';
import { io as connect } from 'socket.io-client';
import { app, bearer, closeDatabase, resetDatabase, sampleStudent, signUp } from './helpers.js';
import { attachSocket } from '../src/realtime/socket.js';

describe('realtime events', () => {
  let server;
  let url;
  let token;

  before(async () => {
    await resetDatabase();
    ({ token } = await signUp({ email: 'live@example.com' }));
    server = http.createServer(app);
    attachSocket(server);
    await new Promise((resolve) => server.listen(0, resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await closeDatabase();
  });

  it('refuses sockets without a valid token', async () => {
    const socket = connect(url, { auth: { token: 'bad' }, reconnection: false });
    const err = await new Promise((resolve) => socket.on('connect_error', resolve));
    assert.match(err.message, /Invalid|Authentication/);
    socket.close();
  });

  it('pushes created, updated and deleted events to connected clients', async () => {
    const socket = connect(url, { auth: { token }, reconnection: false });
    await new Promise((resolve) => socket.on('connect', resolve));

    const next = (event) => new Promise((resolve) => socket.once(event, resolve));

    let pending = next('student:created');
    const created = await request(app).post('/api/students').set(bearer(token)).send(sampleStudent(1));
    const createdEvent = await pending;
    assert.equal(createdEvent.student.id, created.body.data.id);
    assert.equal(createdEvent.student.phone, undefined);

    pending = next('student:updated');
    await request(app).put(`/api/students/${created.body.data.id}`).set(bearer(token)).send(sampleStudent(1, { name: 'Changed Name' }));
    assert.equal((await pending).student.name, 'Changed Name');

    pending = next('student:deleted');
    await request(app).delete(`/api/students/${created.body.data.id}`).set(bearer(token));
    assert.equal((await pending).id, created.body.data.id);

    socket.close();
  });
});
