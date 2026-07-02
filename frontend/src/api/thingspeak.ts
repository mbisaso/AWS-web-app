import type { PowerChart } from '../types'

const THINGSPEAK_URL =
  'https://api.thingspeak.com/channels/3304681/feeds.json?start=2026-03-18T00:00:00Z&results=1000'

interface ThingSpeakFeed {
  created_at: string
  entry_id: number
  field1: string | null
  field2: string | null
  field3: string | null
  field4: string | null
  field5: string | null
}

interface ThingSpeakResponse {
  channel: { id: number; name: string }
  feeds: ThingSpeakFeed[]
}

export async function fetchThingSpeakPower(): Promise<PowerChart[]> {
  const res = await fetch(THINGSPEAK_URL)
  if (!res.ok) throw new Error(`ThingSpeak request failed: ${res.status} ${res.statusText}`)
  const json: ThingSpeakResponse = await res.json()
  return json.feeds
    .map((f) => ({
      timestamp: f.created_at,
      volt_3v3: f.field1 !== null && f.field1 !== '' ? parseFloat(f.field1) : null,
      volt_5v: f.field2 !== null && f.field2 !== '' ? parseFloat(f.field2) : null,
      volt_batt: f.field3 !== null && f.field3 !== '' ? parseFloat(f.field3) : null,
      volt_solar: f.field4 !== null && f.field4 !== '' ? parseFloat(f.field4) : null,
      volt_dc: f.field5 !== null && f.field5 !== '' ? parseFloat(f.field5) : null,
      curr_batt: null,
      curr_solar: null,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}
