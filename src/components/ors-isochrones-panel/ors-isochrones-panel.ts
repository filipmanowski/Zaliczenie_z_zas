import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "@vaadin/text-field";
import "@vaadin/vertical-layout";
import { OrsApi } from "../../ors-api/ors-api";

@customElement("ors-isochrones-panel")
export class OrsIsochronesPanel extends LitElement {
  @state() rawRange = 15; // km or minutes depending on rangeType
  @state() rawInterval = 3; // km or minutes depending on rangeType
  @state() profile: string = "driving-car";
  @state() rangeType: "distance" | "time" = "distance";
  @state() address: string = "";
  @state() dirty: boolean = false;

  private api = new OrsApi();

  private emitChange() {
    const detailRange = this.rangeType === "distance" ? this.rawRange * 1000 : this.rawRange * 60; // minutes->seconds
    const detailInterval = this.rangeType === "distance" ? this.rawInterval * 1000 : this.rawInterval * 60;
    return {
      range: detailRange,
      interval: detailInterval,
      profile: this.profile,
      rangeType: this.rangeType,
      address: this.address || undefined,
    };
  }

  private onRangeInput(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    const max = this.getMaxRangeForType();
    this.rawRange = Math.min(value, max);

    if (this.rawInterval > this.rawRange) {
      this.rawInterval = this.rawRange;
    }

    this.dirty = true;
  }

  private onIntervalInput(e: Event) {
    this.rawInterval = Number((e.target as HTMLInputElement).value);
    this.dirty = true;
  }

  private onProfileChange(e: Event) {
    this.profile = (e.target as HTMLSelectElement).value;
    this.dirty = true;
  }

  private onRangeTypeChange(e: Event) {
    const newType = (e.target as HTMLSelectElement).value as "distance" | "time";
    // convert current values to reasonable defaults when switching units
    if (this.rangeType !== newType) {
      if (newType === "distance") {
        // assume rawRange/rawInterval currently minutes -> convert roughly (minutes -> km guess), but keep values reasonable
        this.rawRange = Math.max(2, Math.round(this.rawRange / 5));
        this.rawInterval = Math.max(1, Math.round(this.rawInterval / 5));
      } else {
        // switching to time: scale up
        this.rawRange = Math.max(5, Math.round(this.rawRange * 5));
        this.rawInterval = Math.max(1, Math.round(this.rawInterval * 5));
      }
    }

    this.rangeType = newType;
    // clamp to allowed max for new type
    const max = this.getMaxRangeForType();
    if (this.rawRange > max) this.rawRange = max;
    if (this.rawInterval > this.rawRange) this.rawInterval = this.rawRange;
    this.dirty = true;
  }

  private getMaxRangeForType(): number {
    // distance: km max 50 (previous default), time: minutes max 60 to avoid ORS range limit
    return this.rangeType === "distance" ? 50 : 60;
  }

  private onAddressInput(e: Event) {
    this.address = (e.target as HTMLInputElement).value;
    // notify map about the entered address (debounced on map side)
    this.dispatchEvent(
      new CustomEvent("isochrone-address", {
        detail: { address: this.address },
        bubbles: true,
        composed: true,
      })
    );
    this.dirty = true;
  }

  connectedCallback() {
    super.connectedCallback?.();
    window.addEventListener(
      "isochrone-address-updated",
      this._onAddressUpdated as EventListener
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    window.removeEventListener(
      "isochrone-address-updated",
      this._onAddressUpdated as EventListener
    );
  }

  private _onAddressUpdated = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    if (detail && detail.label) {
      // set address without re-dispatching event
      this.address = detail.label;
      this.dirty = true;
      this.requestUpdate();
    }
  };

  private async onGenerateClick() {
    const detail = this.emitChange();
    this.dispatchEvent(
      new CustomEvent("isochrones-generate", {
        detail,
        bubbles: true,
        composed: true,
      })
    );
    this.dirty = false;
  }

  render() {
    return html`
      <div class="panel">
        <label>
          Profil:
          <select @change=${this.onProfileChange} .value=${this.profile}>
            ${this.api
              .getAvailableProfiles()
              .map((p) => html`<option value=${p.value}>${p.label}</option>`)}
          </select>
        </label>

        <label>
          Tryb izochrony:
          <select @change=${this.onRangeTypeChange} .value=${this.rangeType}>
            ${this.api
              .getRangeTypeOptions()
              .map((o) => html`<option value=${o.value}>${o.label}</option>`)}
          </select>
        </label>

        <vaadin-text-field
          label="Adres (opcjonalnie)"
          placeholder="np. Lublin, Plac Litewski"
          .value=${this.address}
          @input=${this.onAddressInput}
        ></vaadin-text-field>

        <label>
          Zasięg (${this.rangeType === "distance" ? "km" : "minuty"}): <strong>${this.rawRange}</strong>
          <input
            type="range"
            min=${this.rangeType === "distance" ? 2 : 1}
            max=${this.rangeType === "distance" ? 50 : 60}
            step="1"
            .value=${String(this.rawRange)}
            @input=${this.onRangeInput}
          />
        </label>

        <label>
          Interwał (${this.rangeType === "distance" ? "km" : "minuty"}): <strong>${this.rawInterval}</strong>
          <input
            type="range"
            min="1"
            max=${this.rawRange}
            step="1"
            .value=${String(this.rawInterval)}
            @input=${this.onIntervalInput}
          />
        </label>

        <div>
          ${this.dirty
            ? html`<div style="color: #b36f00; margin-bottom:8px;">Parametry zmienione — kliknij "Generuj izochronę", aby zmiany weszły w życie.</div>`
            : null}
          <button @click=${this.onGenerateClick}>Generuj izochronę</button>
        </div>
      </div>
    `;
  }

  static styles = css`
    .panel {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 12px;
    }

    input[type="range"] {
      width: 100%;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  `;
}
