import "@vaadin/notification";
import type { NotificationLitRenderer } from "@vaadin/notification/lit.js";
import { notificationRenderer } from "@vaadin/notification/lit.js";
import L, { LeafletMouseEvent } from "leaflet";
import { LitElement, css, html, render } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { OrsApi } from "../../ors-api/ors-api";
import { MapIsochronesLayer } from "../../map/map-isochrones-layer";

import "../ors-custom-contextmenu";
import "../ors-progress-bar";

import markerIconGreen from "./assets/img/marker-icon-green.png";
import markerIconRed from "./assets/img/marker-icon-red.png";

@customElement("ors-map")
export class OrsMap extends LitElement {
  @state() map?: L.Map;
  @state() contextMenu?: L.Popup;

  @state() markerGreen: L.Marker = new L.Marker([0, 0], {
    opacity: 0,
    draggable: true,
  });

  @state() markerRed: L.Marker = new L.Marker([0, 0], {
    opacity: 0,
    draggable: true,
  });

  @state() searchMarker: L.Marker = new L.Marker([0, 0], {
    opacity: 0,
  });

  @state() isochroneCenterMarker: L.Marker = new L.Marker([0, 0], {
    opacity: 0,
  });

  @state() currentLatLng?: L.LatLng;
  @state() orsApi: OrsApi = new OrsApi();

  @state() routeStartLabel: string = "";
  @state() routeStopLabel: string = "";
  @state() searchLabel: string = "";

  @state() routeLayer: L.GeoJSON = new L.GeoJSON();
  @state() isochronesLayer?: MapIsochronesLayer;

  @property({ type: Number }) currentTabIdx: number = 0;

