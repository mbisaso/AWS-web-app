import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  DashboardPage,
  LandingPage,
  LoginPage,
  RegisterPage,
  StationMapPage,
  WeatherDataPage,
  PowerDataPage,
  WeatherAnalysisPage,
  AlertsCenterPage,
  StationManagerPage,
  SimManagementPage,
} from './pages'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/weather-data" element={<WeatherDataPage />} />
        <Route path="/dashboard/power-data" element={<PowerDataPage />} />
        <Route path="/dashboard/weather-analysis" element={<WeatherAnalysisPage />} />
        <Route path="/dashboard/alerts-center" element={<AlertsCenterPage />} />
        <Route path="/dashboard/station-manager" element={<StationManagerPage />} />
        <Route path="/dashboard/sim-management" element={<SimManagementPage />} />
        <Route path="/stations/map" element={<StationMapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App