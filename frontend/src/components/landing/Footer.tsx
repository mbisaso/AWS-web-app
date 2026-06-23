import { ExternalLinkIcon } from './Icons'

interface FooterLink {
  label: string
  href: string
  external?: boolean
}

interface FooterSection {
  title: string
  links: FooterLink[]
}

const footerSections: FooterSection[] = [
  {
    title: 'Product',
    links: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Features', href: '#features' },
      { label: 'Platform', href: '#platform' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '#' },
      { label: 'API reference', href: '#' },
      { label: 'Station guide', href: '#' },
      { label: 'Support', href: '#' },
    ],
  },
  {
    title: 'Connect',
    links: [
      { label: 'WIMEA-ICT', href: '#', external: true },
      { label: 'GitHub', href: '#', external: true },
      { label: 'Contact team', href: '#', external: true },
      { label: 'Report issue', href: '#', external: true },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-sky-100 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-primary to-sky-deep text-base font-black text-white shadow-md shadow-sky-200/40">
                A
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.15em] text-sky-primary uppercase">
                  AWS Monitor
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-storm/60 max-w-xs">
              A weather station monitoring platform built for the WIMEA-ICT network. Monitor,
              analyse, and manage your environmental data from one place.
            </p>

            {/* Live status mini-badge */}
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-soft px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-storm/60">All systems operational</span>
            </div>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-storm/40">
                {section.title}
              </p>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="inline-flex items-center gap-1.5 text-sm text-storm/60 transition-colors duration-200 hover:text-sky-primary cursor-pointer"
                    >
                      {link.label}
                      {link.external && <ExternalLinkIcon className="h-3 w-3" />}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 border-t border-sky-100 pt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-storm/40">
            &copy; {new Date().getFullYear()} AWS Monitor — WIMEA-ICT weather station platform.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-storm/40 transition-colors duration-200 hover:text-sky-primary cursor-pointer">
              Privacy policy
            </a>
            <a href="#" className="text-xs text-storm/40 transition-colors duration-200 hover:text-sky-primary cursor-pointer">
              Terms of service
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
