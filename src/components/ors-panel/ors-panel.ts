import "@vaadin/icon";
import "@vaadin/icons";
import "@vaadin/text-field";
import "@vaadin/tabsheet";
import "@vaadin/tabs";

import L from "leaflet";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../ors-search";
import "../ors-route-tab";
import "../ors-isochrones-panel/ors-isochrones-panel";


@customElement("ors-panel")
export class OrsPanel extends LitElement {
  @property({ type: Object }) map?: L.Map;
  @property({ type: String }) routeStartLabel: string = "";
  @property({ type: String }) routeStopLabel: string = "";
  @property({ type: String }) searchLabel: string = "";
  @property({ type: Number }) currentTabIdx: number = 0;

  firstUpdated(props: Map<PropertyKey, unknown>) {
    super.firstUpdated(props);
  }

  render() {
    return html`
      <h4>Open Route Service - sample</h4>

      <vaadin-tabsheet>
        <vaadin-tabs
          slot="tabs"
          @selected-changed=${(e: CustomEvent) => {
            const { value } = e.detail;
            this.currentTabIdx = value;

            this.dispatchEvent(
              new CustomEvent("tab-index-changed", {
                detail: { idx: value },
                bubbles: true,
                composed: true,
              })
            );
          }}
        >
          <vaadin-tab id="find-tab">Wyszukaj</vaadin-tab>
          <vaadin-tab id="route-tab">Trasa</vaadin-tab>
          <vaadin-tab id="reach-tab">Izochrony</vaadin-tab>
        </vaadin-tabs>

        <!-- WYSZUKIWANIE -->
        <div tab="find-tab">
          <ors-search
            .type=${"search"}
            .searchTerm=${this.searchLabel}
          ></ors-search>
        </div>

        <!-- TRASA -->
        <div tab="route-tab">
          <ors-route-tab
            .routeStartLabel=${this.routeStartLabel}
            .routeStopLabel=${this.routeStopLabel}
          ></ors-route-tab>
        </div>

        <!-- IZOCHRONY -->
        <div tab="reach-tab">
          <ors-isochrones-panel></ors-isochrones-panel>
        </div>
      </vaadin-tabsheet>
    `;
  }

  static styles = css`
    :host {
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 10px;
      background-color: rgba(255, 255, 255, 0.9);
      width: 400px;
      height: 94%;
      overflow: auto;
    }

    h4 {
      text-align: center;
    }

    vaadin-text-field {
      width: 100%;
    }

    vaadin-tabsheet {
      height: 93%;
    }
  `;
}
