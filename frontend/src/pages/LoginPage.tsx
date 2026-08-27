import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      if (err?.response?.data?.error) {
        setError(typeof err.response.data.error === 'string' ? err.response.data.error : 'Invalid email or password.')
      } else if (!err?.response) {
        setError('Cannot connect to the server. Please ensure the backend is running and reachable.')
      } else {
        setError('Invalid email or password.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-mist via-white to-sky-soft/30 px-4 py-10 text-slate-900">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-sky-primary/10 to-sky-deep/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-tr from-sky-soft/40 to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/80 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm lg:grid-cols-[0.95fr_1.05fr]">
          {/* Left brand panel */}
          <aside className="hidden bg-gradient-to-br from-sky-primary via-sky-deep to-sky-primary p-8 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-xl font-black backdrop-blur-sm">A</div>
              <h1 className="mt-8 text-4xl font-semibold tracking-tight font-display">Welcome back.</h1>
              <p className="mt-4 max-w-sm text-base leading-8 text-sky-50/90">
                Sign in to review station health, weather readings, and the dashboard summary already mapped in the backend.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Secure access', 'Protected dashboard entry point'],
                ['Station control', 'Monitor live status in one place'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm transition-colors duration-200 hover:bg-white/15">
                  <p className="font-semibold">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-sky-50/85">{text}</p>
                </div>
              ))}
            </div>
          </aside>

          {/* Right form panel */}
          <section className="p-6 sm:p-8 lg:p-10">
            <div className="max-w-md">
              <div className="mb-8 lg:hidden">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-primary">AWS Monitor</p>
                <h1 className="mt-2 text-3xl font-semibold text-midnight font-display">Log in to continue</h1>
              </div>

              <div className="hidden lg:block">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-primary">AWS Monitor</p>
                <h2 className="mt-2 text-3xl font-semibold text-midnight font-display">Log in to continue</h2>
              </div>

              <p className="mt-3 text-sm leading-7 text-storm/60">
                Use your credentials to enter the monitoring dashboard
              </p>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                {justRegistered && (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" />
                    </svg>
                    <p className="text-sm text-emerald-700">Account created — log in with your new credentials.</p>
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-rose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><circle cx="12" cy="16" r="0.5" fill="currentColor" />
                    </svg>
                    <p className="text-sm text-rose-700">{error}</p>
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-midnight" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-midnight outline-none transition-all duration-200 placeholder:text-storm/30 focus:border-sky-primary focus:bg-white focus:ring-2 focus:ring-sky-primary/10"
                    placeholder="Enter email"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-midnight" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 pr-11 text-sm text-midnight outline-none transition-all duration-200 placeholder:text-storm/30 focus:border-sky-primary focus:bg-white focus:ring-2 focus:ring-sky-primary/10"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1 text-storm/30 transition-colors hover:text-storm/60"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-sky-primary to-sky-deep px-4 py-3 text-sm font-semibold text-white shadow-md shadow-sky-200/50 transition-all duration-200 hover:shadow-lg hover:shadow-sky-200/60 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : 'Sign in'}
                </button>
              </form>

              <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-storm/60">
                <p>
                  Don&apos;t have an account?{' '}
                  <Link className="font-semibold text-sky-primary transition-colors hover:text-sky-deep" to="/register">
                    Register
                  </Link>
                </p>
                <p className="mt-3">
                  <Link className="font-medium text-storm/40 transition-colors hover:text-midnight" to="/">
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
