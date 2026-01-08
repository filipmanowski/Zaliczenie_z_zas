import "@vaadin/button";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import markerIconGreen from "../ors-map/assets/img/marker-icon-green.png";
import markerIconRed from "../ors-map/assets/img/marker-icon-red.png";

// Using native CustomEvent bubbling instead of centralized eventBus

@customElement("ors-custom-contextmenu")
export class OrsCustomContextmenu extends LitElement {
  @property({ type: Number }) currentTabIdx: number = 0;

  routeContextMenu = () => html`<vaadin-button
      @click=${(e: Event) => {
        this.dispatchEvent(new CustomEvent("add-marker", { detail: { type: "start" }, bubbles: true, composed: true }));
      }}
    >
      <div class="context-button">
        <img src=${markerIconGreen} height="22" />
        <span class="context-button-text">Ustaw punkt startowy</span>
      </div>
    </vaadin-button>
    <vaadin-button
      @click=${(e: Event) => {
        this.dispatchEvent(new CustomEvent("add-marker", { detail: { type: "end" }, bubbles: true, composed: true }));
      }}
    >
      <div class="context-button">
        <img src=${markerIconRed} height="22" />
        <span class="context-button-text">Ustaw punkt końcowy</span>
      </div>
    </vaadin-button>`;

  render() {
    switch (this.currentTabIdx) {
      case 0:
        return html`<p>Contextmenu zakładki Wyszukaj</p>`;
      case 1: return this.routeContextMenu();
      case 2: return html`<button @click=${this._setIsochroneCenter}>
      Ustaw jako centrum izochron
    </button>`
    }
  }

  
  private _setIsochroneCenter() {
  this.dispatchEvent(
    new CustomEvent("isochrone-center-set", {
      bubbles: true,
      composed: true
    })
  );
}


  static styles? = css`
    :host {
      display: flex;
      flex-direction: column;
      padding: 10px;
      width: 230px;
    }

    vaadin-button {
      width: 100%;
    }

    .context-button {
      display: flex;
      align-items: center;
    }
    .context-button-text {
      margin-left: 10px;
    }
  `;
}
