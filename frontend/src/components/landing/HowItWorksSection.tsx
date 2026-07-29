import { useScrollReveal } from '../../hooks/useScrollReveal'

const steps = [
  {
    number: '01',
    title: 'ESP32 station collects data',
    description: 'Battery-powered weather stations equipped with sensors for temperature, humidity, wind, rainfall, and solar radiation transmit readings at regular intervals.',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 9h6v6H9z" />
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
      </svg>
    ),
    color: 'from-emerald/10 to-emerald/5 text-emerald border-emerald/20',
    iconBg: 'bg-emerald-50 text-emerald',
  },
  {
    number: '02',
    title: 'GSM network transmits readings',
    description: 'SIM-enabled modules securely push sensor data over Uganda\'s cellular network to the central Django server — no internet required at the station.',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16" />
      </svg>
    ),
    color: 'from-sky-primary/10 to-sky-primary/5 text-sky-primary border-sky-primary/20',
    iconBg: 'bg-sky-soft text-sky-primary',
  },
  {
    number: '03',
    title: 'Dashboard delivers insights',
    description: 'The AWS Monitor dashboard visualises live and historical data, tracks station health with AI predictions, and surfaces alerts — all in real time.',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    color: 'from-sunset/10 to-sunset/5 text-sunset border-sunset/20',
    iconBg: 'bg-sunset-light/30 text-sunset',
  },
]

export function HowItWorksSection() {
  const { ref: titleRef, isVisible: titleVisible } = useScrollReveal()
  const { ref: stepsRef, isVisible: stepsVisible } = useScrollReveal({ threshold: 0.05 })

  return (
    <section id="how-it-works" className="relative overflow-hidden border-t border-sky-100 bg-gradient-to-b from-white via-sky-soft/30 to-white py-20 lg:py-28">
      {/* Subtle background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gradient-to-b from-sky-primary/5 to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div
          ref={titleRef}
          className={`mx-auto max-w-2xl text-center transition-all duration-700 ease-out ${
            titleVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-primary">
            How it works
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-midnight sm:text-4xl font-display">
            From field sensor to your screen
          </h2>
          <p className="mt-4 text-base leading-7 text-storm/60">
            Three simple steps power the entire WIMEA-ICT monitoring pipeline.
          </p>
        </div>

        {/* Steps */}
        <div
          ref={stepsRef}
          className="mt-16 grid gap-8 lg:grid-cols-3"
        >
          {steps.map((step, index) => {
            const delay = 100 + index * 120
            return (
              <div
                key={step.number}
                className={`group relative transition-all duration-700 ease-out ${
                  stepsVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}
                style={{ transitionDelay: stepsVisible ? `${delay}ms` : '0ms' }}
              >
                {/* Connector line (not on last item) */}
                {index < steps.length - 1 && (
                  <div className="absolute left-[calc(50%+40px)] top-10 hidden h-[2px] w-[calc(100%-80px)] lg:block" aria-hidden="true">
                    <div className="h-full bg-gradient-to-r from-sky-200 to-sky-100" />
                    <div className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-sky-300" />
                  </div>
                )}

                <div className={`relative rounded-3xl border bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-sky-100/30 ${step.color.split(' ')[3] ?? 'border-slate-100'}`}>
                  {/* Step number badge */}
                  <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${step.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                    {step.icon}
                  </div>

                  {/* Step number */}
                  <div className="mt-5 inline-flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-storm/30">
                      Step {step.number}
                    </span>
                  </div>

                  <h3 className="mt-2 text-lg font-semibold text-midnight font-display">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-storm/55">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
