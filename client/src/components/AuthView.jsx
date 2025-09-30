import { useState } from 'react';
import { api } from '../lib/api';

const INITIAL_FORM = {
  email: '',
  password: '',
  displayName: '',
};

function AuthView({ onSuccess, error: externalError }) {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'register' ? 'login' : 'register'));
    setError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        email: form.email.trim(),
        password: form.password,
      };

      if (mode === 'register') {
        payload.displayName = form.displayName.trim();
      }

      const response =
        mode === 'register'
          ? await api.auth.register(payload)
          : await api.auth.login(payload);

      onSuccess(response.token, response.user);
      setForm(INITIAL_FORM);
    } catch (err) {
      console.error('Auth error', err);
      setError(err.message || '문제가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Empty Queue</h1>
        <p className="auth-subtitle">
          딥워크와 어드민 업무를 구분하고, 게임처럼 성장하세요.
        </p>

        <div className="auth-toggle">
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
          >
            회원가입
          </button>
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            로그인
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              표시 이름
              <input
                type="text"
                name="displayName"
                value={form.displayName}
                placeholder="예: Alex"
                onChange={handleInputChange}
                required
                disabled={submitting}
              />
            </label>
          )}

          <label>
            이메일
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleInputChange}
              required
              disabled={submitting}
            />
          </label>

          <label>
            비밀번호
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleInputChange}
              required
              minLength={6}
              disabled={submitting}
            />
          </label>

          {(error || externalError) && (
            <p className="auth-error">{error || externalError}</p>
          )}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? '처리 중...' : mode === 'register' ? '회원가입 후 시작하기' : '로그인'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'register' ? '이미 계정이 있나요?' : '아직 계정이 없나요?'}
          <button type="button" onClick={toggleMode} disabled={submitting}>
            {mode === 'register' ? '로그인' : '회원가입'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default AuthView;
