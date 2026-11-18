import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { connectSocket } from '../socket.js';
import Modal from './Modal.jsx';
import StudentForm from './StudentForm.jsx';
import { BookIcon, CalendarIcon, CapIcon, EditIcon, EyeIcon, LogoutIcon, SearchIcon, TrashIcon, UserPlusIcon, UsersIcon } from './Icons.jsx';

const COLUMNS = [
  ['id', 'ID'],
  ['name', 'NAME'],
  ['rollNumber', 'ROLL NO'],
  ['course', 'COURSE'],
  ['batch', 'BATCH'],
  ['email', 'EMAIL'],
];

export default function Dashboard({ user, onLogout }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [stats, setStats] = useState({ totalStudents: 0, totalCourses: 0, totalBatches: 0 });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'id', order: 'asc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [live, setLive] = useState({ connected: false, online: 0 });
  const reload = useRef(() => {});

  const toast = useCallback((message, kind = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const load = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([
        api.students.list({ search: query, page, limit: 10, sort: sort.key, order: sort.order }),
        api.students.stats(),
      ]);
      setRows(list.data);
      setMeta(list.meta);
      setStats(s);
      setError('');
      if (list.data.length === 0 && list.meta.page > 1) setPage(list.meta.totalPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [query, page, sort]);

  reload.current = load;
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let timer;
    const close = connectSocket({
      onStatus: (connected) => setLive((l) => ({ ...l, connected })),
      onPresence: ({ online }) => setLive((l) => ({ ...l, online })),
      onStudentEvent: (name, payload) => {
        clearTimeout(timer);
        timer = setTimeout(() => reload.current(), 250);
        if (payload.by !== user.id) {
          const verb = { 'student:created': 'added', 'student:updated': 'updated', 'student:deleted': 'removed' }[name];
          const who = payload.student ? payload.student.name : `record #${payload.id}`;
          toast(`${who} was ${verb} by another user`, 'info');
        }
      },
    });
    return () => { clearTimeout(timer); close(); };
  }, [user.id, toast]);

  const sortBy = (key) => {
    setSort((s) => (s.key === key ? { key, order: s.order === 'asc' ? 'desc' : 'asc' } : { key, order: 'asc' }));
    setPage(1);
  };

  async function openView(student) {
    try {
      const { data } = await api.students.get(student.id);
      setModal({ type: 'view', student: data });
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function openEdit(student) {
    try {
      const { data } = await api.students.get(student.id);
      setModal({ type: 'form', student: data });
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function confirmDelete() {
    const { student } = modal;
    try {
      await api.students.remove(student.id);
      setModal(null);
      toast('Record permanently deleted');
      load();
    } catch (err) {
      setModal(null);
      toast(err.message, 'error');
    }
  }

  const saved = (message) => { setModal(null); toast(message); load(); };
  const isAdmin = user.role === 'admin';

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <div className="badge"><CapIcon width={24} height={24} /></div>
          <div>
            <h1>EduSystem</h1>
            <p>Student Management Portal</p>
          </div>
        </div>
        <div className="top-actions">
          <span className={`live${live.connected ? ' on' : ''}`} title="Realtime connection">
            <i /> {live.connected ? `Live${live.online ? ` · ${live.online} online` : ''}` : 'Offline'}
          </span>
          <span className="who">{user.name} <em>{user.role}</em></span>
          <button className="btn" onClick={onLogout}><LogoutIcon /> Logout</button>
          <button className="btn primary" onClick={() => setModal({ type: 'form', student: null })}>
            <UserPlusIcon /> + Add Student
          </button>
        </div>
      </header>

      <section className="stats">
        <Stat label="TOTAL STUDENTS" value={stats.totalStudents} icon={<UsersIcon width={22} height={22} />} />
        <Stat label="TOTAL COURSES" value={stats.totalCourses} icon={<BookIcon width={22} height={22} />} />
        <Stat label="TOTAL BATCHES" value={stats.totalBatches} icon={<CalendarIcon width={22} height={22} />} />
      </section>

      <div className="card bar">
        <div className="search">
          <SearchIcon />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, roll no, email..." aria-label="Search students" />
        </div>
        <div className="count">Showing <b>{meta.total}</b> records</div>
      </div>

      <div className="card table-card">
        {error && <div className="form-error" style={{ margin: 16 }}>{error}</div>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {COLUMNS.map(([key, label]) => (
                  <th key={key} onClick={() => sortBy(key)} className="sortable" aria-sort={sort.key === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {label}{sort.key === key ? (sort.order === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
                <th className="r">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="muted">#{s.id}</td>
                  <td className="strong">{s.name}</td>
                  <td className="blue">{s.rollNumber}</td>
                  <td>{s.course}</td>
                  <td>{s.batch}</td>
                  <td className="soft">{s.email}</td>
                  <td className="r">
                    <span className="acts">
                      <button className="icon-btn" title="View" aria-label={`View ${s.name}`} onClick={() => openView(s)}><EyeIcon /></button>
                      <button className="icon-btn" title="Edit" aria-label={`Edit ${s.name}`} onClick={() => openEdit(s)}><EditIcon /></button>
                      {isAdmin && (
                        <button className="icon-btn danger" title="Delete" aria-label={`Delete ${s.name}`} onClick={() => setModal({ type: 'delete', student: s })}><TrashIcon /></button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <div className="empty">No student records found.</div>}
          {loading && <div className="empty">Loading students...</div>}
        </div>
        {meta.totalPages > 1 && (
          <div className="pager">
            <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {meta.page} of {meta.totalPages}</span>
            <button className="btn" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>

      {modal?.type === 'form' && <StudentForm student={modal.student} onClose={() => setModal(null)} onSaved={saved} />}

      {modal?.type === 'view' && (
        <Modal title="Student Details" onClose={() => setModal(null)}>
          <dl className="detail">
            <dt>ID</dt><dd>#{modal.student.id}</dd>
            <dt>FULL NAME</dt><dd>{modal.student.name}</dd>
            <dt>ROLL NO</dt><dd>{modal.student.rollNumber}</dd>
            <dt>COURSE</dt><dd>{modal.student.course}</dd>
            <dt>BATCH</dt><dd>{modal.student.batch}</dd>
            <dt>EMAIL</dt><dd>{modal.student.email}</dd>
            <dt>PHONE</dt><dd>{modal.student.phone || 'Not provided'}</dd>
            <dt>ADDED</dt><dd>{new Date(modal.student.createdAt).toLocaleString()}</dd>
          </dl>
          <div className="foot"><button className="btn" onClick={() => setModal(null)}>Close</button></div>
        </Modal>
      )}

      {modal?.type === 'delete' && (
        <Modal title="Delete Student Record?" onClose={() => setModal(null)}>
          <p className="warn">This will permanently delete the record of <b>{modal.student.name}</b>. This action cannot be undone.</p>
          <div className="foot">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn danger" onClick={confirmDelete}>Delete</button>
          </div>
        </Modal>
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.message}</div>)}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="card stat">
      <div><small>{label}</small><b>{value}</b></div>
      <div className="ico">{icon}</div>
    </div>
  );
}
