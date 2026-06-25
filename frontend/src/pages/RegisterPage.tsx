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

type FieldErrors = Partial<Record<'username' | 'email' | 'first_name' | 'last_name' | 'password' | 'role' | 'non_field_errors', string[]>>

export function RegisterPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
    password2: '',
    role: 'viewer' as Role,
  })

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
        username:   form.username,
        email:      form.email || undefined,
        first_name: form.first_name || undefined,
        last_name:  form.last_name || undefined,
        password:   form.password,
        role:       form.role,
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
    `w-full rounded-2xl border bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:bg-white ${
      fieldErrors[field]?.length
        ? 'border-rose-400 focus:border-rose-500'
        : 'border-slate-200 focus:border-[#0a6ebd]'
    }`

  return (
    <div className="min-h-screen bg-[#f2f6fa] px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center justify-center">
        <div className="w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10">

          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0a6ebd] text-lg font-black text-white">A</div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0a6ebd]">WIMEA-ICT AWS</p>
              <h1 className="text-3xl font-semibold text-[#1a2332]">Create an account</h1>
            </div>
          </div>

          {globalError && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {globalError}
            </div>
          )}

          <form className="grid gap-5" onSubmit={handleSubmit} noValidate>

            {/* Name row */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1a2332]" htmlFor="first_name">
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
                <label className="mb-2 block text-sm font-medium text-[#1a2332]" htmlFor="last_name">
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

            {/* Username */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a2332]" htmlFor="username">
                Username <span className="text-rose-500">*</span>
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                className={inputClass('username')}
                placeholder="Choose a username"
                value={form.username}
                onChange={set('username')}
              />
              <p className="mt-1 text-xs text-slate-500">Letters, digits and @/./+/-/_ only.</p>
              {fieldErrors.username?.map((e) => <p key={e} className="mt-1 text-xs text-rose-600">{e}</p>)}
            </div>

            {/* Email */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a2332]" htmlFor="email">
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
                <label className="mb-2 block text-sm font-medium text-[#1a2332]" htmlFor="password">
                  Password <span className="text-rose-500">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className={inputClass('password')}
                  placeholder="Create password"
                  value={form.password}
                  onChange={set('password')}
                />
                <p className="mt-1 text-xs text-slate-500">At least 8 characters. Cannot be entirely numeric.</p>
                {fieldErrors.password?.map((e) => <p key={e} className="mt-1 text-xs text-rose-600">{e}</p>)}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1a2332]" htmlFor="password2">
                  Confirm password <span className="text-rose-500">*</span>
                </label>
                <input
                  id="password2"
                  name="password2"
                  type="password"
                  required
                  autoComplete="new-password"
                  className={`w-full rounded-2xl border bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:bg-white ${
                    form.password2 && form.password !== form.password2
                      ? 'border-rose-400 focus:border-rose-500'
                      : 'border-slate-200 focus:border-[#0a6ebd]'
                  }`}
                  placeholder="Repeat password"
                  value={form.password2}
                  onChange={set('password2')}
                />
                {form.password2 && form.password !== form.password2 && (
                  <p className="mt-1 text-xs text-rose-600">Passwords do not match.</p>
                )}
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a2332]" htmlFor="role">
                Role <span className="text-rose-500">*</span>
              </label>
              <select
                id="role"
                name="role"
                required
                className={`${inputClass('role')} cursor-pointer`}
                value={form.role}
                onChange={set('role')}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {ROLES.find((r) => r.value === form.role)?.description}
              </p>
              {fieldErrors.role?.map((e) => <p key={e} className="mt-1 text-xs text-rose-600">{e}</p>)}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 rounded-2xl bg-[#0a6ebd] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#084f8a] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-600">
            <p>
              Already have an account?{' '}
              <Link className="font-semibold text-[#0a6ebd] hover:underline" to="/login">
                Log in
              </Link>
            </p>
            <p className="mt-3">
              <Link className="font-medium text-slate-500 hover:text-[#1a2332]" to="/">
                Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
