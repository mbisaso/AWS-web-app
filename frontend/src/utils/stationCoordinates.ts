/** True when lat/lng can be shown on a map (registered, in range, not the 0,0 placeholder). */
export function hasValidCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  if (latitude == null || longitude == null) return false
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false
  if (latitude === 0 && longitude === 0) return false
  return true
}

export function toLatLng(
  latitude: number,
  longitude: number,
): google.maps.LatLngLiteral {
  return { lat: latitude, lng: longitude }
}

export function fitMapToStations(
  map: google.maps.Map,
  stations: { latitude: number; longitude: number }[],
  padding = 60,
): void {
  const bounds = new google.maps.LatLngBounds()
  let count = 0
  for (const station of stations) {
    if (!hasValidCoordinates(station.latitude, station.longitude)) continue
    bounds.extend(toLatLng(station.latitude, station.longitude))
    count += 1
  }
  if (count === 0) return
  if (count === 1) {
    map.setCenter(bounds.getCenter()!)
    map.setZoom(12)
    return
  }
  map.fitBounds(bounds, padding)
}
