import { useState, useEffect } from 'react'
import { MenuIcon, CloseIcon } from './Icons'

const navigationLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Platform', href: '#platform' },
  { label: 'Access', href: '#access' },
] as const

export function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setHasScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        hasScrolled
          ? 'border-b border-sky-100/80 bg-white/80 shadow-xs backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        {/* ── Brand ── */}
        <a href="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-primary to-sky-deep text-lg font-black text-white shadow-lg shadow-sky-200/50 transition-transform duration-300 group-hover:scale-105">
            A
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-sky-primary uppercase transition-colors duration-300 group-hover:text-sky-deep">
              AWS Monitor
            </p>
            <p className="text-xs text-storm/60">WIMEA-ICT weather network</p>
          </div>
        </a>

        {/* ── Desktop nav links ── */}
        <ul className="hidden items-center gap-1 md:flex">
          {navigationLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-storm/70 transition-colors duration-200 hover:bg-sky-mist hover:text-sky-deep cursor-pointer"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* ── Desktop CTA buttons ── */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            href="/login"
            className="rounded-full border border-sky-200 px-5 py-2.5 text-sm font-semibold text-sky-primary transition-all duration-200 hover:border-sky-bright hover:bg-sky-soft cursor-pointer"
          >
            Log in
          </a>
          <a
            href="/register"
            className="rounded-full bg-gradient-to-r from-sky-primary to-sky-deep px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-200/50 transition-all duration-200 hover:shadow-lg hover:shadow-sky-200/60 hover:brightness-110 cursor-pointer"
          >
            Get started
          </a>
        </div>

        {/* ── Mobile hamburger ── */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex md:hidden cursor-pointer rounded-full p-2 text-storm transition-colors duration-200 hover:bg-sky-mist hover:text-sky-primary"
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          {isMobileMenuOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </nav>

      {/* ── Mobile menu drawer ── */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden ${
          isMobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-sky-100 bg-white/95 backdrop-blur-xl px-6 py-4 space-y-3">
          {navigationLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-medium text-storm/70 transition-colors duration-200 hover:bg-sky-mist hover:text-sky-deep cursor-pointer"
            >
              {link.label}
            </a>
          ))}
          <hr className="border-sky-100" />
          <a
            href="/login"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block rounded-xl border border-sky-200 px-4 py-3 text-center text-sm font-semibold text-sky-primary transition-colors duration-200 hover:bg-sky-soft cursor-pointer"
          >
            Log in
          </a>
          <a
            href="/register"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block rounded-xl bg-gradient-to-r from-sky-primary to-sky-deep px-4 py-3 text-center text-sm font-semibold text-white transition-colors duration-200 hover:brightness-110 cursor-pointer"
          >
            Get started
          </a>
        </div>
      </div>
    </header>
  )
}
