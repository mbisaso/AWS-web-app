import { useScrollReveal } from '../../hooks/useScrollReveal'
import { ArrowRightIcon } from './Icons'

export function CallToAction() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 })

  return (
    <section id="access" className="relative overflow-hidden border-t border-sky-100">
      {/* Warm sunset gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-deep via-sky-primary to-ocean bg-[length:200%_200%] animate-gradient-shift" />

      {/* Decorative overlay patterns */}
      <div className="pointer-events-none absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white blur-3xl" />
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-sunset-light blur-3xl" />
      </div>

      <div
        ref={ref}
        className={`relative mx-auto max-w-4xl px-6 py-20 text-center transition-all duration-700 ease-out lg:py-28 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-light">
          Get started
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl font-display">
          Ready to monitor your weather stations?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/70">
          Jump into the dashboard to explore live data, or create an account to configure your own
          monitoring setup.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a
            href="/login"
            className="group inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:border-white/40 cursor-pointer"
          >
            Log in
          </a>
          <a
            href="/register"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-sky-deep shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-105 cursor-pointer"
          >
            Create account
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  )
}
