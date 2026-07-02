import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  AlertsCenterPage,
  DashboardPage,
  LandingPage,
  LoginPage,
  PowerDataPage,
  RegisterPage,
  StationMapPage,
  WeatherAnalysisPage,
  WeatherDataPage,
} from './pages'
import { ThingSpeakDemoPage } from './pages/ThingSpeakDemoPage'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/weather-data"
            element={
              <ProtectedRoute>
                <WeatherDataPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/power-data"
            element={
              <ProtectedRoute>
                <PowerDataPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/weather-analysis"
            element={
              <ProtectedRoute>
                <WeatherAnalysisPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/station-map"
            element={
              <ProtectedRoute>
                <StationMapPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts-center"
            element={
              <ProtectedRoute>
                <AlertsCenterPage />
              </ProtectedRoute>
            }
          />
          <Route path="/thingspeak-demo" element={<ThingSpeakDemoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
