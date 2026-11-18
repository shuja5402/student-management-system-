import { useState } from 'react';
import { api } from '../api.js';
import Modal from './Modal.jsx';

const empty = { name: '', rollNumber: '', batch: '', course: '', email: '', phone: '' };

export default function StudentForm({ student, onClose, onSaved }) {
  const [form, setForm] = useState(student ? { ...empty, ...student, phone: student.phone || '' } : empty);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage('');
    const payload = {
      name: form.name,
      rollNumber: form.rollNumber,
      batch: form.batch,
      course: form.course,
      email: form.email,
      phone: form.phone,
    };
    try {
      if (student) await api.students.update(student.id, payload);
      else await api.students.create(payload);
      onSaved(student ? 'Record updated' : 'Student added');
    } catch (err) {
      const fieldErrors = {};
      (err.details || []).forEach((d) => {
        fieldErrors[d.field] = d.message;
      });
      setErrors(fieldErrors);
      setMessage(Object.keys(fieldErrors).length ? 'Please fix the highlighted fields.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  const field = (name, label, placeholder, extra = {}) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} value={form[name]} onChange={change} placeholder={placeholder} {...extra} />
      {errors[name] && <span className="err">{errors[name]}</span>}
    </div>
  );

  return (
    <Modal title={student ? 'Edit Student' : 'Add Student'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {field('name', 'FULL NAME *', 'e.g., Aarav Sharma', { autoFocus: true })}
        <div className="row">
          {field('rollNumber', 'ROLL NO *', 'e.g., 101')}
          {field('batch', 'BATCH *', 'e.g., 2026')}
        </div>
        {field('course', 'COURSE *', 'e.g., CSE')}
        {field('email', 'EMAIL *', 'e.g., aarav@gmail.com', { type: 'email' })}
        {field('phone', 'PHONE (optional, stored encrypted)', 'e.g., +919876543210', { type: 'tel' })}
        {message && <div className="form-error" role="alert">{message}</div>}
        <div className="foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving...' : 'Save Student'}</button>
        </div>
      </form>
    </Modal>
  );
}
