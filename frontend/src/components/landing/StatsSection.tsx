import { useEffect, useRef, useState } from 'react'
import { useScrollReveal } from '../../hooks/useScrollReveal'

const stats = [
  { value: 12, suffix: '', label: 'Stations online', description: 'Across the WIMEA-ICT network' },
  { value: 98, suffix: '%', label: 'Data freshness', description: 'Readings updated every minute' },
  { value: 3, suffix: '', label: 'Active alerts', description: 'Requiring attention' },
  { value: 1.8, suffix: 's', label: 'Sync latency', description: 'Average data transmission delay' },
] as const

export function StatsSection() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.3 })

  return (
    <section className="border-t border-sky-100 bg-gradient-to-b from-sky-soft to-white py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-primary">
            Network metrics
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-midnight sm:text-4xl font-display">
            Your network at a glance
          </h2>
        </div>

        {/* Stat counters */}
        <div
          ref={ref}
          className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {stats.map((stat) => (
            <StatCounter
              key={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              label={stat.label}
              description={stat.description}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function StatCounter({
  value,
  suffix,
  label,
  description,
  isVisible,
}: {
  value: number
  suffix: string
  label: string
  description: string
  isVisible: boolean
}) {
  const [displayValue, setDisplayValue] = useState(0)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!isVisible || hasAnimated.current) return
    hasAnimated.current = true

    const isDecimal = value % 1 !== 0
    const duration = 1500
    const steps = 40
    const increment = value / steps
    let currentStep = 0

    const timer = setInterval(() => {
      currentStep++
      const nextValue = Math.min(increment * currentStep, value)
      setDisplayValue(isDecimal ? Math.round(nextValue * 10) / 10 : Math.round(nextValue))

      if (currentStep >= steps) {
        setDisplayValue(value)
        clearInterval(timer)
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [isVisible, value])

  return (
    <div className="group cursor-pointer rounded-3xl border border-sky-100 bg-white p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-lg">
      <p className="text-4xl font-bold tracking-tight text-midnight font-display lg:text-5xl">
        {displayValue}
        {suffix}
      </p>
      <p className="mt-2 text-sm font-semibold text-midnight">{label}</p>
      <p className="mt-1 text-xs text-storm/50">{description}</p>
    </div>
  )
}
