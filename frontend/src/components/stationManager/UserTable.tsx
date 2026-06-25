import { useMemo, useState } from 'react'
import type { UserAccount, UserRole } from '../../services/api'
import { USER_ROLE_LABELS } from '../../services/api'

interface UserTableProps {
  users: UserAccount[]
  isLoading: boolean
  currentUserId: number
  onEdit: (user: UserAccount) => void
  onDisable: (user: UserAccount) => void
  onDelete: (user: UserAccount) => void
}

type SortKey = 'name' | 'email' | 'role' | 'status' | 'last_login'

export function UserTable({ users, isLoading, currentUserId, onEdit, onDisable, onDelete }: UserTableProps) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = useMemo(() => {
    let list = users
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }
    if (roleFilter !== 'all') list = list.filter((u) => u.role === roleFilter)
    if (statusFilter !== 'all') list = list.filter((u) => u.status === statusFilter)
    list.sort((a, b) => {
      const aVal = String(a[sortKey] ?? '')
      const bVal = String(b[sortKey] ?? '')
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
    return list
  }, [users, search, roleFilter, statusFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortArrow({ column }: { column: SortKey }) {
    if (sortKey !== column) return null
    return <span className="ml-1 text-[10px]" aria-hidden="true">{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    )
  }

  if (!users.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-soft text-sky-bright">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-midnight">No users yet</p>
        <p className="mt-1 text-xs text-storm/40">Invite users to collaborate on station management.</p>
      </div>
    )
  }

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-xs">
        <p className="text-sm font-medium text-midnight">No users match your filters</p>
        <p className="mt-1 text-xs text-storm/40">Try adjusting the search or filter criteria.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight placeholder:text-storm/30 focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          aria-label="Search users"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" aria-label="Filter by role">
          <option value="all">All roles</option>
          {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((r) => (
            <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full min-w-[600px] text-sm" role="table">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <Th sortable onClick={() => toggleSort('name')}><SortArrow column="name" />Name</Th>
              <Th sortable onClick={() => toggleSort('email')}><SortArrow column="email" />Email</Th>
              <Th sortable onClick={() => toggleSort('role')}><SortArrow column="role" />Role</Th>
              <Th sortable onClick={() => toggleSort('status')}><SortArrow column="status" />Status</Th>
              <Th sortable onClick={() => toggleSort('last_login')}><SortArrow column="last_login" />Last login</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3.5">
                  <span className="font-medium text-midnight">{user.name}</span>
                  {user.id === currentUserId && <span className="ml-2 text-[10px] text-sky-primary font-medium">(you)</span>}
                </td>
                <td className="px-4 py-3.5 text-storm/70 text-xs">{user.email}</td>
                <td className="px-4 py-3.5">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={user.status} />
                </td>
                <td className="px-4 py-3.5 text-xs text-storm/40">
                  {user.last_login ? new Date(user.last_login).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <ActionBtn onClick={() => onEdit(user)} label="Edit" />
                    <ActionBtn onClick={() => onDisable(user)} label={user.status === 'disabled' ? 'Enable' : 'Disable'} variant="warning" />
                    <ActionBtn onClick={() => onDelete(user)} label="Remove" variant="danger" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, sortable, onClick, className }: { children: React.ReactNode; sortable?: boolean; onClick?: () => void; className?: string }) {
  const base = 'px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40'
  if (sortable) {
    return <th className={`${base} cursor-pointer select-none hover:text-storm/60 ${className ?? ''}`} onClick={onClick} scope="col">{children}</th>
  }
  return <th className={`${base} ${className ?? ''}`} scope="col">{children}</th>
}

function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    admin: 'bg-purple-50 text-purple-700',
    analyst: 'bg-blue-50 text-blue-700',
    technician: 'bg-amber-50 text-amber-700',
    public_viewer: 'bg-slate-100 text-storm/60',
  }
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles[role]}`}>{USER_ROLE_LABELS[role]}</span>
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-deep">Active</span>
  if (status === 'invited') return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600">Invited</span>
  return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-storm/50">Disabled</span>
}

function ActionBtn({ onClick, label, variant }: { onClick: () => void; label: string; variant?: 'danger' | 'warning' }) {
  const color = variant === 'danger' ? 'text-rose-600 hover:bg-rose-50' : variant === 'warning' ? 'text-amber-600 hover:bg-amber-50' : 'text-sky-primary hover:bg-sky-soft'
  return (
    <button type="button" onClick={onClick} className={`cursor-pointer rounded-lg px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${color}`}>
      {label}
    </button>
  )
}
