import { useState, type ReactNode } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useExportDataPreview } from '../hooks/useExportData'
import { usePerformanceReport } from '../hooks/usePerformanceReport'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { PageHeader } from '../components/shared/PageHeader'
import { MaintenanceLogPanel } from '../components/reports/MaintenanceLogPanel'
import {
  downloadPerformanceReportPdf,
  exportDataCsv,
  type ExportConfig,
  type SensorFaultType,
  type StationReading,
} from '../services/api'

type ReportTab = 'export' | 'performance'

const SENSOR_DISPLAY_NAMES: Record<string, string> = {
  temperature: 'Air Temperature',
  air_temp: 'Air Temperature',
  humidity: 'Humidity',
  pressure: 'Atmospheric Pressure',
  wind_speed: 'Wind Speed',
  wind_direction: 'Wind Direction',
  solar_radiation: 'Solar Radiation',
  soil_moisture: 'Soil Moisture',
  rain: 'Rainfall',
  rainfall: 'Rainfall',
}

function getPercentColor(pct: number): string {
  if (pct >= 90) return 'text-emerald'
  if (pct >= 70) return 'text-amber-500'
  return 'text-rose-600'
}

const FAULT_TYPE_LABELS: Record<SensorFaultType, string> = {
  missing: 'Missing',
  out_of_range: 'Out of range',
  stuck: 'Stuck',
}

function formatDuration(minutes: number): string {
  const total = Math.round(minutes)
  if (total < 60) return `${total} min`
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const mins = total % 60
  if (days > 0) return `${days}d ${hours}h`
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function KpiCard({ label, value, valueClass, detail, icon }: {
  label: string
  value: string
  valueClass: string
  detail: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-storm/50">{label}</span>
        <span className="text-sky-primary">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {icon}
          </svg>
        </span>
      </div>
      <p className={`mt-3 text-3xl font-extrabold font-display ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-storm/60 font-medium">{detail}</p>
    </div>
  )
}

const EVENT_TABLE_PREVIEW = 10

function EventTable<T>({ rows, columns, renderRow, noun }: {
  rows: T[]
  columns: string[]
  renderRow: (row: T) => ReactNode[]
  noun: string
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? rows : rows.slice(0, EVENT_TABLE_PREVIEW)

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-slate-50 text-storm/70 font-semibold border-b border-slate-200">
            <tr>
              {columns.map((column, index) => (
                <th key={column} className={`px-4 py-3 ${index === columns.length - 1 ? 'text-right' : ''}`}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50/80 transition-colors">
                {renderRow(row).map((cell, index) => (
                  <td
                    key={index}
                    className={`px-4 py-2.5 ${index === 0 ? 'font-medium text-midnight' : 'text-storm/80'} ${index === columns.length - 1 ? 'text-right' : ''}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > EVENT_TABLE_PREVIEW && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="cursor-pointer text-xs font-semibold text-sky-primary hover:underline"
        >
          {showAll ? `Show the ${EVENT_TABLE_PREVIEW} longest` : `Show all ${rows.length} ${noun}`}
        </button>
      )}
    </div>
  )
}

