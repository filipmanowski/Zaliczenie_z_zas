import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "@vaadin/text-field";

@customElement("ors-isochrones-panel")
export class OrsIsochronesPanel extends LitElement {
  @state() rangeKm = 15;
  @state() intervalKm = 3;

  private emitChange() {
    this.dispatchEvent(
      new CustomEvent("isochrones-change", {
        detail: {
          range: this.rangeKm * 1000,
          interval: this.intervalKm * 1000,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private onRangeInput(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    this.rangeKm = value;

    if (this.intervalKm > this.rangeKm) {
      this.intervalKm = this.rangeKm;
    }

    this.emitChange();
  }

  private onIntervalInput(e: Event) {
    this.intervalKm = Number((e.target as HTMLInputElement).value);
    this.emitChange();
  }

  render() {
    return html`
      <div class="panel">
        <vaadin-text-field
          label="Adres (opcjonalnie)"
          placeholder="np. Lublin, Plac Litewski"
        ></vaadin-text-field>

        <label>
          Zasięg (km): <strong>${this.rangeKm}</strong>
          <input
            type="range"
            min="2"
            max="15"
            step="1"
            .value=${String(this.rangeKm)}
            @input=${this.onRangeInput}
          />
        </label>

        <label>
          Interwał (km): <strong>${this.intervalKm}</strong>
          <input
            type="range"
            min="1"
            max=${this.rangeKm}
            step="1"
            .value=${String(this.intervalKm)}
            @input=${this.onIntervalInput}
          />
        </label>
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
