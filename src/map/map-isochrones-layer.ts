import L from "leaflet";

// Slightly tweaked, higher-contrast palette (keeps the blue->red progression)
const defaultIsochroneColors = [
  "#2b83ba",
  "#2fa09d",
  "#6fae6b",
  "#b7d36a",
  "#f6f7b4",
  "#ffd77f",
  "#ffb075",
  "#ff8b66",
  "#e85b3a",
  "#c72a28"
];

function darkenHex(hex: string, factor = 0.6) {
  // hex may be like #rrggbb
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const rr = Math.max(0, Math.min(255, Math.round(r * factor)));
  const gg = Math.max(0, Math.min(255, Math.round(g * factor)));
  const bb = Math.max(0, Math.min(255, Math.round(b * factor)));
  return '#' + [rr, gg, bb].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export class MapIsochronesLayer {
  private map: L.Map;
  private layerGroup: L.LayerGroup;

  constructor(map: L.Map) {
    this.map = map;
    this.layerGroup = L.layerGroup().addTo(this.map);
  }

  /**
   * Usuwa wszystkie izochrony z mapy
   */
  clear(): void {
    this.layerGroup.clearLayers();
  }

  /**
   * Rysuje izochrony na mapie
   * @param geoJson odpowiedź z ORS (FeatureCollection)
   */
  render(geoJson: any): void {
    this.clear();

    if (!geoJson || !geoJson.features) {
      console.warn("Isochrones: brak danych GeoJSON");
      return;
    }

    geoJson.features.forEach((feature: any, index: number) => {
      const color = defaultIsochroneColors[index % defaultIsochroneColors.length];
      const stroke = darkenHex(color, 0.55);

      const layer = L.geoJSON(feature, {
        style: {
          color: stroke,      // darker stroke for contrast
          fillColor: color,
          weight: 2,
          opacity: 0.95,
          fillOpacity: 0.6
        }
      });

      layer.addTo(this.layerGroup);
    });
  }
}
