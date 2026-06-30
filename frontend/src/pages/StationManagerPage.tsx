import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { StationTable } from '../components/stationManager/StationTable'
import { StationFormModal } from '../components/stationManager/StationFormModal'
import { SimAssignmentPanel } from '../components/stationManager/SimAssignmentPanel'
import { UserTable } from '../components/stationManager/UserTable'
import { UserFormModal } from '../components/stationManager/UserFormModal'
import { ConfirmDialog } from '../components/stationManager/ConfirmDialog'
import {
  createStation,
  updateStation,
  decommissionStation as apiDecommissionStation,
  deleteStation as apiDeleteStation,
  fetchSimAccounts,
  createSimAccount,
  fetchUsers,
  createUser,
  updateUser,
  disableUser as apiDisableUser,
  deleteUser as apiDeleteUser,
} from '../services/api'
import { fetchStations } from '../api/stations'
import type { StationManagementData, SimAccount, UserAccount } from '../services/api'
import type { Station } from '../types'

function toStationManagementData(s: Station): StationManagementData {
  const statusMap: Record<string, 'online' | 'partial' | 'offline'> = {
    full: 'online',
    partial: 'partial',
    down: 'offline',
  }
  return {
    id: s.id,
    name: s.name,
    station_code: s.station_id,
    location: s.location,
    latitude: s.latitude ?? 0,
    longitude: s.longitude ?? 0,
    status: statusMap[s.status?.status ?? 'down'] ?? 'offline',
    connectivity: 'gsm',
    expected_interval_minutes: s.expected_interval_minutes,
    sensors: [],
    notes: '',
    sim_id: null,
    created_at: s.status?.last_updated ?? new Date().toISOString(),
    is_active: true,
  }
}

type Tab = 'stations' | 'sims' | 'users'

