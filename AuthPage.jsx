import { useState } from 'react';
import { api } from '../api.js';
import { CapIcon } from './Icons.jsx';

export default function AuthPage({ onAuthenticated, notice }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(notice || '');
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const switchMode = (next) => {
    setMode(next);
    setErrors({});
    setMessage('');
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage('');
    try {
      const user =
        mode === 'login'
          ? await api.login({ email: form.email, password: form.password })
          : await api.register(form);
      onAuthenticated(user);
    } catch (err) {
      const fieldErrors = {};
      (err.details || []).forEach((d) => {
        fieldErrors[d.field] = d.message;
      });
      setErrors(fieldErrors);
      setMessage(Object.keys(fieldErrors).length ? '' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand auth-brand">
          <div className="badge"><CapIcon width={24} height={24} /></div>
          <div>
            <h1>EduSystem</h1>
            <p>Student Management Portal</p>
          </div>
        </div>

        <div className="tabs" role="tablist">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>Sign in</button>
          <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => switchMode('register')}>Create account</button>
        </div>

        <form onSubmit={submit} noValidate>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="name">FULL NAME</label>
              <input id="name" name="name" value={form.name} onChange={change} placeholder="e.g., Aarav Sharma" autoComplete="name" />
              {errors.name && <span className="err">{errors.name}</span>}
            </div>
          )}
          <div className="field">
            <label htmlFor="email">EMAIL</label>
            <input id="email" name="email" type="email" value={form.email} onChange={change} placeholder="you@example.com" autoComplete="email" />
            {errors.email && <span className="err">{errors.email}</span>}
          </div>
          <div className="field">
            <label htmlFor="password">PASSWORD</label>
            <input id="password" name="password" type="password" value={form.password} onChange={change}
              placeholder={mode === 'register' ? 'At least 8 characters, letters and numbers' : 'Your password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {errors.password && <span className="err">{errors.password}</span>}
          </div>
          {message && <div className="form-error" role="alert">{message}</div>}
          <button className="btn primary block" type="submit" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        {mode === 'register' && <p className="hint">The first account created becomes the administrator.</p>}
      </div>
    </div>
  );
}
