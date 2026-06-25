import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  AlertsCenterPage,
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
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/weather-data"
            element={
              <ProtectedRoute>
                <WeatherDataPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/power-data"
            element={
              <ProtectedRoute>
                <PowerDataPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/weather-analysis"
            element={
              <ProtectedRoute>
                <WeatherAnalysisPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/alerts-center"
            element={
              <ProtectedRoute>
                <AlertsCenterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/station-manager"
            element={
              <ProtectedRoute>
                <StationManagerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/sim-management"
            element={
              <ProtectedRoute>
                <SimManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stations/map"
            element={
              <ProtectedRoute>
                <StationMapPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
