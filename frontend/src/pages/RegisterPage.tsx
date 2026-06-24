import { Link } from 'react-router-dom'

export function RegisterPage() {
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

          <p className="max-w-xl text-sm leading-7 text-slate-600">
            Register to access the station monitoring dashboard and the operational views already provided in the backend.
          </p>

          <form className="mt-8 grid gap-5" method="post">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a2332]" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                className="w-full rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-[#0a6ebd] focus:bg-white"
                placeholder="Choose a username"
              />
              <p className="mt-2 text-xs leading-6 text-slate-500">Letters, digits and @/./+/-/_ only.</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1a2332]" htmlFor="password1">
                  Password
                </label>
                <input
                  id="password1"
                  name="password1"
                  type="password"
                  className="w-full rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-[#0a6ebd] focus:bg-white"
                  placeholder="Create password"
                />
                <p className="mt-2 text-xs leading-6 text-slate-500">At least 8 characters. Cannot be entirely numeric.</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#1a2332]" htmlFor="password2">
                  Confirm password
                </label>
                <input
                  id="password2"
                  name="password2"
                  type="password"
                  className="w-full rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-[#0a6ebd] focus:bg-white"
                  placeholder="Repeat password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-[#0a6ebd] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#084f8a]"
            >
              Create account
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
