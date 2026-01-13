import config from "./config";

export interface IsochroneRequest {
  location: [number, number]; // [lon, lat]
  range: number;              // meters OR seconds
  interval: number;           // meters OR seconds
  profile?: "driving-car" | "cycling-regular" | "foot-walking";
  rangeType?: "distance" | "time";
}

export class OrsApi {
  constructor() {}

  // =====================
  // EXISTING CODE (UNCHANGED)
  // =====================

  async reverseGeocode(point: L.LatLng): Promise<string> {
    const { apiKey, reverseGeocodeUrl } = config;

    const url: string = `${reverseGeocodeUrl}api_key=${apiKey}&point.lon=${point.lng}&point.lat=${point.lat}`;
    const json = await fetch(url).then((r) => r.json());

    return json.features[0].properties.label;
  }

  /**
   * Zwraca pełny Feature z reverse geocodingu (jeśli dostępny).
   */
  async reverseGeocodeFeature(point: L.LatLng): Promise<any | null> {
    const { apiKey, reverseGeocodeUrl } = config;
    const url: string = `${reverseGeocodeUrl}api_key=${apiKey}&point.lon=${point.lng}&point.lat=${point.lat}`;

    try {
      const resp = await fetch(url);
      const json = await resp.json();
      return json.features && json.features.length ? json.features[0] : null;
    } catch (err) {
      console.error('reverseGeocodeFeature error', err);
      return null;
    }
  }

  async route(
    startPoint: L.LatLng,
    endPoint: L.LatLng,
    profile: string = "driving-car"
  ): Promise<object> {
    const { apiKey, routeServiceUrl } = config;

    const startCoords: string = `${startPoint.lng},${startPoint.lat}`;
    const endCoords: string = `${endPoint.lng},${endPoint.lat}`;

    const url: string =
      `${routeServiceUrl}${profile}` +
      `?api_key=${apiKey}` +
      `&start=${startCoords}` +
      `&end=${endCoords}`;

    const json = await fetch(url).then((r) => r.json());
    return json;
  }

