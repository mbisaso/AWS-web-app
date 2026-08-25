import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  StationDetailPage,
  WeatherAnalysisPage,
  WeatherDataPage,
} from './pages'
import { ThingSpeakDemoPage } from './pages/ThingSpeakDemoPage'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <Routes location={location} key={location.pathname}>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected dashboard */}
      <Route
        path="/dashboard"
        element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/weather-data"
        element={<ProtectedRoute><WeatherDataPage /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/power-data"
        element={<ProtectedRoute><PowerDataPage /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/weather-analysis"
        element={<ProtectedRoute><WeatherAnalysisPage /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/alerts-center"
        element={<ProtectedRoute><AlertsCenterPage /></ProtectedRoute>}
      />
      <Route
        path="/benchmarking"
        element={<ProtectedRoute><BenchmarkPage /></ProtectedRoute>}
      />
      <Route path="/thingspeak-demo" element={<ThingSpeakDemoPage />} />
      <Route
        path="/dashboard/station-manager"
        element={<ProtectedRoute><StationManagerPage /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/stations/:stationId"
        element={<ProtectedRoute><StationDetailPage /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/sim-management"
        element={<ProtectedRoute><SimManagementPage /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/reports"
        element={<ProtectedRoute><ReportsPage /></ProtectedRoute>}
      />
      <Route
        path="/stations/map"
        element={<ProtectedRoute><StationMapPage /></ProtectedRoute>}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
