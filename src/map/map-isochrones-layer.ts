import L from "leaflet";

const defaultIsochroneColors = [
  "#2b83ba",
  "#64abb0",
  "#9dd3a7",
  "#c7e9ad",
  "#edf8b9",
  "#ffedaa",
  "#fec980",
  "#f99e59",
  "#e85b3a",
  "#d7191c"
];

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
      const color =
        defaultIsochroneColors[index % defaultIsochroneColors.length];

      const layer = L.geoJSON(feature, {
        style: {
          color,
          fillColor: color,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.6
        }
      });

      layer.addTo(this.layerGroup);
    });
  }
}
