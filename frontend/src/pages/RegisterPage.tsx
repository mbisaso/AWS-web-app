import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'

type Role = 'viewer' | 'farmer' | 'meteorologist' | 'admin'

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: 'viewer',        label: 'Viewer',        description: 'Read-only access to dashboards and data' },
  { value: 'farmer',        label: 'Farmer',        description: 'Access to field-level weather and soil data' },
  { value: 'meteorologist', label: 'Meteorologist', description: 'Full access to sensor data and analysis tools' },
  { value: 'admin',         label: 'Admin',         description: 'Full access including user management' },
]

type FieldErrors = Partial<Record<'email' | 'first_name' | 'last_name' | 'password' | 'non_field_errors', string[]>>

export function RegisterPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    password2: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showPassword2, setShowPassword2] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      setFieldErrors((fe) => ({ ...fe, [field]: undefined }))
      setGlobalError(null)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setGlobalError(null)

    if (form.password !== form.password2) {
      setFieldErrors({ password: ['Passwords do not match.'] })
      return
    }

    setIsLoading(true)
    try {
      await apiClient.post('/api/register/', {
        email:      form.email,
        first_name: form.first_name || undefined,
        last_name:  form.last_name || undefined,
        password:   form.password,
      })
      navigate('/login', { state: { registered: true } })
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { error?: FieldErrors | string } } }).response
      const errorData = res?.data?.error
      if (errorData && typeof errorData === 'object') {
        setFieldErrors(errorData as FieldErrors)
      } else if (typeof errorData === 'string') {
        setGlobalError(errorData)
      } else {
        setGlobalError('Registration failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = (field: keyof FieldErrors) =>
    `w-full rounded-xl border bg-slate-50/80 px-4 py-3 text-sm text-midnight outline-none transition-all duration-200 placeholder:text-storm/30 ${
      fieldErrors[field]?.length
        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
        : 'border-slate-200 focus:border-sky-primary focus:bg-white focus:ring-2 focus:ring-sky-primary/10'
    }`

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-mist via-white to-sky-soft/30 px-4 py-10 text-slate-900">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-sky-primary/10 to-sky-deep/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-tr from-sky-soft/40 to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center justify-center">
        <div className="w-full max-w-2xl rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-8 lg:p-10">

          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-primary to-sky-deep text-lg font-black text-white shadow-md shadow-sky-200/40">A</div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-primary">WIMEA-ICT AWS</p>
              <h1 className="text-3xl font-semibold text-midnight font-display">Create an account</h1>
            </div>
          </div>

          {globalError && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-rose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><circle cx="12" cy="16" r="0.5" fill="currentColor" />
              </svg>
              <p className="text-sm text-rose-700">{globalError}</p>
            </div>
          )}

          <form className="grid gap-5" onSubmit={handleSubmit} noValidate>

            {/* Name row */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-midnight" htmlFor="first_name">
                  First name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  autoComplete="given-name"
                  className={inputClass('first_name')}
                  placeholder="Jane"
                  value={form.first_name}
                  onChange={set('first_name')}
                />
                {fieldErrors.first_name?.map((e) => <p key={e} className="mt-1 text-xs text-rose-600">{e}</p>)}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-midnight" htmlFor="last_name">
                  Last name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  autoComplete="family-name"
                  className={inputClass('last_name')}
                  placeholder="Doe"
                  value={form.last_name}
                  onChange={set('last_name')}
                />
                {fieldErrors.last_name?.map((e) => <p key={e} className="mt-1 text-xs text-rose-600">{e}</p>)}
              </div>
            </div>



            {/* Email */}
            <div>
              <label className="mb-2 block text-sm font-medium text-midnight" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className={inputClass('email')}
                placeholder="jane@example.com"
                value={form.email}
                onChange={set('email')}
              />
              {fieldErrors.email?.map((e) => <p key={e} className="mt-1 text-xs text-rose-600">{e}</p>)}
            </div>

            {/* Password row */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-midnight" htmlFor="password">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    className={`${inputClass('password')} pr-11`}
                    placeholder="Create password"
                    value={form.password}
                    onChange={set('password')}
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
                <p className="mt-1 text-xs text-storm/40">At least 8 characters. Cannot be entirely numeric.</p>
                {fieldErrors.password?.map((e) => <p key={e} className="mt-1 text-xs text-rose-600">{e}</p>)}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-midnight" htmlFor="password2">
                  Confirm password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password2"
                    name="password2"
                    type={showPassword2 ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    className={`w-full rounded-xl border bg-slate-50/80 px-4 py-3 pr-11 text-sm text-midnight outline-none transition-all duration-200 placeholder:text-storm/30 ${
                      form.password2 && form.password !== form.password2
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                        : 'border-slate-200 focus:border-sky-primary focus:bg-white focus:ring-2 focus:ring-sky-primary/10'
                    }`}
                    placeholder="Repeat password"
                    value={form.password2}
                    onChange={set('password2')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword2((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1 text-storm/30 transition-colors hover:text-storm/60"
                    tabIndex={-1}
                  >
                    {showPassword2 ? (
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
                {form.password2 && form.password !== form.password2 && (
                  <p className="mt-1 text-xs text-rose-600">Passwords do not match.</p>
                )}
              </div>
            </div>



            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full cursor-pointer rounded-xl bg-gradient-to-r from-sky-primary to-sky-deep px-4 py-3 text-sm font-semibold text-white shadow-md shadow-sky-200/50 transition-all duration-200 hover:shadow-lg hover:shadow-sky-200/60 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-storm/60">
            <p>
              Already have an account?{' '}
              <Link className="font-semibold text-sky-primary transition-colors hover:text-sky-deep" to="/login">
                Log in
              </Link>
            </p>
            <p className="mt-3">
              <Link className="font-medium text-storm/40 transition-colors hover:text-midnight" to="/">
                Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