  async geocode(searchTerm: string): Promise<any[]> {
    const { apiKey, geocodeServiceUrl } = config;
    const apiUrl = `${geocodeServiceUrl}api_key=${apiKey}&text=${searchTerm}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      return data.features;
    } catch (error) {
      console.error("Error fetching geocoding suggestions:", error);
      return [];
    }
  }

  // =====================
  // NEW CODE – ISOCHRONES
  // =====================

  async getIsochrones(req: IsochroneRequest,
        signal?: AbortSignal

  ): Promise<any> {
    const { apiKey } = config;

    const profile = req.profile ?? "driving-car";
    const rangeType = req.rangeType ?? "distance";

    const url = `https://api.openrouteservice.org/v2/isochrones/${profile}`;

    // build range array: if interval provided, create multiples up to range,
    // otherwise send single range value. Ensure we never send more than ORS max (10).
    const MAX_ISOCHRONES = 10;
    let ranges: number[];

    if (req.interval && req.interval > 0 && req.range >= req.interval) {
      // tentative count
      const tentativeCount = Math.floor(req.range / req.interval);

      // if too many, adjust interval to produce <= MAX_ISOCHRONES rings
      let usedInterval = req.interval;
      if (tentativeCount > MAX_ISOCHRONES) {
        usedInterval = Math.ceil(req.range / MAX_ISOCHRONES);
      }

      const temp: number[] = [];
      for (let r = usedInterval; r <= req.range; r += usedInterval) {
        temp.push(r);
        if (temp.length >= MAX_ISOCHRONES) break;
      }

      // ensure the final requested range is included (e.g. interval=8km, range=11km -> include 8km and 11km)
      const last = temp.length ? (temp[temp.length - 1] as number) : 0;
      if (last < req.range) {
        if (temp.length < MAX_ISOCHRONES) {
          temp.push(req.range);
        } else {
          // replace the last entry with the final range so user always sees the outer bound
          temp[temp.length - 1] = req.range;
        }
      }

      // dedupe & sort
      ranges = Array.from(new Set(temp)).sort((a, b) => a - b);
      // ensure we don't exceed MAX_ISOCHRONE after adjustments
      if (ranges.length > MAX_ISOCHRONES) {
        // keep first (MAX_ISOCHRONES-1) and final range
        const first = ranges.slice(0, MAX_ISOCHRONES - 1);
        const final = ranges[ranges.length - 1] as number;
        ranges = [...first, final];
      }
    } else {
      ranges = [req.range];
    }

    // Enforce a hard distance cap of 15km when using distance ranges
    if (rangeType === 'distance') {
      const MAX_METERS = 15000;
      ranges = Array.from(new Set(ranges.map(r => (r > MAX_METERS ? MAX_METERS : r)))).sort((a,b)=>a-b);
      if (ranges.length === 0) ranges = [Math.min(req.range, MAX_METERS)];
    }

    const body: any = {
      locations: [req.location],
      range: ranges,
      range_type: rangeType,
    };

const fetchOptions: RequestInit = {
  method: "POST",
  headers: {
    Authorization: apiKey,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
};

if (signal) {
  fetchOptions.signal = signal;
}

const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const text = await response.text();

      // If server error (5xx) and we sent multiple ranges, try a fallback with a single outer range.
      if (response.status >= 500 && Array.isArray(ranges) && ranges.length > 1) {
        try {
          const fallbackBody = {
            locations: [req.location],
            range: [ranges[ranges.length - 1]],
            range_type: rangeType,
          };

          const fallbackOptions: RequestInit = {
            method: "POST",
            headers: {
              Authorization: apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(fallbackBody),
          };

          if (signal) fallbackOptions.signal = signal;

          const fallbackResp = await fetch(url, fallbackOptions);
          if (fallbackResp.ok) {
            return fallbackResp.json();
          }
          // otherwise continue to throw original error below
        } catch (fallbackErr) {
          // ignore fallback error and throw original
        }
      }

      throw new Error(`ORS Isochrone error: ${response.status} ${text}`);
    }

    return response.json();
  }

  /**
   * Zwraca dostępne profile poruszania się (wartość wykorzystywana w ORS i etykieta dla UI).
   */
  getAvailableProfiles(): Array<{ value: IsochroneRequest['profile']; label: string }> {
    return [
      { value: 'driving-car', label: 'Samochód' },
      { value: 'cycling-regular', label: 'Rower' },
      { value: 'foot-walking', label: 'Pieszo' }
    ];
  }

  /**
   * Zwraca opcje typu zasięgu dla izochron (`distance` lub `time`).
   * UI może pokazywać jednostki (metry lub minuty) na podstawie tego wyboru.
   */
  getRangeTypeOptions(): Array<{ value: IsochroneRequest['rangeType']; label: string }> {
    return [
      { value: 'distance', label: 'Dystans (metry)' },
      { value: 'time', label: 'Czas (minuty)' }
    ];
  }

  /**
   * Wygeneruj izochronę dla podanego adresu tekstowego.
   * - `range` i `interval` przyjmowane są w jednostkach przyjaznych UI:
   *    - jeśli rangeType === 'distance' => metry
   *    - jeśli rangeType === 'time' => minuty (konwertowane do sekund dla ORS)
   */
  async createIsochronesByAddress(
    address: string,
    opts: {
      range: number;
      interval: number;
      profile?: IsochroneRequest['profile'];
      rangeType?: IsochroneRequest['rangeType'];
    },
    signal?: AbortSignal
  ): Promise<any> {
    const features = await this.geocode(address);
    if (!features || features.length === 0) {
      throw new Error('Nie znaleziono adresu: ' + address);
    }

    const feat = features[0];
    const [lon, lat] = feat.geometry.coordinates as [number, number];

    const rangeType = opts.rangeType ?? 'distance';
    let rangeVal = opts.range;
    let intervalVal = opts.interval;

    if (rangeType === 'time') {
      // ORS oczekuje sekund przy range_type='time', UI używa minut
      rangeVal = Math.round(rangeVal * 60);
      intervalVal = Math.round(intervalVal * 60);
    }

    // enforce 15km max for distance mode (UI may provide larger values)
    if (rangeType === 'distance') {
      const MAX_METERS = 15000;
      if (rangeVal > MAX_METERS) rangeVal = MAX_METERS;
      if (intervalVal > rangeVal) intervalVal = rangeVal;
    }

    const req: IsochroneRequest = {
      location: [lon, lat],
      range: rangeVal,
      interval: intervalVal,
      profile: opts.profile ?? 'driving-car',
      rangeType
    };

    return this.getIsochrones(req, signal);
  }
}
