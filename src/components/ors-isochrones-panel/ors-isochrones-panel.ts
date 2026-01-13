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

    // params changes do not mark "dirty" unless the center was changed
    // notify map about parameter change (may trigger auto-generation)
    this.dispatchEvent(
      new CustomEvent("isochrones-params-changed", {
        detail: this.emitChange(),
        bubbles: true,
        composed: true,
      })
    );
  }

  private onIntervalInput(e: Event) {
    this.rawInterval = Number((e.target as HTMLInputElement).value);
    this.dispatchEvent(
      new CustomEvent("isochrones-params-changed", {
        detail: this.emitChange(),
        bubbles: true,
        composed: true,
      })
    );
  }

  private onProfileChange(e: Event) {
    this.profile = (e.target as HTMLSelectElement).value;
    this.dispatchEvent(
      new CustomEvent("isochrones-params-changed", {
        detail: this.emitChange(),
        bubbles: true,
        composed: true,
      })
    );
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
    this.dispatchEvent(
      new CustomEvent("isochrones-params-changed", {
        detail: this.emitChange(),
        bubbles: true,
        composed: true,
      })
    );
  }

  private getMaxRangeForType(): number {
    // distance: km max 15 (limit requirement), time: minutes max 60
    return this.rangeType === "distance" ? 15 : 60;
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
    // do not set dirty here; map will dispatch center-changed when address resolves
  }

  connectedCallback() {
    super.connectedCallback?.();
    window.addEventListener(
      "isochrone-address-updated",
      this._onAddressUpdated as EventListener
    );
    window.addEventListener(
      "isochrones-generated",
      this._onIsochronesGenerated as EventListener
    );
    window.addEventListener(
      "isochrones-generate",
      this._onIsochronesGenerateRequest as EventListener
    );
    window.addEventListener(
      "isochrone-center-changed",
      this._onCenterChanged as EventListener
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    window.removeEventListener(
      "isochrone-address-updated",
      this._onAddressUpdated as EventListener
    );
    window.removeEventListener(
      "isochrones-generated",
      this._onIsochronesGenerated as EventListener
    );
    window.removeEventListener(
      "isochrones-generate",
      this._onIsochronesGenerateRequest as EventListener
    );
    window.removeEventListener(
      "isochrone-center-changed",
      this._onCenterChanged as EventListener
    );
  }

  private _onAddressUpdated = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    if (detail && detail.label) {
      // set address without re-dispatching event
      this.address = detail.label;
      this.requestUpdate();
    }
  };

  private _onIsochronesGenerateRequest = (): void => {
    // generation requested — hide the notice immediately
    this.dirty = false;
    this.requestUpdate();
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
    this.requestUpdate();
  }

  private _onIsochronesGenerated = (): void => {
    // map reported a successful generation; clear dirty state
    this.dirty = false;
    this.requestUpdate();
  };

  private _onCenterChanged = (): void => {
    // user changed the center location — prompt to regenerate
    this.dirty = true;
    this.requestUpdate();
  };

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
            max=${this.getMaxRangeForType()}
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
            ? html`<div style="color: #b36f00; margin-bottom:8px;">Położenie znacznika zmienione - kliknij "Generuj izochronę", aby zmiany weszły w życie.</div>`
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

    /* Small visual improvements */
    select {
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid #d0d7de;
      background: white;
    }

    button {
      background: linear-gradient(180deg,#2b7be9,#1667d8);
      color: white;
      padding: 8px 12px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(16,24,40,0.08);
      transition: transform .06s ease, box-shadow .06s ease;
    }

    button:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(16,24,40,0.12); }

    vaadin-text-field {
      --lumo-size-m: 12px;
      border-radius: 6px;
      overflow: hidden;
    }
  `;
}
