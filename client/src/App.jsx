import { useEffect, useState, useMemo } from 'react';
import { api } from './lib/api';
import AuthView from './components/AuthView';
import Dashboard from './components/Dashboard';

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('eq_token'));
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile(activeToken) {
      try {
        setLoading(true);
        setError(null);
        const response = await api.auth.profile(activeToken);
        if (isMounted) {
          setCurrentUser(response.user);
        }
      } catch (err) {
        console.error('Failed to load profile', err);
        if (isMounted) {
          setError(err.message || '세션이 만료되었습니다. 다시 로그인해주세요.');
          setToken(null);
          localStorage.removeItem('eq_token');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (token) {
      loadProfile(token);
    } else {
      setLoading(false);
      setCurrentUser(null);
    }

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAuthSuccess = (sessionToken, user) => {
    localStorage.setItem('eq_token', sessionToken);
    setToken(sessionToken);
    setCurrentUser(user);
    setError(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('eq_token');
    setToken(null);
    setCurrentUser(null);
  };

  const contextValue = useMemo(
    () => ({
      token,
      currentUser,
      updateUser: setCurrentUser,
      logout: handleLogout,
    }),
    [token, currentUser]
  );

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>서비스를 준비하고 있어요...</p>
      </div>
    );
  }

  if (!token || !currentUser) {
    return <AuthView onSuccess={handleAuthSuccess} error={error} />;
  }

  return (
    <Dashboard
      token={token}
      currentUser={currentUser}
      onUserUpdate={setCurrentUser}
      onLogout={handleLogout}
    />
  );
}


export default App;
