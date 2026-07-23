import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { PageHeader } from '../components/shared/PageHeader'
import { StationTable } from '../components/stationManager/StationTable'
import { StationFormModal } from '../components/stationManager/StationFormModal'
import { UserTable } from '../components/stationManager/UserTable'
import { UserFormModal } from '../components/stationManager/UserFormModal'
import { ConfirmDialog } from '../components/stationManager/ConfirmDialog'
import {
  fetchUsers,
  createUser,
  updateUser,
  disableUser as apiDisableUser,
  deleteUser as apiDeleteUser,
} from '../services/api'
import { fetchStations, createStation, updateStation, deleteStation } from '../api/stations'
import type { StationManagementData, UserAccount } from '../services/api'
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
    phone_number: '',
    created_at: s.status?.last_updated ?? new Date().toISOString(),
    is_active: true,
  }
}

type Tab = 'stations' | 'users'

export function StationManagerPage() {
  const { user, isLoading: userLoading } = useCurrentUser()
  const isAdmin = user?.role === 'admin'

  const [activeTab, setActiveTab] = useState<Tab>('stations')

  const [stations, setStations] = useState<StationManagementData[]>([])
  const [users, setUsers] = useState<UserAccount[]>([])
  const [loadingStations, setLoadingStations] = useState(true)
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
    setLoadingUsers(true)
    fetchUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoadingUsers(false))
  }, [isAdmin, refreshTrigger])

  /* ── Station modals ── */
  const [stationFormOpen, setStationFormOpen] = useState(false)
  const [editingStation, setEditingStation] = useState<StationManagementData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StationManagementData | null>(null)

  const handleSaveStation = async (data: Partial<StationManagementData>) => {
    try {
      const payload: Partial<Station> = {
        name: data.name,
        station_id: data.station_code,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        expected_interval_minutes: data.expected_interval_minutes,
        phone_number: data.phone_number,
        sensors: data.sensors,
        notes: data.notes,
      }
      
      if (editingStation) {
        await updateStation(editingStation.id, payload)
      } else {
        await createStation(payload)
      }
      
      // Close modal and refresh table
      setStationFormOpen(false)
      setEditingStation(null)
      refresh()
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Failed to save station')
    }
  }


  const handleDeleteStation = async () => {
    if (!deleteTarget) return
    try {
      await deleteStation(deleteTarget.id)
      setDeleteTarget(null)
      refresh()
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Failed to delete station')
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
    { key: 'users', label: 'Users' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header ── */}
        <PageHeader
          label="Administration"
          title="Station manager"
          subtitle="Manage stations, SIM accounts, and user access"
          variant="admin"
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          }
        />

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
                className={`cursor-pointer px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 -mb-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${
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
                className="cursor-pointer rounded-xl bg-gradient-to-r from-sky-primary to-sky-deep px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-200/50 transition-all duration-200 hover:shadow-lg hover:shadow-sky-200/60 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
              >
                + Add station
              </button>
            </div>

            <StationTable
              stations={stations}
              isLoading={loadingStations}
              onEdit={(s) => { setEditingStation(s); setStationFormOpen(true) }}
              onDelete={(s) => setDeleteTarget(s)}
            />
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
                className="cursor-pointer rounded-xl bg-gradient-to-r from-sky-primary to-sky-deep px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-200/50 transition-all duration-200 hover:shadow-lg hover:shadow-sky-200/60 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
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