export function ReportsPage() {
  const { data: dashData } = useDashboardData()
  const stations: StationReading[] = dashData?.stations ?? []

  const [activeTab, setActiveTab] = useState<ReportTab>('export')

  // --- Data Export State ---
  const [stationId, setStationId] = useState<string>('')
  const [hours, setHours] = useState<number>(168)
  const [fields, setFields] = useState<'all' | 'sensor' | 'power'>('all')
  const [isDownloading, setIsDownloading] = useState<boolean>(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const config: ExportConfig = {
    station_id: stationId || undefined,
    hours,
    fields,
  }

  const { data: previewData, isLoading: previewLoading, isFetching: previewFetching } = useExportDataPreview(config)

  const handleDownloadCsv = async () => {
    try {
      setIsDownloading(true)
      setDownloadError(null)
      const blob = await exportDataCsv(config)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `aws_export_${stationId || 'fleet'}_${hours}h_${fields}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download CSV:', err)
      setDownloadError('Failed to download CSV. Please check authentication and server status.')
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePresetHours = (h: number) => setHours(h)

  // --- Performance Report State ---
  const [reportStationId, setReportStationId] = useState<string>('')
  const [reportDays, setReportDays] = useState<number>(30)
  const [submittedReportParams, setSubmittedReportParams] = useState<{ stationId: string; days: number } | null>(null)
  const [isReportDownloading, setIsReportDownloading] = useState<boolean>(false)
  const [reportDownloadError, setReportDownloadError] = useState<string | null>(null)

  const {
    data: performanceData,
    isLoading: isReportLoading,
    isFetching: isReportFetching,
    error: reportError,
    refetch: refetchReport,
  } = usePerformanceReport(
    submittedReportParams?.stationId ?? '',
    submittedReportParams?.days ?? 30
  )

  const handleGenerateReport = () => {
    if (!reportStationId) return
    if (submittedReportParams?.stationId === reportStationId && submittedReportParams?.days === reportDays) {
      refetchReport()
    } else {
      setSubmittedReportParams({ stationId: reportStationId, days: reportDays })
    }
  }

  const handleDownloadPerformanceReport = async () => {
    if (!performanceData || !submittedReportParams) return

    try {
      setIsReportDownloading(true)
      setReportDownloadError(null)
      const blob = await downloadPerformanceReportPdf(
        submittedReportParams.stationId,
        submittedReportParams.days,
      )
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const safeStationCode = performanceData.station_code.replace(/[^a-z0-9_-]/gi, '_')
      link.href = url
      link.download = `performance_report_${safeStationCode}_${submittedReportParams.days}d.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download performance report:', err)
      setReportDownloadError('Failed to download PDF. Please check authentication and server status.')
    } finally {
      setIsReportDownloading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        <PageHeader
          label="Reporting"
          title={activeTab === 'export' ? 'Data Export Hub' : 'Station Performance Report'}
          subtitle={
            activeTab === 'export'
              ? 'Extract historical sensor and power diagnostics directly from the cloud'
              : 'Comprehensive reliability, uptime, transmission, and sensor diagnostics'
          }
          variant="admin"
          icon={
            activeTab === 'export' ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            )
          }
        />

        {/* Top Tab Bar */}
        <div className="mb-6 flex gap-2 border-b border-slate-200 pb-px" role="tablist" aria-label="Reporting sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'export'}
            onClick={() => setActiveTab('export')}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-t-xl px-5 py-3 text-sm font-semibold transition-all ${
              activeTab === 'export'
                ? 'border-b-2 border-sky-primary text-midnight bg-white shadow-xs -mb-px'
                : 'text-storm/60 hover:text-midnight hover:bg-slate-100/60'
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Data Export
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'performance'}
            onClick={() => setActiveTab('performance')}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-t-xl px-5 py-3 text-sm font-semibold transition-all ${
              activeTab === 'performance'
                ? 'border-b-2 border-sky-primary text-midnight bg-white shadow-xs -mb-px'
                : 'text-storm/60 hover:text-midnight hover:bg-slate-100/60'
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Performance Report
          </button>
        </div>

        {/* Tab 1: Data Export */}
        {activeTab === 'export' && (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Builder Form */}
            <div className="lg:col-span-4 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 h-1 w-full bg-sky-primary" aria-hidden="true" />

                <h2 className="text-lg font-bold font-display text-midnight mb-6">Export Configuration</h2>

                {/* Station Select */}
                <div className="space-y-3 mb-8">
                  <label className="text-sm font-semibold text-midnight">Target Station</label>
                  <select
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-midnight focus:border-sky-primary focus:outline-none focus:ring-1 focus:ring-sky-primary"
                  >
                    <option value="">All Stations (Fleet-wide)</option>
                    {stations.map(s => (
                      <option key={s.station_code} value={s.station_code}>{s.name} ({s.station_code})</option>
                    ))}
                  </select>
                </div>

                {/* Timeframe */}
                <div className="space-y-3 mb-8">
                  <label className="text-sm font-semibold text-midnight">Timeframe</label>
                  <div className="flex flex-wrap gap-2">
                    {[24, 168, 720, 2160].map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handlePresetHours(h)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                          hours === h
                            ? 'bg-sky-primary text-white shadow-sm'
                            : 'bg-slate-100 text-storm/70 hover:bg-slate-200'
                        }`}
                      >
                        {h === 24 ? '24h' : h === 168 ? '7 Days' : h === 720 ? '30 Days' : '90 Days'}
                      </button>
                    ))}
                    <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 border border-slate-200">
                      <input
                        type="number"
                        value={hours}
                        onChange={e => setHours(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-12 bg-transparent text-xs font-semibold text-midnight focus:outline-none text-center"
                      />
                      <span className="text-[10px] uppercase font-bold text-storm/40">HRS</span>
                    </div>
                  </div>
                </div>

                {/* Data Domain */}
                <div className="space-y-3 mb-8">
                  <label className="text-sm font-semibold text-midnight">Data Domain</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'all', label: 'All Data', desc: 'Everything' },
                      { id: 'sensor', label: 'Sensors', desc: 'Weather only' },
                      { id: 'power', label: 'Power', desc: 'Diagnostics' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFields(opt.id as any)}
                        className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                          fields === opt.id
                            ? 'border-sky-primary bg-sky-50/30 ring-1 ring-sky-primary'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className={`text-xs font-bold ${fields === opt.id ? 'text-sky-700' : 'text-midnight'}`}>
                          {opt.label}
                        </span>
                        <span className="mt-1 text-[10px] text-storm/50 leading-tight">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Download Action */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    disabled={previewLoading || isDownloading || !previewData?.count}
                    className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-midnight px-4 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        <span>Exporting CSV...</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download CSV
                      </>
                    )}
                  </button>
                  {downloadError && (
                    <p className="mt-2 text-center text-xs text-rose-600 font-medium">
                      {downloadError}
                    </p>
                  )}
                  <p className="mt-3 text-center text-[10px] text-storm/40">
                    Timestamps exported as YYYY-MM-DD HH:MM:SS
                  </p>
                </div>

              </div>
            </div>

            {/* Preview Panel */}
            <div className="lg:col-span-8">
              <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                  <h3 className="text-sm font-bold text-midnight font-display">Live Preview</h3>
                  <div className="flex items-center gap-2">
                    {previewFetching && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                      </span>
                    )}
                    <span className="text-xs font-semibold text-storm/60">
                      {previewData ? `${previewData.count.toLocaleString()} rows found` : 'Loading...'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-50/30 p-0 relative min-h-[400px]">
                  {previewData?.count === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-storm/40 mb-4">
                        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                      <h4 className="text-sm font-bold text-midnight">No data found</h4>
                      <p className="mt-1 text-xs text-storm/60 max-w-xs">
                        Try expanding the timeframe or selecting a different station to find records.
                      </p>
                    </div>
                  ) : previewData?.data?.length > 0 ? (
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="sticky top-0 bg-white shadow-sm border-b border-slate-200 z-10">
                        <tr>
                          {Object.keys(previewData.data[0]).map(key => (
                            <th key={key} className="px-4 py-3 font-semibold text-storm/70">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.data.slice(0, 50).map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            {Object.values(row).map((val: any, j: number) => (
                              <td key={j} className="px-4 py-2.5 text-midnight">
                                {val === null ? <span className="text-storm/30">—</span> : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {previewData.count > 50 && (
                          <tr>
                            <td colSpan={Object.keys(previewData.data[0]).length} className="px-4 py-3 text-center text-xs font-semibold text-sky-primary bg-sky-50/50">
                              + {previewData.count - 50} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : previewLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-sky-primary mb-4" />
                      <p className="text-xs text-storm/50">Fetching preview...</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Performance Report */}
        {activeTab === 'performance' && (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left Panel: Report Config */}
            <div className="lg:col-span-4 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 h-1 w-full bg-sky-primary" aria-hidden="true" />

                <h2 className="text-lg font-bold font-display text-midnight mb-6">Report Configuration</h2>

                {/* Station Select (Required) */}
                <div className="space-y-3 mb-8">
                  <label className="text-sm font-semibold text-midnight">Target Station</label>
                  <select
                    value={reportStationId}
                    onChange={(e) => setReportStationId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-midnight focus:border-sky-primary focus:outline-none focus:ring-1 focus:ring-sky-primary"
                  >
                    <option value="" disabled>Select a weather station...</option>
                    {stations.map(s => (
                      <option key={s.station_code} value={s.station_code}>
                        {s.name} ({s.station_code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Period Selector */}
                <div className="space-y-3 mb-8">
                  <label className="text-sm font-semibold text-midnight">Reporting Period</label>
                  <div className="flex flex-wrap gap-2">
                    {[7, 30, 90].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setReportDays(d)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                          reportDays === d
                            ? 'bg-sky-primary text-white shadow-sm'
                            : 'bg-slate-100 text-storm/70 hover:bg-slate-200'
                        }`}
                      >
                        {d} Days
                      </button>
                    ))}
                    <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 border border-slate-200">
                      <input
                        type="number"
                        min={1}
                        value={reportDays}
                        onChange={e => setReportDays(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-12 bg-transparent text-xs font-semibold text-midnight focus:outline-none text-center"
                      />
                      <span className="text-[10px] uppercase font-bold text-storm/40">DAYS</span>
                    </div>
                  </div>
                </div>

                {/* Generate Report Button */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleGenerateReport}
                    disabled={!reportStationId || isReportFetching}
                    className="group relative flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-midnight px-4 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isReportFetching ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        <span>Generating Report...</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                        Generate Report
                      </>
                    )}
                  </button>

                  <p className="mt-3 text-center text-[10px] text-storm/40">
                    Covers uptime, transmission, communication, power, sensor faults and maintenance
                  </p>
                </div>

              </div>
            </div>

            {/* Right Panel: Report Results */}
            <div className="lg:col-span-8">
              {!submittedReportParams && !performanceData && !isReportLoading ? (
                /* Empty state */
                <div className="flex min-h-[460px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-primary mb-4 shadow-xs">
                    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <path d="M16 13H8" />
                      <path d="M16 17H8" />
                      <path d="M10 9H8" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-midnight font-display">Select a station and generate a report</h3>
                  <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-storm/60">
                    Choose a weather station and timeframe from the left panel to inspect uptime, missing data gaps, power health, and sensor completeness.
                  </p>
                </div>
              ) : isReportLoading && !performanceData ? (
                /* Loading State */
                <div className="flex min-h-[460px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-16 text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-sky-primary mb-4" />
                  <h3 className="text-sm font-bold text-midnight font-display">Generating Performance Report...</h3>
                  <p className="mt-1 text-xs text-storm/50">Analyzing telemetry records and computing diagnostics...</p>
                </div>
              ) : reportError ? (
                /* Error State */
                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 p-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-rose-900">Failed to generate report</h4>
                  <p className="mt-1 text-xs text-rose-600 max-w-md">
                    {reportError instanceof Error ? reportError.message : 'An error occurred while loading performance data. Please try again.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => refetchReport()}
                    className="mt-4 cursor-pointer rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    Retry
                  </button>
                </div>
              ) : performanceData ? (
                /* Report Content */
                <div className="space-y-6">
                  {/* Metadata Header */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 tracking-wide">
                          {performanceData.station_code}
                        </span>
                        <h2 className="text-xl font-bold font-display text-midnight">{performanceData.station_name}</h2>
                      </div>
                      <p className="mt-1.5 text-xs text-storm/60">
                        Period: {new Date(performanceData.period_start).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} – {new Date(performanceData.period_end).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      <div className="text-left sm:text-right">
                        <p className="text-[10px] uppercase font-bold text-storm/40">Generated</p>
                        <p className="text-xs font-semibold text-storm/70">
                          {new Date(performanceData.generated_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadPerformanceReport}
                        disabled={isReportDownloading}
                        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-midnight transition-colors hover:border-sky-primary hover:text-sky-700 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isReportDownloading ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-primary" />
                        ) : (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        )}
                        {isReportDownloading ? 'Preparing PDF...' : 'Download PDF'}
                      </button>
                      {reportDownloadError && (
                        <p role="alert" className="max-w-56 text-right text-xs text-rose-600">
                          {reportDownloadError}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* KPI Cards (two rows of three) */}
                  {(() => {
                    const sensorsObj = performanceData.sensor_health?.sensors ?? {}
                    const totalSensors = Object.keys(sensorsObj).length
                    const activeFaults = performanceData.sensor_health?.active_faults ?? []
                    const faultySensors = Object.entries(sensorsObj).filter(
                      ([key, s]) => s.fault_events > 0 || activeFaults.includes(key),
                    ).length
                    const healthySensors = Math.max(0, totalSensors - faultySensors)
                    const sensorHealthPct = totalSensors > 0 ? (healthySensors / totalSensors) * 100 : 100
                    const faultEvents = performanceData.sensor_health?.total_fault_events ?? 0
                    const { communication, power } = performanceData

                    const latencyDisplay = `${formatDuration(performanceData.transmission.avg_latency_seconds / 60)} avg latency`

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        <KpiCard
                          label="Data Availability"
                          value={`${performanceData.data_availability.pct.toFixed(1)}%`}
                          valueClass={getPercentColor(performanceData.data_availability.pct)}
                          detail={`${performanceData.data_availability.actual_readings.toLocaleString()} / ${performanceData.data_availability.expected_readings.toLocaleString()} readings`}
                          icon={
                            <>
                              <ellipse cx="12" cy="5" rx="9" ry="3" />
                              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                            </>
                          }
                        />
                        <KpiCard
                          label="System Uptime"
                          value={`${performanceData.uptime.pct.toFixed(1)}%`}
                          valueClass={getPercentColor(performanceData.uptime.pct)}
                          detail={`${performanceData.uptime.downtime_incidents} downtime incident${performanceData.uptime.downtime_incidents !== 1 ? 's' : ''}`}
                          icon={
                            <>
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </>
                          }
                        />
                        <KpiCard
                          label="Transmission"
                          value={`${performanceData.transmission.success_pct.toFixed(1)}%`}
                          valueClass={getPercentColor(performanceData.transmission.success_pct)}
                          detail={`On time · ${latencyDisplay}`}
                          icon={
                            <>
                              <path d="M4.93 4.93a10 10 0 0 1 14.14 0" />
                              <path d="M7.76 7.76a6 6 0 0 1 8.48 0" />
                              <circle cx="12" cy="12" r="2" />
                              <path d="M12 14v8" />
                            </>
                          }
                        />
                        <KpiCard
                          label="Comms Interruptions"
                          value={communication.interruptions.toLocaleString()}
                          valueClass={communication.interruptions === 0 ? 'text-emerald' : 'text-amber-500'}
                          detail={
                            communication.interruptions === 0
                              ? 'All readings delivered on time'
                              : `${formatDuration(communication.total_minutes)} total · longest ${formatDuration(communication.longest_minutes)}`
                          }
                          icon={
                            <>
                              <path d="M1 1l22 22" />
                              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                              <line x1="12" y1="20" x2="12.01" y2="20" />
                            </>
                          }
                        />
                        <KpiCard
                          label="Sensor Health"
                          value={`${healthySensors} / ${totalSensors}`}
                          valueClass={getPercentColor(sensorHealthPct)}
                          detail={`${faultEvents} fault event${faultEvents !== 1 ? 's' : ''} in period`}
                          icon={<path d="M22 12h-4l-3 9L9 3l-3 9H2" />}
                        />
                        <KpiCard
                          label="Battery Charging"
                          value={`${power.charging_pct.toFixed(1)}%`}
                          valueClass={power.power_outages > 0 ? 'text-rose-600' : 'text-midnight'}
                          detail={`${power.charging_hours.toFixed(1)} h charging · ${power.power_outages} power outage${power.power_outages !== 1 ? 's' : ''}`}
                          icon={
                            <>
                              <rect x="2" y="7" width="16" height="10" rx="2" />
                              <line x1="22" y1="11" x2="22" y2="13" />
                              <polyline points="11 9 8 12 11 12 8 15" />
                            </>
                          }
                        />
                      </div>
                    )
                  })()}

                  {/* Missing Data Gaps Section */}
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-bold text-midnight font-display">Missing Data Gaps</h3>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          performanceData.missing_data.total_gaps > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {performanceData.missing_data.total_gaps}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      {performanceData.missing_data.gaps && performanceData.missing_data.gaps.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-slate-50 text-storm/70 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-3">Start Time</th>
                                <th className="px-4 py-3">End Time</th>
                                <th className="px-4 py-3">Duration</th>
                                <th className="px-4 py-3">Likely Cause</th>
                                <th className="px-4 py-3 text-right">Missed Readings</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {performanceData.missing_data.gaps.map((gap, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-2.5 text-midnight font-medium">
                                    {new Date(gap.start).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2.5 text-midnight">
                                    {new Date(gap.end).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2.5 text-storm/80">
                                    {formatDuration(gap.duration_minutes)}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="flex flex-wrap gap-1">
                                      {gap.during_maintenance && (
                                        <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-700">Maintenance</span>
                                      )}
                                      {gap.cause === 'low_battery' && (
                                        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-700">Low battery</span>
                                      )}
                                      {!gap.during_maintenance && gap.cause !== 'low_battery' && (
                                        <span className="text-storm/40">Unknown</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-rose-600">
                                    {gap.missed_readings.toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-emerald-800">
                          <svg className="h-5 w-5 text-emerald shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                          <div>
                            <p className="text-sm font-semibold">No data gaps detected</p>
                            <p className="text-xs text-emerald-700/80">Readings transmitted consistently according to the configured logging schedule.</p>
                          </div>
                        </div>
                      )}

                      {/* Summary below */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                          <span className="text-xs font-semibold text-storm/60">Longest Gap</span>
                          <span className="text-sm font-bold text-midnight font-display">
                            {formatDuration(performanceData.missing_data.longest_gap_minutes)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                          <span className="text-xs font-semibold text-storm/60">Total Missing Time</span>
                          <span className="text-sm font-bold text-midnight font-display">
                            {formatDuration(performanceData.missing_data.total_missing_minutes)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Communication Interruptions Section */}
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-bold text-midnight font-display">Communication Interruptions</h3>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          performanceData.communication.interruptions > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {performanceData.communication.interruptions}
                        </span>
                      </div>
                      <p className="text-[11px] text-storm/50">Readings logged on schedule but delivered late</p>
                    </div>
                    <div className="p-6">
                      {performanceData.communication.events.length > 0 ? (
                        <EventTable
                          rows={[...performanceData.communication.events].sort((a, b) => b.duration_minutes - a.duration_minutes)}
                          columns={['Start Time', 'Network Back', 'Duration', 'Delayed Readings']}
                          renderRow={(event) => [
                            new Date(event.start).toLocaleString(),
                            new Date(event.end).toLocaleString(),
                            formatDuration(event.duration_minutes),
                            event.delayed_readings.toLocaleString(),
                          ]}
                          noun="interruptions"
                        />
                      ) : (
                        <p className="text-xs text-storm/60">Every reading reached the server within one reporting interval.</p>
                      )}
                    </div>
                  </div>

                  {/* Power Performance Section */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-bold text-midnight font-display">Power Performance</h3>
                      <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        performanceData.power.low_battery_events > 0
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald border border-emerald-200'
                      }`}>
                        {performanceData.power.low_battery_events > 0 ? (
                          <>
                            <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                            <span className="font-bold">{performanceData.power.low_battery_events}</span> Low Battery Event{performanceData.power.low_battery_events !== 1 ? 's' : ''}
                          </>
                        ) : (
                          <>
                            <span className="h-2 w-2 rounded-full bg-emerald" />
                            0 Low Battery Events
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {/* Battery Min */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-storm/50">Battery Min</span>
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">Batt</span>
                        </div>
                        <p className="mt-2 text-lg font-bold text-midnight font-display">
                          {performanceData.power.volt_batt_min != null ? `${performanceData.power.volt_batt_min.toFixed(2)} V` : '—'}
                        </p>
                      </div>

                      {/* Battery Avg */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-storm/50">Battery Avg</span>
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">Batt</span>
                        </div>
                        <p className="mt-2 text-lg font-bold text-midnight font-display">
                          {performanceData.power.volt_batt_avg != null ? `${performanceData.power.volt_batt_avg.toFixed(2)} V` : '—'}
                        </p>
                      </div>

                      {/* Battery Max */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-storm/50">Battery Max</span>
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">Batt</span>
                        </div>
                        <p className="mt-2 text-lg font-bold text-midnight font-display">
                          {performanceData.power.volt_batt_max != null ? `${performanceData.power.volt_batt_max.toFixed(2)} V` : '—'}
                        </p>
                      </div>

                      {/* Solar Min */}
                      <div className="rounded-xl border border-slate-100 bg-amber-50/30 p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-storm/50">Solar Min</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">Solar</span>
                        </div>
                        <p className="mt-2 text-lg font-bold text-midnight font-display">
                          {performanceData.power.volt_solar_min != null ? `${performanceData.power.volt_solar_min.toFixed(2)} V` : '—'}
                        </p>
                      </div>

                      {/* Solar Avg */}
                      <div className="rounded-xl border border-slate-100 bg-amber-50/30 p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-storm/50">Solar Avg</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">Solar</span>
                        </div>
                        <p className="mt-2 text-lg font-bold text-midnight font-display">
                          {performanceData.power.volt_solar_avg != null ? `${performanceData.power.volt_solar_avg.toFixed(2)} V` : '—'}
                        </p>
                      </div>

                      {/* Solar Max */}
                      <div className="rounded-xl border border-slate-100 bg-amber-50/30 p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-storm/50">Solar Max</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">Solar</span>
                        </div>
                        <p className="mt-2 text-lg font-bold text-midnight font-display">
                          {performanceData.power.volt_solar_max != null ? `${performanceData.power.volt_solar_max.toFixed(2)} V` : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { label: 'Battery Temp Min', value: performanceData.power.battery_temp_min, unit: '°C' },
                        { label: 'Battery Temp Avg', value: performanceData.power.battery_temp_avg, unit: '°C' },
                        { label: 'Battery Temp Max', value: performanceData.power.battery_temp_max, unit: '°C' },
                      ].map(tile => (
                        <div key={tile.label} className="rounded-xl border border-slate-100 bg-rose-50/20 p-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-storm/50">{tile.label}</span>
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">Temp</span>
                          </div>
                          <p className="mt-2 text-lg font-bold text-midnight font-display">
                            {tile.value != null ? `${tile.value.toFixed(1)} ${tile.unit}` : '—'}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                        <span className="text-xs font-semibold text-storm/60">Charging</span>
                        <span className="text-sm font-bold text-midnight font-display">
                          {performanceData.power.charging_hours.toFixed(1)} h
                          <span className="ml-1 text-xs font-normal text-storm/50">({performanceData.power.charging_pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                        <span className="text-xs font-semibold text-storm/60">Discharging</span>
                        <span className="text-sm font-bold text-midnight font-display">
                          {performanceData.power.discharging_hours.toFixed(1)} h
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                        <span className="text-xs font-semibold text-storm/60">Power Outages</span>
                        <span className={`text-sm font-bold font-display ${performanceData.power.power_outages > 0 ? 'text-rose-600' : 'text-midnight'}`}>
                          {performanceData.power.power_outages}
                          {performanceData.power.power_outages > 0 && (
                            <span className="ml-1 text-xs font-normal text-storm/50">
                              ({formatDuration(performanceData.power.power_outage_minutes)})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-storm/50">
                      Charging time comes from the battery current; power outages are data gaps that began right after a low-battery reading.
                    </p>
                  </div>

                  {/* Sensor Health Section */}
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-bold text-midnight font-display">Sensor Health</h3>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-storm/70">
                          {Object.keys(performanceData.sensor_health?.sensors ?? {}).length} Sensors
                        </span>
                      </div>
                      {performanceData.sensor_health?.active_faults?.length > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                          {performanceData.sensor_health.active_faults.length} Fault{performanceData.sensor_health.active_faults.length !== 1 ? 's' : ''} Detected
                        </span>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50 text-storm/70 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-3.5">Sensor Name</th>
                            <th className="px-4 py-3.5">Total Readings</th>
                            <th className="px-4 py-3.5">Missing</th>
                            <th className="px-4 py-3.5">Completeness %</th>
                            <th className="px-4 py-3.5">Faults</th>
                            <th className="px-4 py-3.5">Fault Time</th>
                            <th className="px-6 py-3.5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.entries(performanceData.sensor_health?.sensors ?? {}).map(([sensorKey, s]) => {
                            const displayName = SENSOR_DISPLAY_NAMES[sensorKey] || sensorKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                            const isFault = performanceData.sensor_health?.active_faults?.includes(sensorKey) ||
                                            performanceData.sensor_health?.active_faults?.includes(displayName)

                            return (
                              <tr
                                key={sensorKey}
                                className={`transition-colors ${
                                  isFault
                                    ? 'bg-rose-50/60 hover:bg-rose-50'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="px-6 py-3.5 font-medium text-midnight">
                                  <div className="flex items-center gap-2">
                                    <span>{displayName}</span>
                                    {isFault && (
                                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 uppercase">
                                        Fault Active
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-storm/80">
                                  {s.total_readings.toLocaleString()}
                                </td>
                                <td className="px-4 py-3.5 text-storm/80">
                                  {s.null_readings.toLocaleString()}
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2.5">
                                    <span className="font-semibold text-midnight min-w-[45px]">
                                      {s.completeness_pct.toFixed(1)}%
                                    </span>
                                    <div className="h-1.5 w-16 bg-slate-200/70 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          s.completeness_pct >= 95
                                            ? 'bg-emerald'
                                            : s.completeness_pct >= 80
                                              ? 'bg-amber-500'
                                              : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${Math.min(100, Math.max(0, s.completeness_pct))}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-storm/80">
                                  {s.fault_events > 0 ? (
                                    <span>
                                      <span className="font-semibold text-midnight">{s.fault_events}</span>
                                      <span className="ml-1.5 text-[11px] text-storm/50">
                                        {(Object.entries(s.faults_by_type ?? {}) as [SensorFaultType, number][])
                                          .filter(([, count]) => count > 0)
                                          .map(([type, count]) => `${count} ${FAULT_TYPE_LABELS[type].toLowerCase()}`)
                                          .join(', ')}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-storm/40">None</span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-storm/80">
                                  {s.fault_minutes > 0 ? formatDuration(s.fault_minutes) : '—'}
                                </td>
                                <td className="px-6 py-3.5 text-right">
                                  {s.completeness_pct >= 95 && s.fault_events === 0 ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald">
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                      Optimal
                                    </span>
                                  ) : s.completeness_pct >= 80 ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" />
                                        <line x1="12" y1="17" x2="12.01" y2="17" />
                                      </svg>
                                      Warning
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                      </svg>
                                      Critical
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="border-t border-slate-100 p-6 space-y-3">
                      <h4 className="text-sm font-bold text-midnight font-display">Sensor Fault Events</h4>
                      {(performanceData.sensor_health?.fault_events ?? []).length > 0 ? (
                        <EventTable
                          rows={[...performanceData.sensor_health.fault_events].sort((a, b) => b.duration_minutes - a.duration_minutes)}
                          columns={['Sensor', 'Fault', 'Start Time', 'Duration', 'Readings']}
                          renderRow={(event) => [
                            SENSOR_DISPLAY_NAMES[event.sensor] || event.sensor,
                            FAULT_TYPE_LABELS[event.type],
                            new Date(event.start).toLocaleString(),
                            formatDuration(event.duration_minutes),
                            event.readings.toLocaleString(),
                          ]}
                          noun="fault events"
                        />
                      ) : (
                        <p className="text-xs text-storm/60">No missing, out-of-range or stuck sensor values in this period.</p>
                      )}
                      <p className="text-[11px] text-storm/50">
                        Logger errors: {performanceData.sensor_health?.logger_errors?.clock_ahead_readings ?? 0} reading(s) timestamped ahead of the server clock,{' '}
                        {performanceData.sensor_health?.logger_errors?.duplicate_readings ?? 0} duplicate reading(s).
                      </p>
                    </div>
                  </div>

                  {/* Maintenance Log Section */}
                  <MaintenanceLogPanel
                    stationCode={performanceData.station_code}
                    periodStart={performanceData.period_start}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
