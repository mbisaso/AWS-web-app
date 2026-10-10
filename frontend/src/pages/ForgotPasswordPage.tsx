import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!email.trim()) return setError('Please enter your email address.');

    setIsLoading(true);
    try {
      const response = await apiClient.post('/api/password-reset/', {
        email: email.trim(),
      });
      setMessage(response.data.message || 'Recovery link sent check terminal log.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request password reset. Try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-mist via-white to-sky-soft/30 px-4 py-10 text-slate-900 flex items-center justify-center">
      <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-primary">AWS Monitor</p>
        <h2 className="mt-2 text-3xl font-semibold text-midnight font-display">Recover Password</h2>
        <p className="mt-2 text-sm text-storm/60">Enter your email address to receive a secure password recovery link.</p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {message && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-midnight" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-midnight outline-none focus:border-sky-primary focus:bg-white focus:ring-2 focus:ring-sky-primary/10"
              placeholder="name@example.com"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-gradient-to-r from-sky-primary to-sky-deep py-3 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? 'Sending Link...' : 'Send Recovery Link'}
          </button>

          <div className="text-center mt-4">
            <Link to="/login" className="text-sm font-medium text-sky-primary hover:underline">Back to Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
