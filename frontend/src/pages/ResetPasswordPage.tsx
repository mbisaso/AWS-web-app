import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (password.length < 8) return setError('Password must be at least 8 characters long.');
    if (!uid || !token) return setError('Invalid or broken recovery token parameters.');

    setIsLoading(true);
    try {
      const response = await apiClient.post('/api/password-reset-confirm/', {
        uid,
        token,
        password,
      });
      setMessage(response.data.message || 'Password updated successfully!');
      setTimeout(() => navigate('/login'), 3000); // Redirect to login after 3 seconds
    } catch (err: any) {
      setError(err.response?.data?.error || 'Link has expired or is invalid.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-mist via-white to-sky-soft/30 px-4 py-10 text-slate-900 flex items-center justify-center">
      <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-primary">AWS Monitor</p>
        <h2 className="mt-2 text-3xl font-semibold text-midnight font-display">Reset Password</h2>
        <p className="mt-2 text-sm text-storm/60">Choose a strong, brand new password for your account profile.</p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {message && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700">
              {message} Redirecting to login...
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-midnight" htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-midnight outline-none focus:border-sky-primary focus:bg-white focus:ring-2 focus:ring-sky-primary/10"
              placeholder="Minimum 8 characters"
              disabled={isLoading || !!message}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-midnight" htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-midnight outline-none focus:border-sky-primary focus:bg-white focus:ring-2 focus:ring-sky-primary/10"
              placeholder="Repeat password"
              disabled={isLoading || !!message}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !!message}
            className="w-full rounded-xl bg-gradient-to-r from-sky-primary to-sky-deep py-3 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? 'Resetting Password...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
