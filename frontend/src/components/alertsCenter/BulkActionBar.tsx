import { useState } from 'react'

interface BulkActionBarProps {
  selectedCount: number
  onResolveSelected: (note?: string) => void
  onClearSelection: () => void
}

export function BulkActionBar({ selectedCount, onResolveSelected, onClearSelection }: BulkActionBarProps) {
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [note, setNote] = useState('')

  if (selectedCount === 0) return null

  const handleResolve = () => {
    onResolveSelected(showNoteInput ? note.trim() || undefined : undefined)
    setShowNoteInput(false)
    setNote('')
  }

  return (
    <div
      className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-2 rounded-b-2xl border-t border-sky-200 bg-sky-soft px-5 py-3 shadow-lg sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      role="toolbar"
      aria-label="Bulk actions"
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-sky-deep">
          <span className="font-bold">{selectedCount}</span> alert{selectedCount !== 1 ? 's' : ''} selected
        </p>

        <div className="flex flex-1 items-center gap-2">
          {showNoteInput && (
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional resolution note…"
              className="flex-1 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm text-midnight placeholder:text-storm/30 focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
              aria-label="Resolution note"
              autoFocus
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNoteInput(!showNoteInput)}
            className="cursor-pointer rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-deep transition-colors hover:bg-sky-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
            aria-label={showNoteInput ? 'Hide note input' : 'Add resolution note'}
          >
            {showNoteInput ? 'Cancel' : '+ Note'}
          </button>

          <button
            type="button"
            onClick={handleResolve}
            className="cursor-pointer rounded-lg bg-emerald px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald"
            aria-label={`Mark ${selectedCount} selected alerts as resolved`}
          >
            Mark resolved
          </button>

          <button
            type="button"
            onClick={onClearSelection}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-storm/60 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            aria-label="Clear selection"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
