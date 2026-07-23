const DATA_CACHE_PREFIX = 'aws_data_cache_'

export function setCachedData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(DATA_CACHE_PREFIX + key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch { /* quota exceeded — silently ignore */ }
}

export function getCachedData<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(DATA_CACHE_PREFIX + key)
    if (!raw) return null
    return (JSON.parse(raw) as { data: T }).data
  } catch {
    return null
  }
}

export function clearDataCache(): void {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(DATA_CACHE_PREFIX))
    keys.forEach((k) => localStorage.removeItem(k))
  } catch { /* ignore */ }
}
