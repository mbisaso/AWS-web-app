/**
 * Formats numbers or string numeric values such that if a value has more than
 * 4 decimal places, it is truncated to 4 decimal places.
 *
 * Values with 0, 1, 2, 3, or 4 decimal places remain untouched (no extra trailing zeros padded).
 *
 * Examples:
 *  25          -> "25"
 *  25.1        -> "25.1"
 *  25.12       -> "25.12"
 *  25.123      -> "25.123"
 *  25.1234     -> "25.1234"
 *  25.12345678 -> "25.1234"
 *  null        -> ""
 */
export function formatDecimal(
  val: number | string | null | undefined,
  maxDecimals = 4,
): string {
  if (val == null || val === '') return ''
  const str = String(val)
  const parts = str.split('.')
  if (parts.length === 2 && parts[1].length > maxDecimals) {
    return `${parts[0]}.${parts[1].slice(0, maxDecimals)}`
  }
  return str
}

/**
 * Formats a timestamp into a clean, simple representation for CSV exports:
 * "YYYY-MM-DD HH:MM:SS" (e.g. "2026-09-30 08:46:46").
 *
 * Automatically converts ISO dates (with T, milliseconds, or UTC/offset)
 * into Kampala station time (UTC+3) without extra symbols so spreadsheet
 * tools like Microsoft Excel easily read and display the date and time.
 */
export function formatCsvTimestamp(ts: string | null | undefined): string {
  if (!ts) return ''
  const str = String(ts).trim()
  if (!str) return ''

  // If already in target format YYYY-MM-DD HH:MM:SS, return as-is
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    return str
  }

  const d = new Date(str)
  if (isNaN(d.getTime())) {
    const m = str.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/)
    return m ? `${m[1]} ${m[2]}` : str
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const map: Record<string, string> = {}
  for (const part of parts) {
    map[part.type] = part.value
  }

  const hour = map.hour === '24' ? '00' : map.hour
  return `${map.year}-${map.month}-${map.day} ${hour}:${map.minute}:${map.second}`
}
