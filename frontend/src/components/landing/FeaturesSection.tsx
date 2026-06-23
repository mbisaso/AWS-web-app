import { useScrollReveal } from '../../hooks/useScrollReveal'
import {
  SignalIcon,
  ThermometerIcon,
  ShieldIcon,
  ChartIcon,
  UsersIcon,
  DropletIcon,
} from './Icons'

const features = [
  {
    icon: <SignalIcon className="h-6 w-6" />,
    title: 'Live station monitoring',
    description:
      'Track the health and status of every weather station in real time. View connectivity, battery levels, and last contact at a glance.',
    iconBg: 'bg-sky-soft text-sky-deep',
  },
  {
    icon: <ThermometerIcon className="h-6 w-6" />,
    title: 'Environmental sensors',
    description:
      'Access readings from temperature, humidity, rainfall, wind speed, and barometric pressure sensors distributed across your network.',
    iconBg: 'bg-sunset-light/30 text-sunset',
  },
  {
    icon: <ShieldIcon className="h-6 w-6" />,
    title: 'Reliable infrastructure',
    description:
      'Built on Django with SQLite, designed for durability. Station data is stored securely and remains accessible even during network interruptions.',
    iconBg: 'bg-emerald-50 text-emerald-deep',
  },
  {
    icon: <ChartIcon className="h-6 w-6" />,
    title: 'Data analytics & trends',
    description:
      'Visualise historical readings and identify long-term climate patterns. The platform is ready for AI-driven insights and predictive models.',
    iconBg: 'bg-sky-mist text-sky-deep',
  },
  {
    icon: <UsersIcon className="h-6 w-6" />,
    title: 'Role-based access',
    description:
      'Multi-user support with distinct roles. Researchers, technicians, and administrators each see the data and controls relevant to their work.',
    iconBg: 'bg-sky-soft text-sky-primary',
  },
  {
    icon: <DropletIcon className="h-6 w-6" />,
    title: 'Weather alerts & thresholds',
    description:
      'Configure custom thresholds for each sensor parameter. Receive automatic notifications when readings fall outside expected ranges.',
    iconBg: 'bg-sky-mist text-sky-deep',
  },
] as const

export function FeaturesSection() {
  const { ref: titleRef, isVisible: titleVisible } = useScrollReveal()
  const { ref: gridRef, isVisible: gridVisible } = useScrollReveal({ threshold: 0.05 })

  return (
    <section id="features" className="relative overflow-hidden border-t border-sky-100 bg-white py-20 lg:py-28">
      {/* Subtle background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 right-0 h-72 w-72 -translate-y-1/2 rounded-full bg-gradient-to-l from-sky-soft to-transparent blur-3xl" />
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
            Platform features
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-midnight sm:text-4xl font-display">
            Everything you need to manage your weather network
          </h2>
          <p className="mt-4 text-base leading-7 text-storm/60">
            From real-time sensor readings to historical analytics — the AWS Monitor platform gives
            you full visibility into your weather station operations.
          </p>
        </div>

        {/* Feature cards grid */}
        <div
          ref={gridRef}
          className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              iconBg={feature.iconBg}
              index={index}
              isVisible={gridVisible}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  iconBg,
  index,
  isVisible,
}: {
  icon: React.ReactNode
  title: string
  description: string
  iconBg: string
  index: number
  isVisible: boolean
}) {
  const delay = 100 + index * 80

  return (
    <article
      className={`group cursor-pointer rounded-3xl border border-sky-100 bg-white p-6 shadow-sm transition-all duration-500 ease-out hover:-translate-y-1.5 hover:border-sky-200 hover:shadow-xl hover:shadow-sky-100/30 ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-10 opacity-0'
      }`}
      style={{ transitionDelay: isVisible ? `${delay}ms` : '0ms' }}
    >
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl transition-colors duration-300 ${iconBg} group-hover:scale-105`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-midnight font-display">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-storm/60">{description}</p>
    </article>
  )
}
