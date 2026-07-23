import { useCallback, useRef, useState } from 'react'

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const keyRef = useRef(key)
  keyRef.current = key

  const setPersistedState = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
      try {
        localStorage.setItem(keyRef.current, JSON.stringify(next))
      } catch { /* ignore */ }
      return next
    })
  }, [])

  return [state, setPersistedState]
}
