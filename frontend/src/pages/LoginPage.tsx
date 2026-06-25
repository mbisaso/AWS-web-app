import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const justRegistered = (location.state as { registered?: boolean } | null)?.registered === true

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch {
      setError('Invalid username or password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f2f6fa] px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)] lg:grid-cols-[0.95fr_1.05fr]">
          <aside className="hidden bg-gradient-to-br from-[#0a6ebd] to-[#084f8a] p-8 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-xl font-black">A</div>
              <h1 className="mt-8 text-4xl font-semibold tracking-tight">Welcome back.</h1>
              <p className="mt-4 max-w-sm text-base leading-8 text-sky-50/90">
                Sign in to review station health, weather readings, and the dashboard summary already mapped in the backend.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Secure access', 'Protected dashboard entry point'],
                ['Station control', 'Monitor live status in one place'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-3xl border border-white/15 bg-white/10 p-4">
                  <p className="font-semibold">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-sky-50/85">{text}</p>
                </div>
              ))}
            </div>
          </aside>

          <section className="p-6 sm:p-8 lg:p-10">
            <div className="max-w-md">
              <div className="mb-8 lg:hidden">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0a6ebd]">AWS Monitor</p>
                <h1 className="mt-2 text-3xl font-semibold text-[#1a2332]">Log in to continue</h1>
              </div>

              <div className="hidden lg:block">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0a6ebd]">AWS Monitor</p>
                <h2 className="mt-2 text-3xl font-semibold text-[#1a2332]">Log in to continue</h2>
              </div>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                Use your credentials to enter the monitoring dashboard.
              </p>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                {justRegistered && (
                  <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    Account created — log in with your new credentials.
                  </p>
                )}
                {error && (
                  <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1a2332]" htmlFor="username">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-[#0a6ebd] focus:bg-white"
                    placeholder="Enter username"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1a2332]" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-[#0a6ebd] focus:bg-white"
                    placeholder="Enter password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-[#0a6ebd] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#084f8a] disabled:opacity-60"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-600">
                <p>
                  Don&apos;t have an account?{' '}
                  <Link className="font-semibold text-[#0a6ebd] hover:underline" to="/register">
                    Register
                  </Link>
                </p>
                <p className="mt-3">
                  <Link className="font-medium text-slate-500 hover:text-[#1a2332]" to="/">
                    Back to home
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
