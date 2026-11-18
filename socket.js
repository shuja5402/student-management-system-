import { io } from 'socket.io-client';
import { getToken } from './api.js';

export function connectSocket({ onPresence, onStudentEvent, onStatus }) {
  const socket = io({
    auth: (cb) => cb({ token: getToken() }),
    reconnectionDelayMax: 5000,
  });
  socket.on('connect', () => onStatus(true));
  socket.on('disconnect', () => onStatus(false));
  socket.on('connect_error', () => onStatus(false));
  socket.on('presence', onPresence);
  ['student:created', 'student:updated', 'student:deleted'].forEach((name) =>
    socket.on(name, (payload) => onStudentEvent(name, payload))
  );
  return () => socket.close();
}
