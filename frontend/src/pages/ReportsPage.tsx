import { useState } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useExportDataPreview, useExportCsvUrl } from '../hooks/useExportData'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { PageHeader } from '../components/shared/PageHeader'
import type { ExportConfig, StationReading } from '../services/api'

export function ReportsPage() {
  const { data: dashData } = useDashboardData()
  const stations: StationReading[] = dashData?.stations ?? []

  const [stationId, setStationId] = useState<string>('')
  const [hours, setHours] = useState<number>(168)
  const [fields, setFields] = useState<'all' | 'sensor' | 'power'>('all')

  const config: ExportConfig = {
    station_id: stationId || undefined,
    hours,
    fields,
  }

  const { data: previewData, isLoading: previewLoading, isFetching } = useExportDataPreview(config)
  const csvUrl = useExportCsvUrl(config)

  const handleDownloadCsv = () => {
    window.open(csvUrl, '_blank')
  }

  const handlePresetHours = (h: number) => setHours(h)

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        <PageHeader
          label="Reporting"
          title="Data Export Hub"
          subtitle="Extract historical sensor and power diagnostics directly from the cloud"
          variant="admin"
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          }
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-12">
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
                  disabled={previewLoading || !previewData?.count}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-midnight px-4 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download CSV
                </button>
                <p className="mt-3 text-center text-[10px] text-storm/40">
                  Data will be exported in UTC format
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
                  {isFetching && (
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
      </main>
    </div>
  )
}
