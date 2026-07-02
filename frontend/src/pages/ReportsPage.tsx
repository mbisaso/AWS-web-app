import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReportConfig, ReportResult, ReportType, ReportStatus, ScheduledReport } from '../services/api'
import { generateReport, checkForEmptyData, fetchReportHistory, fetchScheduleList, createSchedule, updateSchedule, deleteSchedule, toggleSchedule } from '../services/api'
import { useDashboardData } from '../hooks/useDashboardData'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { ReportBuilderForm } from '../components/reports/ReportBuilderForm'
import { ScheduleList } from '../components/reports/ScheduleList'
import { ScheduleFormModal } from '../components/reports/ScheduleFormModal'
import { ReportHistoryTable } from '../components/reports/ReportHistoryTable'
import { ConfirmDialog } from '../components/stationManager/ConfirmDialog'
import type { StationReading } from '../services/api'

export function ReportsPage() {
  const { data: dashData, isLoading: dashLoading } = useDashboardData()
  const stations: StationReading[] = dashData?.stations ?? []

  /* ── Tabs: builder | schedules | history ── */
  const [tab, setTab] = useState<'builder' | 'schedules' | 'history'>('builder')

  /* ── Builder state ── */
  const [isGenerating, setIsGenerating] = useState(false)
  const [genWarning, setGenWarning] = useState<string | null>(null)
  const [genResult, setGenResult] = useState<ReportResult | null>(null)
  const announcerRef = useRef<HTMLDivElement>(null)

  const handleGenerate = useCallback(async (config: ReportConfig) => {
    setIsGenerating(true)
    setGenWarning(null)
    setGenResult(null)

    try {
      /* Check for empty data first */
      const emptyCheck = await checkForEmptyData(config)
      if (emptyCheck.empty) {
        setGenWarning(emptyCheck.message)
      }

      const result = await generateReport(config)
      setGenResult(result)
      announcerRef.current?.focus()
    } catch {
      setGenResult({
        id: 0,
        name: 'Generation failed',
        type: config.type,
        format: config.format,
        scope_summary: '',
        date_from: config.date_from,
        date_to: config.date_to,
        generated_at: new Date().toISOString(),
        generated_by: '',
        status: 'failed',
        file_size_bytes: null,
        failure_reason: 'An unexpected error occurred while generating the report.',
      })
    } finally {
      setIsGenerating(false)
      setHistoryRefresh((n) => n + 1)
    }
  }, [])

  /* ── Schedule state ── */
  const [schedules, setSchedules] = useState<ScheduledReport[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(true)
  const [schedulesError, setSchedulesError] = useState<string | null>(null)
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReport | null>(null)
  const [scheduleToDelete, setScheduleToDelete] = useState<ScheduledReport | null>(null)
  const [deletingSchedule, setDeletingSchedule] = useState(false)
  const [historyRefresh, setHistoryRefresh] = useState(0)

  const loadSchedules = useCallback(() => {
    setLoadingSchedules(true)
    setSchedulesError(null)
    fetchScheduleList()
      .then(setSchedules)
      .catch((e) => setSchedulesError(e.message))
      .finally(() => setLoadingSchedules(false))
  }, [])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules, historyRefresh])

  const handleSaveSchedule = async (data: Partial<ScheduledReport>) => {
    if (editingSchedule) {
      await updateSchedule(editingSchedule.id, data)
    } else {
      await createSchedule(data)
    }
    loadSchedules()
  }

  const handleToggleSchedule = async (s: ScheduledReport) => {
    try {
      await toggleSchedule(s.id)
      loadSchedules()
    } catch { /* ignore */ }
  }

  const handleDeleteSchedule = async () => {
    if (!scheduleToDelete) return
    setDeletingSchedule(true)
    try {
      await deleteSchedule(scheduleToDelete.id)
      setScheduleToDelete(null)
      loadSchedules()
    } finally {
      setDeletingSchedule(false)
    }
  }

  /* ── History state ── */
  const [history, setHistory] = useState<ReportResult[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTypeFilter, setHistoryTypeFilter] = useState<ReportType | 'all'>('all')
  const [historyStatusFilter, setHistoryStatusFilter] = useState<ReportStatus | 'all'>('all')
  const [historySearch, setHistorySearch] = useState('')

  const PAGE_SIZE = 10

  const loadHistory = useCallback(() => {
    setLoadingHistory(true)
    setHistoryError(null)
    fetchReportHistory({
      type: historyTypeFilter,
      status: historyStatusFilter,
      search: historySearch || undefined,
      page: historyPage,
      page_size: PAGE_SIZE,
    })
      .then((data) => { setHistory(data.history); setHistoryTotal(data.total) })
      .catch((e) => setHistoryError(e.message))
      .finally(() => setLoadingHistory(false))
  }, [historyTypeFilter, historyStatusFilter, historySearch, historyPage])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleDownload = useCallback((_report: ReportResult) => {
    /* In production this would trigger a file download.
       For mock: treat the report as already-generated and simulate a download. */
    const ext = _report.format === 'pdf' ? 'pdf' : 'csv'
    const blob = new Blob([`Mock ${_report.format.toUpperCase()} content for: ${_report.name}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${_report.name.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleRetry = useCallback((_report: ReportResult) => {
    /* Convert the failed report config into a new generate call */
    const type = _report.type
    const config: ReportConfig = {
      type,
      station_ids: [],
      date_from: _report.date_from,
      date_to: _report.date_to,
      format: _report.format,
      metrics: [],
    }
    handleGenerate(config)
  }, [handleGenerate])

  const tabs = [
    { key: 'builder' as const, label: 'Report builder' },
    { key: 'schedules' as const, label: 'Scheduled reports' },
    { key: 'history' as const, label: 'History' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header ── */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-midnight via-[#1a2a4a] to-sky-deep/30 p-6 shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-sky-primary/10 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-emerald-400/8 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <svg className="h-5 w-5 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M16 13H8" />
                <path d="M16 17H8" />
                <path d="M10 9H8" />
              </svg>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">Data export</p>
            </div>
            <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
              Reports &amp; Export
            </h1>
            <p className="text-sm text-white/50">
              Generate on-demand reports or schedule recurring exports
            </p>
          </div>
          <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-sky-400/20 to-transparent" aria-hidden="true" />
        </div>

        {/* ── Tabs ── */}
        <div className="mb-6 border-b border-slate-200" role="tablist" aria-label="Reports sections">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`cursor-pointer px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${
                  tab === t.key
                    ? 'border-sky-primary text-sky-deep'
                    : 'border-transparent text-storm/40 hover:text-storm/60 hover:border-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════
            BUILDER TAB
           ═══════════════════════ */}
        {tab === 'builder' && (
          <section aria-label="Report builder" className="space-y-4">
            {dashLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
                  <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
                </div>
              </div>
            ) : (
              <>
                {genWarning && (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 px-5 py-3.5">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <path d="M12 9v4" />
                      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                    </svg>
                    <p className="text-sm text-amber-800">{genWarning}</p>
                    <button type="button" onClick={() => setGenWarning(null)} className="ml-auto cursor-pointer rounded-lg p-1 text-amber-600 hover:bg-amber-100" aria-label="Dismiss">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {genResult && (
                  <div className={`flex items-start gap-3 rounded-2xl border px-5 py-3.5 ${
                    genResult.status === 'completed'
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-rose-200 bg-rose-50'
                  }`} role="status" aria-live="polite" tabIndex={-1} ref={announcerRef}>
                    {genResult.status === 'completed' ? (
                      <>
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <path d="M22 4 12 14.01l-3-3" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-emerald-700">Report generated successfully</p>
                          <p className="mt-0.5 text-xs text-emerald-600">
                            {genResult.name} ({genResult.file_size_bytes ? `${(genResult.file_size_bytes / 1024).toFixed(1)} KB` : ''})
                          </p>
                        </div>
                        <button type="button" onClick={() => handleDownload(genResult)} className="cursor-pointer rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-200">Download</button>
                        <button type="button" onClick={() => setGenResult(null)} className="cursor-pointer rounded-lg p-1 text-emerald-600 hover:bg-emerald-100" aria-label="Dismiss">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-rose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><circle cx="12" cy="16" r="0.5" fill="currentColor" /></svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-rose-700">Generation failed</p>
                          <p className="mt-0.5 text-xs text-rose-600">{genResult.failure_reason}</p>
                        </div>
                        <button type="button" onClick={() => setGenResult(null)} className="cursor-pointer rounded-lg p-1 text-rose-600 hover:bg-rose-100" aria-label="Dismiss">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      </>
                    )}
                  </div>
                )}

                <ReportBuilderForm
                  stations={stations}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                />
              </>
            )}
          </section>
        )}

        {/* ═══════════════════════
            SCHEDULES TAB
           ═══════════════════════ */}
        {tab === 'schedules' && (
          <section aria-label="Scheduled reports" className="space-y-4">
            {schedulesError && (
              <div className="flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
                <svg className="h-5 w-5 shrink-0 text-rose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><circle cx="12" cy="16" r="0.5" fill="currentColor" /></svg>
                <p className="text-sm font-medium text-rose-700">{schedulesError}</p>
                <button type="button" onClick={loadSchedules} className="ml-auto shrink-0 cursor-pointer rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200">Retry</button>
              </div>
            )}
            <ScheduleList
              schedules={schedules}
              isLoading={loadingSchedules}
              onToggle={handleToggleSchedule}
              onEdit={(s) => { setEditingSchedule(s); setScheduleFormOpen(true) }}
              onDelete={(s) => setScheduleToDelete(s)}
              onCreate={() => { setEditingSchedule(null); setScheduleFormOpen(true) }}
            />
          </section>
        )}

        {/* ═══════════════════════
            HISTORY TAB
           ═══════════════════════ */}
        {tab === 'history' && (
          <section aria-label="Report history" className="space-y-4">
            {historyError && (
              <div className="flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
                <svg className="h-5 w-5 shrink-0 text-rose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><circle cx="12" cy="16" r="0.5" fill="currentColor" /></svg>
                <p className="text-sm font-medium text-rose-700">{historyError}</p>
                <button type="button" onClick={loadHistory} className="ml-auto shrink-0 cursor-pointer rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200">Retry</button>
              </div>
            )}
            <ReportHistoryTable
              history={history}
              total={historyTotal}
              isLoading={loadingHistory}
              page={historyPage}
              pageSize={PAGE_SIZE}
              typeFilter={historyTypeFilter}
              statusFilter={historyStatusFilter}
              search={historySearch}
              onTypeFilterChange={(t) => { setHistoryTypeFilter(t); setHistoryPage(1) }}
              onStatusFilterChange={(s) => { setHistoryStatusFilter(s); setHistoryPage(1) }}
              onSearchChange={(q) => { setHistorySearch(q); setHistoryPage(1) }}
              onPageChange={setHistoryPage}
              onDownload={handleDownload}
              onRetry={handleRetry}
            />
          </section>
        )}

        {/* ── ARIA live region ── */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {genResult && `Report ${genResult.status === 'completed' ? 'generated successfully' : 'failed'}`}
        </div>
      </main>

      {/* ── Schedule form modal ── */}
      <ScheduleFormModal
        open={scheduleFormOpen}
        schedule={editingSchedule}
        stations={stations}
        onSave={handleSaveSchedule}
        onClose={() => { setScheduleFormOpen(false); setEditingSchedule(null) }}
      />

      {/* ── Delete schedule confirm ── */}
      <ConfirmDialog
        open={!!scheduleToDelete}
        title="Delete schedule"
        description={`Delete "${scheduleToDelete?.name}"? This will stop future reports from being generated automatically.`}
        confirmLabel="Delete schedule"
        variant="danger"
        requireExtraConfirm
        extraConfirmText="DELETE"
        onConfirm={handleDeleteSchedule}
        onCancel={() => setScheduleToDelete(null)}
        isLoading={deletingSchedule}
      />
    </div>
  )
}
