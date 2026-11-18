import { useCallback, useEffect, useState } from 'react';
import { api, refreshSession, setSessionExpiredHandler } from './api.js';
import AuthPage from './components/AuthPage.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setNotice('Your session expired. Please sign in again.');
    });
    refreshSession()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setNotice('');
  }, []);

  if (booting) return <div className="boot">Loading...</div>;
  if (!user) return <AuthPage notice={notice} onAuthenticated={(u) => { setNotice(''); setUser(u); }} />;
  return <Dashboard user={user} onLogout={logout} />;
}
