import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  DashboardPage,
  LandingPage,
  LoginPage,
  RegisterPage,
  StationMapPage,
  WeatherDataPage,
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
        <Route path="/stations/map" element={<StationMapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
