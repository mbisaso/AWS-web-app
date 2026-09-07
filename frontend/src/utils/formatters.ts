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