  @state() basemap: L.TileLayer = new L.TileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "OpenStreetMap",
    }
  );

  @state() startIcon = new L.Icon({
    iconUrl: markerIconGreen,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  @state() endIcon = new L.Icon({
    iconUrl: markerIconRed,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  @state() routeStyle = {
    color: "#ff7800",
    weight: 5,
    opacity: 0.65,
  };

  private isochroneDebounceTimer?: number;
  private lastIsochroneRequestTime = 0;
  private readonly ISOCHRONE_MIN_INTERVAL = 1000; // 1 sekunda
  private isochroneAbortController?: AbortController;
  private lastIsochroneParams?: {
  range: number;
  interval: number;
  profile?: string;
  rangeType?: string;
  address?: string;
};
  private addressDebounceTimer?: number;
  // if true, user recently changed the isochrone center marker and auto-generation should be suppressed
  private markerRecentlySet: boolean = false;



  initMap = (): void => {
    this.map = new L.Map("map", {
      center: new L.LatLng(51.236525, 22.4998601),
      zoom: 18,
    });
  };

  renderer: NotificationLitRenderer = () => html`
    <vaadin-horizontal-layout theme="spacing" style="align-items: center;">
      <div>Odległość pomiędzy punktami jest większa niż 600km</div>
    </vaadin-horizontal-layout>
  `;

  renderNotification = (): void => {
    render(
      html`<vaadin-notification
        class="notification"
        theme="error"
        duration="3000"
        position="bottom-center"
        ?opened=${true}
        ${notificationRenderer(this.renderer, [])}
      ></vaadin-notification>`,
      document.body
    );
  };

  renderConnectionNotification = (error: unknown): void => {
    const message =
      error instanceof Error ? error.message : String(error);

    render(
      html`<vaadin-notification
        class="notification"
        theme="error"
        duration="3000"
        position="bottom-center"
        ?opened=${true}
        ${notificationRenderer(
          () => html`
            <vaadin-horizontal-layout
              theme="spacing"
              style="align-items: center;"
            >
              <div>${message}</div>
            </vaadin-horizontal-layout>
          `
        )}
      ></vaadin-notification>`,
      document.body
    );
  };

  routeService = async (
    type?: "start" | "end" | "search"
  ): Promise<void> => {
    if (
      this.markerGreen.options.opacity === 1 &&
      this.markerRed.options.opacity === 1
    ) {
      const distance = this.markerGreen
        .getLatLng()
        .distanceTo(this.markerRed.getLatLng());

      if (distance < 700000) {
        try {
          const feature = await this.orsApi.route(
            this.markerGreen.getLatLng(),
            this.markerRed.getLatLng()
          );

          if ((feature as any).error) {
            throw new Error((feature as any).error.message);
          }

          this.routeLayer.clearLayers().addData(feature as any);
        } catch (e: unknown) {
          this.renderConnectionNotification(e);
        }
      } else {
        this.routeLayer.clearLayers();
        this.renderNotification();
      }
    } else {
      this.routeLayer.clearLayers();
    }
  };

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("currentTabIdx")) {
      if (this.currentLatLng) {
        this.updateContextMenu();
      }
      this.routeLayer.clearLayers();
      this.routeStartLabel = "";
      this.routeStopLabel = "";
      this.searchLabel = "";
    }
  }

  updateContextMenu = (): void => {
    const container = document.createElement("div");

    render(
      html`<ors-custom-contextmenu
        .currentTabIdx=${this.currentTabIdx}
      ></ors-custom-contextmenu>`,
      container
    );

    this.contextMenu
      ?.setLatLng(this.currentLatLng!)
      .bindPopup(container, {
        closeButton: false,
        minWidth: 250,
      })
      .addTo(this.map!)
      .openPopup();
  };

  addListeners = (): void => {
    this.map!.on("contextmenu", (e: LeafletMouseEvent) => {
      this.currentLatLng = e.latlng;
      this.updateContextMenu();
    });

    this.markerGreen.on("moveend", (e) => {
      this.currentLatLng = e.target.getLatLng();
      this.dispatchEvent(
        new CustomEvent("add-marker", {
          detail: { type: "start" },
          bubbles: true,
          composed: true,
        })
      );
      this.routeService("start");
    });

    this.markerRed.on("moveend", (e) => {
      this.currentLatLng = e.target.getLatLng();
      this.dispatchEvent(
        new CustomEvent("add-marker", {
          detail: { type: "end" },
          bubbles: true,
          composed: true,
        })
      );
      this.routeService("end");
    });

    window.addEventListener(
      "add-marker",
      this._onAddMarker as EventListener
    );
    window.addEventListener(
      "add-marker-geocode",
      this._onAddMarkerGeocode as EventListener
    );
    window.addEventListener(
      "hide-marker",
      this._onHideMarker as EventListener
    );
    
    window.addEventListener(
  "isochrones-generate",
  this._onIsochronesChange as EventListener
);
    window.addEventListener(
      "isochrones-params-changed",
      this._onIsochroneParamsChanged as EventListener
    );
    window.addEventListener(
      "isochrone-address",
      this._onIsochroneAddress as EventListener
    );
window.addEventListener(
  "isochrone-center-set",
  this._onIsochroneCenterSet as EventListener
);



  };
_onIsochroneCenterSet = (): void => {
  this.contextMenu?.close();

  if (this.currentLatLng) {
    this.isochroneCenterMarker.setLatLng(this.currentLatLng).setOpacity(1);
  }

  // mark that user explicitly set/moved the isochrone center - require explicit regenerate
  this.markerRecentlySet = true;
  // notify panels that center was changed (so they can show the 'need to generate' message)
  window.dispatchEvent(new CustomEvent("isochrone-center-changed"));
};

_onIsochroneAddress = (e: Event): void => {
  const address = (e as CustomEvent).detail?.address as string;

  if (!address || address.trim().length === 0) return;

  // debounce rapid typing
  if (this.addressDebounceTimer) clearTimeout(this.addressDebounceTimer);

  this.addressDebounceTimer = window.setTimeout(async () => {
    try {
      const feats = await this.orsApi.geocode(address);
      if (!feats || feats.length === 0) return;

      const coords = feats[0].geometry.coordinates as [number, number];
      const latlng = new L.LatLng(coords[1], coords[0]);

      this.currentLatLng = latlng;
      this.isochroneCenterMarker.setLatLng(latlng).setOpacity(1);
      this.map?.setView(latlng, this.map?.getZoom() ?? 13);

      // user set the isochrone center by address — require explicit regenerate
      this.markerRecentlySet = true;
      window.dispatchEvent(new CustomEvent("isochrone-center-changed"));
    } catch (err: unknown) {
      this.renderConnectionNotification(err);
    }
  }, 600);
};

_onIsochroneParamsChanged = (e: Event): void => {
  const detail = (e as CustomEvent).detail;
  // if the user recently changed the isochrone center, require explicit generate
  if (this.markerRecentlySet) return;

  // otherwise forward to the normal generation flow
  this._onIsochronesChange(new CustomEvent("isochrones-generate", { detail }));
};



  _onAddMarker = async (e: Event): Promise<void> => {
    const data = (e as CustomEvent).detail;
    render(html`<progress-bar-request></progress-bar-request>`, document.body);

    switch (data.type) {
      case "start":
        this.markerGreen.setOpacity(0);
        this.routeStartLabel = await this.orsApi.reverseGeocode(
          this.currentLatLng!
        );
        this.markerGreen.setLatLng(this.currentLatLng!).setOpacity(1);
        break;

      case "end":
        this.markerRed.setOpacity(0);
        this.routeStopLabel = await this.orsApi.reverseGeocode(
          this.currentLatLng!
        );
        this.markerRed.setLatLng(this.currentLatLng!).setOpacity(1);
        break;

      case "search":
        this.searchMarker.setOpacity(0);
        this.searchLabel = await this.orsApi.reverseGeocode(
          this.currentLatLng!
        );
        this.searchMarker.setLatLng(this.currentLatLng!).setOpacity(1);
        break;
    }

    this.contextMenu?.close();
    this.routeService(data.type);
  };

  _onAddMarkerGeocode = async (e: Event): Promise<void> => {
    const data = (e as CustomEvent).detail;
    const coords = new L.LatLng(data.coords[1], data.coords[0]);

    switch (data.type) {
      case "start":
        this.markerGreen.setLatLng(coords).setOpacity(1);
        this.routeStartLabel = data.label;
        break;
      case "end":
        this.markerRed.setLatLng(coords).setOpacity(1);
        this.routeStopLabel = data.label;
        break;
      case "search":
        this.searchMarker.setLatLng(coords).setOpacity(1);
        this.searchLabel = data.label;
        break;
    }

    this.contextMenu?.close();
    this.routeService(data.type);
  };

  _onHideMarker = (e: Event): void => {
    const data = (e as CustomEvent).detail;

    switch (data.type) {
      case "start":
        this.markerGreen.setOpacity(0);
        break;
      case "end":
        this.markerRed.setOpacity(0);
        break;
      case "search":
        this.searchMarker.setOpacity(0);
        break;
    }

    this.contextMenu?.close();
    this.routeLayer.clearLayers();
  };

_onIsochronesChange = (e: Event): void => {
  
  const detail = (e as CustomEvent).detail;

    this.lastIsochroneParams = {
  range: detail.range,
  interval: detail.interval,
  profile: detail.profile,
  rangeType: detail.rangeType,
  address: detail.address
};


  

    // debounce
  if (this.isochroneDebounceTimer) {
    clearTimeout(this.isochroneDebounceTimer);
  }

  this.isochroneDebounceTimer = window.setTimeout(async () => {
    const now = Date.now();

    // hard rate-limit
    if (now - this.lastIsochroneRequestTime < this.ISOCHRONE_MIN_INTERVAL) {
      return;
    }

    this.lastIsochroneRequestTime = now;

    // abort previous request
    if (this.isochroneAbortController) {
      this.isochroneAbortController.abort();
    }

    this.isochroneAbortController = new AbortController();

    // show progress overlay
    render(html`<progress-bar-request></progress-bar-request>`, document.body);

    try {
      // determine center: priority to explicit isochrone center marker if visible,
      // then address provided in detail (geocode), then this.currentLatLng, then map center
      let centerLatLng: L.LatLng | undefined;

      // use marker position if user set it
      try {
        if (
          this.isochroneCenterMarker &&
          this.isochroneCenterMarker.options &&
          this.isochroneCenterMarker.options.opacity === 1
        ) {
          centerLatLng = this.isochroneCenterMarker.getLatLng();
        }
      } catch (err) {
        // ignore
      }

      if (!centerLatLng && detail.address) {
        // geocode address to coordinates
        try {
          const feats = await this.orsApi.geocode(detail.address);
          if (!feats || feats.length === 0) {
            // clear previous isochrones because center was changed but geocode failed
            this.isochronesLayer?.clear();
            throw new Error("Nie znaleziono adresu: " + detail.address);
          }

          const coords = feats[0].geometry.coordinates as [number, number];
          centerLatLng = new L.LatLng(coords[1], coords[0]);
          this.currentLatLng = centerLatLng;
          this.map?.setView(centerLatLng, this.map?.getZoom() ?? 13);
        } catch (geErr: unknown) {
          this.renderConnectionNotification(geErr);
          return;
        }
      }

      // fallback to currentLatLng or map center
      if (!centerLatLng) {
        if (this.currentLatLng) centerLatLng = this.currentLatLng;
        else if (this.map) centerLatLng = this.map.getCenter();
      }

      if (!centerLatLng) {
        // nothing to do, clear existing isochrones
        this.isochronesLayer?.clear();
        this.renderConnectionNotification(new Error("Brak punktu centralnego izochrony"));
        return;
      }

      const data = await this.orsApi.getIsochrones(
        {
          location: [centerLatLng.lng, centerLatLng.lat],
          range: detail.range,
          interval: detail.interval,
          profile: detail.profile,
          rangeType: detail.rangeType,
        },
        this.isochroneAbortController!.signal
      );

      this.isochronesLayer?.render(data);
      // generation succeeded — clear the "marker recently set" flag so future param changes auto-generate
      this.markerRecentlySet = false;
      // notify panels that generation finished so they can clear their dirty state
      window.dispatchEvent(new CustomEvent("isochrones-generated"));

      // after rendering, try to get reverse geocode feature for center
      try {
        const rev = await this.orsApi.reverseGeocodeFeature(centerLatLng);
        // dispatch address update so panel can fill the field
        if (rev && rev.properties && rev.properties.label) {
          window.dispatchEvent(
            new CustomEvent("isochrone-address-updated", {
              detail: { label: rev.properties.label },
              bubbles: true,
              composed: true,
            })
          );
        }

        // check for locality-like properties
        const localityKeys = ["locality", "city", "town", "village", "hamlet", "municipality"];
        let hasLocality = false;
        if (rev && rev.properties) {
          for (const k of localityKeys) {
            if (rev.properties[k]) {
              hasLocality = true;
              break;
            }
          }
        }

        // if (!hasLocality) {
        //   this.renderConnectionNotification(
        //     new Error("W miejscu znacznika nie można wskazać dokładnego adresu położenia.")
        //   );
        // }
      } catch (e) {
        // ignore reverse geocode errors
      }
    } catch (err: any) {
      // ignorujemy abort, ale przy innych błędach czyść poprzednie izochrony
      if (err.name !== "AbortError") {
        this.isochronesLayer?.clear();

        const msg = err && err.message ? String(err.message) : "";
        if (
          msg.includes("ORS Isochrone error") ||
          msg.includes("Unable to build an isochrone map")
        ) {
          this.renderConnectionNotification(
            new Error(
              "W wskazanym miejscu nie ma wytyczonego ludzkiego szlaku/drogi — miejsce położone jest w dziczy."
            )
          );
        } else {
          this.renderConnectionNotification(err);
        }
      }
    } finally {
      const overlay = document.querySelector('progress-bar-request');
      if (overlay && overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
    }
  }, 600); // debounce 600 ms
};




  disconnectedCallback() {
    super.disconnectedCallback?.();
    window.removeEventListener("add-marker", this._onAddMarker as EventListener);
    window.removeEventListener(
      "add-marker-geocode",
      this._onAddMarkerGeocode as EventListener
    );
    window.removeEventListener(
      "hide-marker",
      this._onHideMarker as EventListener
    );

    window.removeEventListener(
  "isochrones-generate",
  this._onIsochronesChange as EventListener
  
);

        window.removeEventListener(
          "isochrones-params-changed",
          this._onIsochroneParamsChanged as EventListener
        );

window.removeEventListener(
  "isochrone-center-set",
  this._onIsochroneCenterSet as EventListener
);

window.removeEventListener(
  "isochrone-address",
  this._onIsochroneAddress as EventListener
);



  }

  firstUpdated( props: Map<PropertyKey, unknown>
): void {
  super.firstUpdated(props);
    this.initMap();
    this.basemap.addTo(this.map!);

    this.contextMenu = new L.Popup();

    this.routeLayer.setStyle(this.routeStyle).addTo(this.map!);
    this.isochronesLayer = new MapIsochronesLayer(this.map!);

    this.markerGreen.addTo(this.map!).setIcon(this.startIcon);
    this.markerRed.addTo(this.map!).setIcon(this.endIcon);
    this.searchMarker.addTo(this.map!).setIcon(this.startIcon);
    this.isochroneCenterMarker.addTo(this.map!).setIcon(this.endIcon);

    this.addListeners();
  }

  static styles = css`
    .notification {
      display: flex !important;
      align-items: center;
      justify-content: center;
      height: calc(100vh - var(--docs-space-l) * 2);
    }
  `;
}
