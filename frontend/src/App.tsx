import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertsCenterPage,
  BenchmarkPage,
  DashboardPage,
  LandingPage,
  LoginPage,
  PowerDataPage,
  RegisterPage,
  ReportsPage,
  SimManagementPage,
  StationManagerPage,
  StationMapPage,
  WeatherAnalysisPage,
  WeatherDataPage,
} from './pages'
import { ThingSpeakDemoPage } from './pages/ThingSpeakDemoPage'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const pageTransition = {
  type: 'tween' as const,
  ease: 'easeOut' as const,
  duration: 0.18,
}

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  )
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public */}
        <Route path="/" element={<AnimatedPage><LandingPage /></AnimatedPage>} />
        <Route path="/login" element={<AnimatedPage><LoginPage /></AnimatedPage>} />
        <Route path="/register" element={<AnimatedPage><RegisterPage /></AnimatedPage>} />

        {/* Protected dashboard */}
        <Route
          path="/dashboard"
          element={<AnimatedPage><ProtectedRoute><DashboardPage /></ProtectedRoute></AnimatedPage>}
        />
        <Route
          path="/dashboard/weather-data"
          element={<AnimatedPage><ProtectedRoute><WeatherDataPage /></ProtectedRoute></AnimatedPage>}
        />
        <Route
          path="/dashboard/power-data"
          element={<AnimatedPage><ProtectedRoute><PowerDataPage /></ProtectedRoute></AnimatedPage>}
        />
        <Route
          path="/dashboard/weather-analysis"
          element={<AnimatedPage><ProtectedRoute><WeatherAnalysisPage /></ProtectedRoute></AnimatedPage>}
        />
        <Route
          path="/dashboard/alerts-center"
          element={<AnimatedPage><ProtectedRoute><AlertsCenterPage /></ProtectedRoute></AnimatedPage>}
        />
        <Route
          path="/benchmarking"
          element={<AnimatedPage><ProtectedRoute><BenchmarkPage /></ProtectedRoute></AnimatedPage>}
        />
        <Route path="/thingspeak-demo" element={<AnimatedPage><ThingSpeakDemoPage /></AnimatedPage>} />
        <Route
          path="/dashboard/station-manager"
          element={<AnimatedPage><ProtectedRoute><StationManagerPage /></ProtectedRoute></AnimatedPage>}
        />
        <Route
          path="/dashboard/sim-management"
          element={<AnimatedPage><ProtectedRoute><SimManagementPage /></ProtectedRoute></AnimatedPage>}
        />
        <Route
          path="/dashboard/reports"
          element={<AnimatedPage><ProtectedRoute><ReportsPage /></ProtectedRoute></AnimatedPage>}
        />
        <Route
          path="/stations/map"
          element={<AnimatedPage><ProtectedRoute><StationMapPage /></ProtectedRoute></AnimatedPage>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
