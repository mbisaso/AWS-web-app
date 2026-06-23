import { Navigation } from '../components/landing/Navigation'
import { HeroSection } from '../components/landing/HeroSection'
import { FeaturesSection } from '../components/landing/FeaturesSection'
import { StatsSection } from '../components/landing/StatsSection'
import { CallToAction } from '../components/landing/CallToAction'
import { Footer } from '../components/landing/Footer'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-midnight">
      <Navigation />

      <main>
        <HeroSection />
        <FeaturesSection />
        <StatsSection />
        <CallToAction />
      </main>

      <Footer />
    </div>
  )
}
