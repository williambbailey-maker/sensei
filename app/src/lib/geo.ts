import type { LatLng } from './types'

// Great-circle distance in miles — plenty accurate at city scale.
export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function formatMiles(mi: number): string {
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`
}

// The shop's street address without the trailing ", USA" the feed adds.
export function shortAddress(address: string | null | undefined): string | null {
  const a = (address ?? '').trim().replace(/,\s*USA$/, '')
  return a || null
}

// Google Maps directions to a shop, the same link the SEO dispensary pages
// use: name + address resolves to the business listing; coordinates are the
// fallback when there's no address.
export function directionsUrl(
  name: string,
  address: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined,
): string {
  const a = shortAddress(address)
  const dest = a ? `${name}, ${a}` : lat != null && lng != null ? `${lat},${lng}` : `${name}, New York, NY`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
}

// Ask the browser for the user's position. Requires a user gesture-adjacent
// call and https (or localhost). Errors surface as a friendly message.
export function requestLocation(
  onOk: (loc: LatLng) => void,
  onErr: (message: string) => void,
): void {
  if (!('geolocation' in navigator)) {
    onErr('Location is not available in this browser.')
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => onOk({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => {
      onErr(
        err.code === err.PERMISSION_DENIED
          ? 'Location permission was denied — allow it in your browser settings, or pick a borough instead.'
          : 'Could not get your location — pick a borough instead.',
      )
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
  )
}
