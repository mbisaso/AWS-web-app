const PLACEHOLDER_KEY = 'YOUR_API_KEY_HERE'

function normalizeEnvValue(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === PLACEHOLDER_KEY) {
    return null
  }

  return trimmed
}

export function getGoogleMapsConfig() {
  return {
    apiKey: normalizeEnvValue(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
    mapId: normalizeEnvValue(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID),
  }
}