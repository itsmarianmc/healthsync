type ReverseGeocodeResponse = {
  display_name?: string;
  name?: string;
  address?: Record<string, string | undefined>;
};

const LOCATION_PART_KEYS = [
  'city',
  'town',
  'village',
  'hamlet',
  'municipality',
  'county',
  'state',
  'country',
] as const;

function buildLocationName(address?: Record<string, string | undefined>, fallback = ''): string {
  if (!address) return fallback;

  const parts = LOCATION_PART_KEYS.map((key) => address[key]).filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.slice(0, 2).join(', ') : fallback;
}

export async function reverseGeocodeLocation(latitude: number, longitude: number): Promise<string> {
  const fallback = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: latitude.toString(),
    lon: longitude.toString(),
    addressdetails: '1',
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status}`);
    }

    const data = (await response.json()) as ReverseGeocodeResponse;
    return buildLocationName(data.address, data.name || data.display_name || fallback);
  } catch {
    return fallback;
  }
}