export function StationManagerPage() {
  const { user, isLoading: userLoading } = useCurrentUser()
  const isAdmin = user?.role === 'admin'

  const [activeTab, setActiveTab] = useState<Tab>('stations')

  const [stations, setStations] = useState<StationManagementData[]>([])
  const [sims, setSims] = useState<SimAccount[]>([])
  const [users, setUsers] = useState<UserAccount[]>([])
  const [loadingStations, setLoadingStations] = useState(true)
  const [loadingSims, setLoadingSims] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const refresh = useCallback(() => setRefreshTrigger((n) => n + 1), [])

  useEffect(() => {
    if (!isAdmin) return
    setLoadingStations(true)
    setError(null)
    fetchStations()
      .then((data) => setStations(data.map(toStationManagementData)))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingStations(false))
  }, [isAdmin, refreshTrigger])

  useEffect(() => {
    if (!isAdmin) return
    setLoadingSims(true)
    fetchSimAccounts()
      .then(setSims)
      .catch(() => {})
      .finally(() => setLoadingSims(false))
  }, [isAdmin, refreshTrigger])

  useEffect(() => {
    if (!isAdmin) return
    setLoadingUsers(true)
    fetchUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoadingUsers(false))
  }, [isAdmin, refreshTrigger])

  /* ── Station modals ── */
  const [stationFormOpen, setStationFormOpen] = useState(false)
  const [editingStation, setEditingStation] = useState<StationManagementData | null>(null)
  const [decommissionTarget, setDecommissionTarget] = useState<StationManagementData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StationManagementData | null>(null)
  const [simPanelStation, setSimPanelStation] = useState<StationManagementData | null>(null)

  const handleSaveStation = async (data: Partial<StationManagementData>) => {
    if (editingStation) {
      await updateStation(editingStation.id, data)
    } else {
      await createStation(data)
    }
    refresh()
  }

  const handleDecommission = async () => {
    if (!decommissionTarget) return
    await apiDecommissionStation(decommissionTarget.id)
    setDecommissionTarget(null)
    refresh()
  }

  const handleDeleteStation = async () => {
    if (!deleteTarget) return
    await apiDeleteStation(deleteTarget.id)
    setDeleteTarget(null)
    refresh()
  }

  /* ── SIM modals ── */
  const [showAddSim, setShowAddSim] = useState(false)
  const [newCarrier, setNewCarrier] = useState('')
  const [newIccid, setNewIccid] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newBundle, setNewBundle] = useState(500)
  const [newExpiry, setNewExpiry] = useState('')
  const [savingSim, setSavingSim] = useState(false)

  const handleAddSim = async () => {
    if (!newCarrier || !newIccid) return
    setSavingSim(true)
    try {
      await createSimAccount({
        carrier: newCarrier,
        iccid: newIccid,
        phone_number: newPhone,
        bundle_size_mb: newBundle,
        expiry_date: newExpiry || undefined,
      })
      setShowAddSim(false)
      setNewCarrier('')
      setNewIccid('')
      setNewPhone('')
      setNewBundle(500)
      setNewExpiry('')
      refresh()
    } finally {
      setSavingSim(false)
    }
  }

  /* ── User modals ── */
  const [userFormOpen, setUserFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null)
  const [disableTarget, setDisableTarget] = useState<UserAccount | null>(null)
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserAccount | null>(null)

  const handleSaveUser = async (data: Partial<UserAccount>) => {
    if (editingUser) {
      await updateUser(editingUser.id, data)
    } else {
      await createUser(data)
    }
    refresh()
  }

  const handleDisableUser = async () => {
    if (!disableTarget) return
    await apiDisableUser(disableTarget.id)
    setDisableTarget(null)
    refresh()
  }

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return
    await apiDeleteUser(deleteUserTarget.id)
    setDeleteUserTarget(null)
    refresh()
  }

  const stationNameById = useMemo(() => {
    const map = new Map<number, string>()
    stations.forEach((s) => map.set(s.id, s.name))
    return map
  }, [stations])

  /* ── SIM search ── */
  const [simSearch, setSimSearch] = useState('')
  const filteredSims = useMemo(() => {
    if (!simSearch) return sims
    const q = simSearch.toLowerCase()
    return sims.filter(
      (s) =>
        s.carrier.toLowerCase().includes(q) ||
        s.iccid.includes(q) ||
        s.phone_number.includes(q),
    )
  }, [sims, simSearch])

  /* ── Permission denied ── */
  if (!userLoading && !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
        <DashboardSidebar />
        <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-20 text-center shadow-xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <path d="M12 9v4" />
                <circle cx="12" cy="17" r="0.5" fill="currentColor" />
              </svg>
            </div>
            <h2 className="mt-5 text-lg font-semibold text-midnight font-display">Access restricted</h2>
            <p className="mt-2 text-sm text-storm/60 max-w-sm">
              Station management is only available to administrators. Contact your admin if you need access.
            </p>
          </div>
        </main>
      </div>
    )
  }

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-primary border-t-transparent" role="status">
          <span className="sr-only">Loading user session…</span>
        </div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'stations', label: 'Stations' },
    { key: 'sims', label: 'SIM Accounts' },
    { key: 'users', label: 'Users' },
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
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">Administration</p>
            </div>
            <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
              Station manager
            </h1>
            <p className="text-sm text-white/50">
              Manage stations, SIM accounts, and user access
            </p>
          </div>
          <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-sky-400/20 to-transparent" aria-hidden="true" />
        </div>

        {/* ── Tabs ── */}
        <div className="mb-6 border-b border-slate-200" role="tablist" aria-label="Station manager sections">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`cursor-pointer px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${
                  activeTab === tab.key
                    ? 'border-sky-primary text-sky-deep'
                    : 'border-transparent text-storm/40 hover:text-storm/60 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mb-6 flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
            <svg className="h-5 w-5 shrink-0 text-rose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <circle cx="12" cy="16" r="0.5" fill="currentColor" />
            </svg>
            <p className="text-sm font-medium text-rose-700">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="ml-auto shrink-0 cursor-pointer rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════
            STATIONS TAB
           ══════════════════════════════════════════ */}
        {activeTab === 'stations' && (
          <section aria-label="Stations management" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <SummaryPill label="Total" value={stations.length} color="text-midnight" bg="bg-slate-50" />
                <SummaryPill label="Online" value={stations.filter((s) => s.status === 'online').length} color="text-emerald" bg="bg-emerald-50" />
                <SummaryPill label="Partial" value={stations.filter((s) => s.status === 'partial').length} color="text-amber" bg="bg-amber-50" />
                <SummaryPill label="Offline" value={stations.filter((s) => s.status === 'offline').length} color="text-rose" bg="bg-rose-50" />
              </div>
              <button
                type="button"
                onClick={() => { setEditingStation(null); setStationFormOpen(true) }}
                className="cursor-pointer rounded-xl bg-sky-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
              >
                + Add station
              </button>
            </div>

            <StationTable
              stations={stations}
              isLoading={loadingStations}
              onEdit={(s) => { setEditingStation(s); setStationFormOpen(true) }}
              onDecommission={(s) => setDecommissionTarget(s)}
              onDelete={(s) => setDeleteTarget(s)}
              onManageSim={(s) => setSimPanelStation(s)}
            />
          </section>
        )}

        {/* ══════════════════════════════════════════
            SIM ACCOUNTS TAB
           ══════════════════════════════════════════ */}
        {activeTab === 'sims' && (
          <section aria-label="SIM accounts" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <SummaryPill label="Total" value={sims.length} color="text-midnight" bg="bg-slate-50" />
                <SummaryPill label="Active" value={sims.filter((s) => s.status === 'active').length} color="text-emerald" bg="bg-emerald-50" />
                <SummaryPill label="Assigned" value={sims.filter((s) => s.station_id).length} color="text-sky-primary" bg="bg-sky-soft" />
              </div>
              <button
                type="button"
                onClick={() => setShowAddSim(!showAddSim)}
                className="cursor-pointer rounded-xl bg-sky-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
              >
                + Add SIM
              </button>
            </div>

            {/* ── Inline add SIM form ── */}
            {showAddSim && (
              <div className="rounded-xl border border-sky-200 bg-sky-soft p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-deep">New SIM Account</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="sim-carrier-all" className="text-[11px] font-medium text-storm/60">Carrier *</label>
                    <input id="sim-carrier-all" type="text" value={newCarrier} onChange={(e) => setNewCarrier(e.target.value)} className="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
                  </div>
                  <div>
                    <label htmlFor="sim-iccid-all" className="text-[11px] font-medium text-storm/60">ICCID *</label>
                    <input id="sim-iccid-all" type="text" value={newIccid} onChange={(e) => setNewIccid(e.target.value)} className="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
                  </div>
                  <div>
                    <label htmlFor="sim-phone-all" className="text-[11px] font-medium text-storm/60">Phone</label>
                    <input id="sim-phone-all" type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
                  </div>
                  <div>
                    <label htmlFor="sim-bundle-all" className="text-[11px] font-medium text-storm/60">Bundle (MB)</label>
                    <input id="sim-bundle-all" type="number" value={newBundle} onChange={(e) => setNewBundle(Number(e.target.value) || 0)} className="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
                  </div>
                  <div>
                    <label htmlFor="sim-expiry-all" className="text-[11px] font-medium text-storm/60">Expiry</label>
                    <input id="sim-expiry-all" type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} className="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddSim}
                    disabled={savingSim || !newCarrier || !newIccid}
                    className="cursor-pointer rounded-lg bg-sky-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary disabled:opacity-50"
                  >
                    {savingSim ? 'Adding…' : 'Add SIM'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddSim(false); setNewCarrier(''); setNewIccid(''); setNewPhone(''); setNewBundle(500); setNewExpiry('') }}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-storm/60 transition-colors hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── SIM search ── */}
            <input
              type="text"
              value={simSearch}
              onChange={(e) => setSimSearch(e.target.value)}
              placeholder="Search by carrier, ICCID, or phone…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight placeholder:text-storm/30 focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
              aria-label="Search SIM accounts"
            />

            {/* ── SIM table ── */}
            {loadingSims ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full min-w-[640px] text-sm" role="table">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <Th>Carrier</Th>
                      <Th>ICCID</Th>
                      <Th>Phone</Th>
                      <Th>Usage</Th>
                      <Th>Status</Th>
                      <Th>Station</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSims.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-storm/40">
                          {simSearch ? 'No SIMs match your search' : 'No SIM accounts yet'}
                        </td>
                      </tr>
                    ) : (
                      filteredSims.map((sim) => {
                        const usagePct = sim.bundle_size_mb > 0 ? Math.round((sim.usage_mb / sim.bundle_size_mb) * 100) : 0
                        return (
                          <tr key={sim.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-midnight">{sim.carrier}</td>
                            <td className="px-4 py-3 font-mono text-xs text-storm/60">
                              <span className="hidden sm:inline">{sim.iccid}</span>
                              <span className="sm:hidden">…{sim.iccid.slice(-6)}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-storm/60">{sim.phone_number}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 max-w-24 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${usagePct > 90 ? 'bg-rose' : usagePct > 70 ? 'bg-amber' : 'bg-emerald'}`}
                                    style={{ width: `${usagePct}%` }}
                                  />
                                </div>
                                <span className="text-[11px] text-storm/40 whitespace-nowrap">
                                  {sim.usage_mb}/{sim.bundle_size_mb} MB
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${sim.status === 'active' ? 'bg-emerald-50 text-emerald' : 'bg-rose-50 text-rose'}`}>
                                {sim.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-storm/60">
                              {sim.station_id ? (stationNameById.get(sim.station_id) ?? `Station #${sim.station_id}`) : <span className="text-storm/30">—</span>}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════
            USERS TAB
           ══════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <section aria-label="User management" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <SummaryPill label="Total" value={users.length} color="text-midnight" bg="bg-slate-50" />
                <SummaryPill label="Active" value={users.filter((u) => u.status === 'active').length} color="text-emerald" bg="bg-emerald-50" />
                <SummaryPill label="Invited" value={users.filter((u) => u.status === 'invited').length} color="text-amber" bg="bg-amber-50" />
                <SummaryPill label="Disabled" value={users.filter((u) => u.status === 'disabled').length} color="text-rose" bg="bg-rose-50" />
              </div>
              <button
                type="button"
                onClick={() => { setEditingUser(null); setUserFormOpen(true) }}
                className="cursor-pointer rounded-xl bg-sky-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
              >
                + Add user
              </button>
            </div>

            <UserTable
              users={users}
              isLoading={loadingUsers}
              currentUserId={user?.id ?? 0}
              onEdit={(u) => { setEditingUser(u); setUserFormOpen(true) }}
              onDisable={(u) => setDisableTarget(u)}
              onDelete={(u) => setDeleteUserTarget(u)}
            />
          </section>
        )}
      </main>

      {/* ── Station form modal ── */}
      <StationFormModal
        open={stationFormOpen}
        station={editingStation}
        onSave={handleSaveStation}
        onClose={() => { setStationFormOpen(false); setEditingStation(null) }}
      />

      {/* ── Decommission confirm ── */}
      <ConfirmDialog
        open={!!decommissionTarget}
        title="Decommission station"
        description={`Are you sure you want to decommission "${decommissionTarget?.name}"? The station will be marked offline and hidden from active views. This can be reversed.`}
        confirmLabel="Decommission"
        variant="warning"
        onConfirm={handleDecommission}
        onCancel={() => setDecommissionTarget(null)}
      />

      {/* ── Delete station confirm ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete station permanently"
        description={`This will permanently delete "${deleteTarget?.name}" and all associated data. This action cannot be undone.`}
        confirmLabel="Delete station"
        variant="danger"
        requireExtraConfirm
        extraConfirmText="DELETE"
        onConfirm={handleDeleteStation}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── SIM panel modal ── */}
      {simPanelStation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSimPanelStation(null) }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sim-panel-title"
        >
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up motion-reduce:animate-none p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 id="sim-panel-title" className="text-lg font-semibold text-midnight font-display">SIM — {simPanelStation.name}</h2>
              <button
                type="button"
                onClick={() => setSimPanelStation(null)}
                className="cursor-pointer rounded-lg p-1.5 text-storm/40 transition-colors hover:bg-slate-100 hover:text-storm/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <SimAssignmentPanel station={simPanelStation} onUpdate={refresh} />
          </div>
        </div>
      )}

      {/* ── User form modal ── */}
      <UserFormModal
        open={userFormOpen}
        user={editingUser}
        onSave={handleSaveUser}
        onClose={() => { setUserFormOpen(false); setEditingUser(null) }}
      />

      {/* ── Disable user confirm ── */}
      <ConfirmDialog
        open={!!disableTarget}
        title={disableTarget?.status === 'disabled' ? 'Enable user' : 'Disable user'}
        description={
          disableTarget?.status === 'disabled'
            ? `Re-enable "${disableTarget?.name}"? They will regain access to the platform.`
            : `Disable "${disableTarget?.name}"? They will lose access until re-enabled.`
        }
        confirmLabel={disableTarget?.status === 'disabled' ? 'Enable' : 'Disable'}
        variant="warning"
        onConfirm={handleDisableUser}
        onCancel={() => setDisableTarget(null)}
      />

      {/* ── Delete user confirm ── */}
      <ConfirmDialog
        open={!!deleteUserTarget}
        title="Remove user"
        description={`Remove "${deleteUserTarget?.name}" from the platform? This action cannot be undone.`}
        confirmLabel="Remove user"
        variant="danger"
        requireExtraConfirm
        extraConfirmText="REMOVE"
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteUserTarget(null)}
      />
    </div>
  )
}

function SummaryPill({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-xl ${bg} px-3.5 py-1.5`}>
      <span className={`text-lg font-bold font-display leading-none ${color}`}>{value}</span>
      <span className="text-[11px] font-medium text-storm/50 uppercase tracking-wide">{label}</span>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40 text-left" scope="col">{children}</th>
}
