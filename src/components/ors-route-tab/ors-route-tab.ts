import "@vaadin/icon";
import "@vaadin/icons";
import "@vaadin/tabs";
import "@vaadin/tabsheet";
import "@vaadin/text-field";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("ors-route-tab")
export class OrsRouteTab extends LitElement {
  @property({ type: String }) routeStartLabel: string = "";
  @property({ type: String }) routeStopLabel: string = "";

  firstUpdated(props: any) {
    super.firstUpdated(props);
  }

  render() {
    return html`
      <ors-search
        id=${"searchRouteStart"}
        .searchTerm=${this.routeStartLabel}
        .type=${"start"}
        .label=${"Punkt początkowy:"}
      ></ors-search>
      <ors-search
        id=${"searchRouteStop"}
        .searchTerm=${this.routeStopLabel}
        .type=${"end"}
        .label=${"Punkt końcowy:"}
      ></ors-search>
    `;

    //   `<vaadin-text-field
    //   id="searchRouteStart"
    //   theme="small"
    //   clear-button-visible
    //   placeholder="Konstantynów 1A-1E, Lublin,LU,Polska"
    //   label="Punkt początkowy:"
    //   value=${this.routeStartLabel}
    // >
    //   <vaadin-icon
    //     icon="vaadin:search"
    //     slot="suffix"
    //     @click=${(e) => {
    //       console.log("klik");
    //     }}
    //   ></vaadin-icon>
    // </vaadin-text-field>
    // <vaadin-text-field
    //   id="searchRouteStop"
    //   theme="small"
    //   clear-button-visible
    //   placeholder="Konstantynów 1A-1E, Lublin,LU,Polska"
    //   label="Punkt końcowy:"
    //   value=${this.routeStopLabel}
    // >
    //   <vaadin-icon
    //     icon="vaadin:search"
    //     slot="suffix"
    //     @click=${(e) => {
    //       console.log("klik");
    //     }}
    //   ></vaadin-icon>
    // </vaadin-text-field>`;
  }

  static styles? = css`
    :host {
      height: 100%;
    }
    vaadin-text-field {
      width: 100%;
    }
  `;
}
