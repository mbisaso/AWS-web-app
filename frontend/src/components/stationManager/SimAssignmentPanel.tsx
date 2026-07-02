import { useEffect, useState } from 'react'
import type { SimAccount, StationManagementData } from '../../services/api'
import { fetchSimAccounts, createSimAccount, updateSimAccount, assignSimToStation, unassignSimFromStation } from '../../services/api'

interface SimAssignmentPanelProps {
  station: StationManagementData
  onUpdate: () => void
}

export function SimAssignmentPanel({ station, onUpdate }: SimAssignmentPanelProps) {
  const [sims, setSims] = useState<SimAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newCarrier, setNewCarrier] = useState('')
  const [newIccid, setNewIccid] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newBundle, setNewBundle] = useState(500)
  const [newExpiry, setNewExpiry] = useState('')
  const [editPhone, setEditPhone] = useState(false)
  const [editPhoneValue, setEditPhoneValue] = useState('')

  const currentSim = sims.find((s) => s.station_id === station.id)

  const handleSavePhone = async () => {
    if (!currentSim) return
    await updateSimAccount(currentSim.id, { phone_number: editPhoneValue })
    const updated = await fetchSimAccounts()
    setSims(updated)
    setEditPhone(false)
  }

  useEffect(() => {
    fetchSimAccounts().then((data) => { setSims(data); setLoading(false) })
  }, [])

  const handleAssign = async (simId: number) => {
    setAssigning(true)
    try {
      await assignSimToStation(simId, station.id)
      const updated = await fetchSimAccounts()
      setSims(updated)
      onUpdate()
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassign = async () => {
    if (!currentSim) return
    setAssigning(true)
    try {
      await unassignSimFromStation(currentSim.id)
      const updated = await fetchSimAccounts()
      setSims(updated)
      onUpdate()
    } finally {
      setAssigning(false)
    }
  }

  const handleAddSim = async () => {
    if (!newCarrier || !newIccid) return
    setAssigning(true)
    try {
      await createSimAccount({
        carrier: newCarrier,
        iccid: newIccid,
        phone_number: newPhone,
        bundle_size_mb: newBundle,
        expiry_date: newExpiry || undefined,
      })
      const updated = await fetchSimAccounts()
      setSims(updated)
      setShowAdd(false)
      setNewCarrier('')
      setNewIccid('')
      setNewPhone('')
      setNewBundle(500)
      setNewExpiry('')
    } finally {
      setAssigning(false)
    }
  }

  const usagePct = currentSim && currentSim.bundle_size_mb > 0
    ? Math.round((currentSim.usage_mb / currentSim.bundle_size_mb) * 100)
    : 0

  if (loading) {
    return <div className="space-y-2"><div className="h-4 w-32 animate-pulse rounded bg-slate-200" /><div className="h-4 w-48 animate-pulse rounded bg-slate-200" /></div>
  }

  return (
    <div className="space-y-3">
      {/* ── Current SIM ── */}
      {currentSim ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-storm/60">{currentSim.carrier}</p>
              <p className="text-xs font-medium text-midnight font-mono">{currentSim.iccid}</p>
              <div className="mt-0.5 flex items-center gap-1">
                {editPhone ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editPhoneValue}
                      onChange={(e) => setEditPhoneValue(e.target.value)}
                      className="w-32 rounded border border-sky-200 px-1.5 py-0.5 text-xs text-midnight focus:outline-2 focus:outline-offset-1 focus:outline-sky-primary"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSavePhone}
                      className="cursor-pointer rounded bg-sky-primary px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-sky-deep"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPhone(false)}
                      className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-storm/50 hover:text-storm/70"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditPhoneValue(currentSim.phone_number); setEditPhone(true) }}
                    className="group flex items-center gap-1 text-xs text-storm/40 hover:text-storm/60"
                  >
                    <span>{currentSim.phone_number || <span className="italic">No phone</span>}</span>
                    <svg className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-storm/40">
              <span>{currentSim.usage_mb} MB / {currentSim.bundle_size_mb} MB</span>
              <span>{usagePct}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all duration-300 ${usagePct > 90 ? 'bg-rose' : usagePct > 70 ? 'bg-amber' : 'bg-emerald'}`} style={{ width: `${usagePct}%` }} />
            </div>
          </div>
          {currentSim.expiry_date && (
            <p className="mt-1.5 text-[11px] text-storm/40">Expires: {new Date(currentSim.expiry_date).toLocaleDateString()}</p>
          )}
          <button
            type="button"
            onClick={handleUnassign}
            disabled={assigning}
            className="mt-2 cursor-pointer rounded-lg border border-rose-200 px-3 py-1 text-[11px] font-medium text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
          >
            Unassign
          </button>
        </div>
      ) : (
        <p className="text-sm text-storm/40">No SIM assigned to this station.</p>
      )}

      {/* ── Assign new SIM ── */}
      <div>
        <label htmlFor="sim-assign-select" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Assign SIM</label>
        <div className="flex gap-2">
          <select
            id="sim-assign-select"
            className="flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
            value=""
            onChange={(e) => { if (e.target.value) handleAssign(Number(e.target.value)) }}
            disabled={assigning}
          >
            <option value="">Select a SIM…</option>
            {sims.filter((s) => !s.station_id || s.station_id === station.id).map((s) => (
              <option key={s.id} value={s.id}>{s.carrier} · {s.iccid.slice(-6)} ({s.usage_mb}/{s.bundle_size_mb} MB)</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-storm/60 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
          >
            + New
          </button>
        </div>
      </div>

      {/* ── Add new SIM form ── */}
      {showAdd && (
        <div className="rounded-xl border border-sky-200 bg-sky-soft p-3.5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-deep">New SIM Account</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sim-carrier" className="text-[11px] font-medium text-storm/60">Carrier</label>
              <input id="sim-carrier" type="text" value={newCarrier} onChange={(e) => setNewCarrier(e.target.value)} className="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
            </div>
            <div>
              <label htmlFor="sim-iccid" className="text-[11px] font-medium text-storm/60">ICCID</label>
              <input id="sim-iccid" type="text" value={newIccid} onChange={(e) => setNewIccid(e.target.value)} className="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
            </div>
            <div>
              <label htmlFor="sim-phone" className="text-[11px] font-medium text-storm/60">Phone</label>
              <input id="sim-phone" type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
            </div>
            <div>
              <label htmlFor="sim-bundle" className="text-[11px] font-medium text-storm/60">Bundle (MB)</label>
              <input id="sim-bundle" type="number" value={newBundle} onChange={(e) => setNewBundle(Number(e.target.value) || 0)} className="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
            </div>
            <div>
              <label htmlFor="sim-expiry" className="text-[11px] font-medium text-storm/60">Expiry</label>
              <input id="sim-expiry" type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} className="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddSim}
            disabled={assigning || !newCarrier || !newIccid}
            className="cursor-pointer rounded-lg bg-sky-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary disabled:opacity-50"
          >
            Add & assign
          </button>
        </div>
      )}
    </div>
  )
}
