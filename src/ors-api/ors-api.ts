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

  async getIsochrones(req: IsochroneRequest): Promise<any> {
    const { apiKey } = config;

    const profile = req.profile ?? "driving-car";
    const rangeType = req.rangeType ?? "distance";

    const url = `https://api.openrouteservice.org/v2/isochrones/${profile}`;

    const body = {
      locations: [req.location],
      range: [req.range],
      interval: req.interval,
      range_type: rangeType
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ORS Isochrone error: ${response.status} ${text}`);
    }

    return response.json();
  }
}
