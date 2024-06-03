/* eslint-disable @typescript-eslint/no-explicit-any */
import { LitElement, html, TemplateResult, css, PropertyValues, CSSResultGroup, HTMLTemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators";
import { HomeAssistant, hasConfigOrEntityChanged, handleAction, LovelaceCardEditor } from "custom-card-helpers"; // This is a community maintained npm module with common helper functions/types. https://github.com/custom-cards/custom-card-helpers

import { FanXiaomiCardConfig, defaultConfig } from "./config";

// Add the card to the UI card picker dialog
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "fan-xiaomi",
  name: "Xiaomi Fan Lovelace Card",
  preview: true,
  description: "Xiaomi Smartmi Fan Lovelace card for HASS/Home Assistant.",
});

type SupportedAttributes = {
  verticalAngle: boolean;
  rotationVerticalAngle: boolean;
  supportedVerticalAngles: number[];
  horizontalAngle: boolean;
  childLock: boolean;
  timer: boolean;
  rotationHorizontalAngle: boolean;
  speedLevels: number;
  naturalSpeed: boolean;
  supportedHorizontalAngles: number[];
  sleepMode: boolean;
  smartMode: boolean;
  led: boolean;
  speedIncreaseDecreaseButtons: boolean;
};

type DeviceEntities = {
  horizontalAngle?: string;
  verticalAngle?: string;
  timer?: string;
  childLock?: string;
  ledNumber?: string;
  ledSelect?: string;
  ledSwitch?: string;
  temperature?: string;
  humidity?: string;
  powerSupply?: string;
};

const entityFilters: { [name in keyof Required<DeviceEntities>]: { prefix: string; suffix: string } } = {
  horizontalAngle: {
    prefix: "number.",
    suffix: "_oscillation_angle",
  },
  verticalAngle: {
    prefix: "number.",
    suffix: "_oscillation_angle",
  },
  childLock: {
    prefix: "switch.",
    suffix: "_physical_control_locked",
  },
  timer: {
    prefix: "number.",
    suffix: "_off_delay_time",
  },
  ledNumber: {
    prefix: "number.",
    suffix: "_led_brightness",
  },
  ledSelect: {
    prefix: "select.",
    suffix: "_led_brightness",
  },
  ledSwitch: {
    prefix: "switch.",
    suffix: "_led",
  },
  temperature: {
    prefix: "sensor.",
    suffix: "_temperature",
  },
  humidity: {
    prefix: "sensor.",
    suffix: "_humidity",
  },
  powerSupply: {
    prefix: "binary_sensor.",
    suffix: "_power_supply",
  },
};

function createFanBladeHtml(): HTMLTemplateResult[] {
  const result: HTMLTemplateResult[] = [];
  for (let i = 1; i < 73; i++) {
    result.push(html`<div class="fan ang${i}"></div>`);
  }
  for (let i = 1; i < 73; i += 2) {
    result.push(html`<div class="fan1 ang${i}"></div>`);
  }
  return result;
}

function delayOffCountdownText(delay_off_countdown: number, model: string): string {
  let timer_display = "Off";
  if (delay_off_countdown) {
    const total_mins = delay_off_countdown;

    const hours = Math.floor(total_mins / 60);
    const mins = Math.floor(total_mins % 60);
    if (hours) {
      if (mins) {
        timer_display = `${hours}h ${mins}m`;
      } else {
        timer_display = `${hours}h`;
      }
    } else {
      timer_display = `${mins}m`;
    }
  }
  return timer_display;
}

@customElement("fan-xiaomi")
export class FanXiaomiCard extends LitElement {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("./xiaomi-fan-card-editor");
    return document.createElement("fan-xiaomi-card-editor");
  }

  public static getStubConfig(): Record<string, unknown> {
    return {
      ...defaultConfig,
      name: "Xiaomi Fan",
    };
  }

  // https://lit.dev/docs/components/properties/
  @property({ attribute: false }) public hass!: HomeAssistant;

  private isConfigureAsyncFinished = false;

  @state() private deviceEntities: DeviceEntities = {};

  @state() private supportedAttributes: SupportedAttributes = {
    horizontalAngle: true,
    childLock: true,
    timer: true,
    rotationHorizontalAngle: true,
    speedLevels: 4,
    naturalSpeed: true,
    supportedHorizontalAngles: [30, 60, 90, 120],
    sleepMode: false,
    led: false,
    speedIncreaseDecreaseButtons: false,
  };

  @state() private config!: FanXiaomiCardConfig;

  // https://lit.dev/docs/components/properties/#accessors-custom
  public setConfig(config: FanXiaomiCardConfig): void {
    if (!config.entity) {
      throw new Error("You must specify an entity");
    }

    this.config = {
      ...defaultConfig,
      ...config,
    };

    this.isConfigureAsyncFinished = false;
    if (this.hass) {
      this.configureAsync();
    }
  }

  private getModel() {
    return this.hass.states[this.config.entity].attributes["model"];
  }

  private setChildLock(on) {
    this.hass.callService("xiaomi_miot", "set_property", {
      entity_id: this.config.entity,
      field: "physical_controls_locked",
      value: on
    });
  }

  private getChildLock() {
    return this.hass.states[this.config.entity].attributes["physical_controls_locked"];
  }

  private setTimer(value: number) {
    this.hass.callService("xiaomi_miot", "set_property", {
      entity_id: this.config.entity,
      field: "off_delay_time",
      value: value
    });
  }

  private getTimer(): number {
    return Number(this.hass.states[this.config.entity].attributes["off_delay_time"]);
  }

  private setHorizontalAngle(value) {
    this.hass.callService("xiaomi_miot", "set_property", {
      entity_id: this.config.entity,
      field: "horizontal_swing_included_angle-2-5",
      value: value
    });
  }

  private setVerticalAngle(value) {
    this.hass.callService("xiaomi_miot", "set_property", {
      entity_id: this.config.entity,
      field: "vertical_swing_included_angle-2-8",
      value: value
    });
  }

  private getHorizontalAngle() {
    return this.hass.states[this.config.entity].attributes["horizontal_swing_included_angle-2-5"];
  }

  private getVerticalAngle() {
    return this.hass.states[this.config.entity].attributes["vertical_swing_included_angle-2-8"];
  }

  private setHorizontalOscillation(on) {
    this.hass.callService("xiaomi_miot", "set_property", {
      entity_id: this.config.entity,
      field: "fan.horizontal_swing",
      value: on
    });
  }
  
  private setVerticalOscillation(on) {
    this.hass.callService("xiaomi_miot", "set_property", {
      entity_id: this.config.entity,
      field: "fan.vertical_swing",
      value: on
    });
  }

  private getHorizontalOscillation() {
    return this.hass.states[this.config.entity].attributes["fan.horizontal_swing"];
  }

  private getVerticalOscillation() {
    return this.hass.states[this.config.entity].attributes["fan.vertical_swing"];
  }

  private getSpeedPercentage(): number {
    return Number(this.hass.states[this.config.entity].attributes["percentage"]);
  }

  private getSpeedLevel(): number {
    const speedCount = this.supportedAttributes.speedLevels;
    return Math.ceil((this.getSpeedPercentage() / 100) * speedCount);
  }

  private setPresetMode(value) {
    if (value === "Natural Wind") {
      this.hass.callService("xiaomi_miot", "set_property", {
        entity_id: this.config.entity,
        field: "fan.mode",
        value: "1"
      });
    } else if (value === "Smart") {
      this.hass.callService("xiaomi_miot", "set_property", {
        entity_id: this.config.entity,
        field: "fan.mode",
        value: "2"
      });
    } else if (value === "Sleep") {
      this.hass.callService("xiaomi_miot", "set_property", {
        entity_id: this.config.entity,
        field: "fan.mode",
        value: "3"
      });
    } else if (value === "Straight Wind"){
      this.hass.callService("xiaomi_miot", "set_property", {
        entity_id: this.config.entity,
        field: "fan.mode",
        value: "0"
      });
    }
  }

  /**
   * @returns The fan's preset (nature/normal) mode as a lowercase string.
   */
  private getPresetMode(): "Straight Wind" | "Natural Wind" | "Smart" | "Sleep" | undefined {
    return this.hass.states[this.config.entity].attributes["preset_mode"];
  }

  private setLed(on: boolean) {
    this.hass.callService("xiaomi_miot", "set_property", {
      entity_id: this.config.entity,
      field: "indicator_light.on",
      value: on
    });
  }

  private getLed() {
    return this.hass.states[this.config.entity].attributes["indicator_light.on"];
  }

  private getTemperature() {
    return this.hass.states[this.config.entity].attributes["environment.temperature"];
  }

  private getHumidity() {
    return this.hass.states[this.config.entity].attributes["environment.relative_humidity"]
  }

  private getPowerSupply() {
    return this.hass.states[this.config.entity].attributes["fan.on"];
  }

  private async findDeviceEntities(): Promise<DeviceEntities> {
    const allEntities = await this.hass.callWS<{ entity_id: string; device_id: string }[]>({
      type: "config/entity_registry/list",
    });
    const fanApiEntity = allEntities.find((e) => e.entity_id === this.config.entity);
    if (!fanApiEntity) {
      return {};
    }
    const deviceEntities = allEntities.filter((e) => e.device_id === fanApiEntity.device_id);

    const deviceEntityIds: DeviceEntities = {};
    for (const entityName of Object.keys(entityFilters)) {
      const { prefix, suffix } = entityFilters[entityName];
      deviceEntityIds[entityName] = deviceEntities.find(
        (e) => e.entity_id.startsWith(prefix) && e.entity_id.endsWith(suffix)
      )?.entity_id;
    }

    return deviceEntityIds;
  }

  private checkFanFeatures(attributes) {
    if (
      attributes.preset_mode &&
      attributes.preset_modes &&
      attributes.preset_modes.some((m) => m.toLowerCase() === "nature")
    ) {
      this.supportedAttributes.naturalSpeed = true;
    }
  }

  private checkFanAuxFeatures() {
    if (this.deviceEntities.horizontalAngle) {
      this.supportedAttributes.horizontalAngle = true;
      const attr = this.hass.states[this.deviceEntities.horizontalAngle].attributes;
      if (attr.min && attr.max && attr.step) {
        const angles: number[] = [];
        for (let a = attr.min as number; a <= attr.max; a += attr.step) {
          angles.push(a);
        }
        this.supportedAttributes.supportedHorizontalAngles = angles;
      }
    }

    if (this.deviceEntities.timer) {
      this.supportedAttributes.timer = true;
    }

    if (this.deviceEntities.childLock) {
      this.supportedAttributes.childLock = true;
    }

    if (this.deviceEntities.ledNumber || this.deviceEntities.ledSelect || this.deviceEntities.ledSwitch) {
      this.supportedAttributes.led = true;
    }
  }

  private async configureAsync() {
    this.supportedAttributes.childLock = true;
    this.supportedAttributes.timer = true;
    this.supportedAttributes.horizontalAngle = true;
    this.supportedAttributes.rotationHorizontalAngle = true;
    this.supportedAttributes.supportedHorizontalAngles = [30, 60, 90, 120, 150];
    this.supportedAttributes.verticalAngle = true;
    this.supportedAttributes.rotationVerticalAngle = true;
    this.supportedAttributes.supportedVerticalAngles = [30, 60, 90];
    this.supportedAttributes.speedLevels = 4;
    this.supportedAttributes.naturalSpeed = true;
    this.supportedAttributes.sleepMode = true;
    this.supportedAttributes.smartMode = true;
    this.supportedAttributes.led = true;
    this.supportedAttributes.speedIncreaseDecreaseButtons = true;
    this.isConfigureAsyncFinished = true;
  }

  // https://lit.dev/docs/components/lifecycle/#reactive-update-cycle-performing
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this.config) {
      return false;
    } else if (!this.isConfigureAsyncFinished && this.hass) {
      this.configureAsync();
      return this.isConfigureAsyncFinished;
    }

    const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
    if (oldHass && Object.values(this.deviceEntities).some((e) => oldHass.states[e] !== this.hass.states[e])) {
      // The state or attributes of one of the related device entities has changed
      return true;
    }

    return hasConfigOrEntityChanged(this, changedProps, false);
  }

  // https://lit.dev/docs/components/rendering/
  protected render(): TemplateResult | void {
    const state = this.hass.states[this.config.entity];

    return html`
      <ha-card
        .header=${this.config.name || state?.attributes["friendly_name"] || ""}
        @click=${this.onCardTitleClick}
        tabindex="0"
        .label=${`Xiaomi Fan: ${this.config.entity || "No Entity Defined"}`}
      >
        ${state === undefined || state.state === "unavailable"
          ? html`<hui-warning
              >Fan entity ${this.config.entity}
              ${state.state === "unavailable" ? "is unavailable" : "was not found"}.</hui-warning
            >`
          : this.renderContent()}
      </ha-card>
    `;
  }

  private renderContent(): TemplateResult {
    const state = this.hass.states[this.config.entity];

    const speed_percentage = this.getSpeedPercentage();
    const child_lock = this.getChildLock();
    const horizontalOscillating = this.getHorizontalOscillation();
    const verticalOscillating = this.getVerticalOscillation();
    const delay_off_countdown = this.getTimer();
    const horizontalAngle = this.getHorizontalAngle();
    const verticalAngle = this.getVerticalAngle();
    const preset_mode = this.getPresetMode();
    const model = this.getModel();
    const led = this.getLed();
    const temperature = this.getTemperature();
    const humidity = this.getHumidity();
    const power_supply = this.getPowerSupply();

    const speedLevel = this.getSpeedLevel();

    return html` <div class="fan-xiaomi-panel" @click=${(ev) => ev.stopPropagation()}>
      ${this.config.disable_animation
        ? ""
        : html`<div class="fanbox-container">
            <div class="var-sensors">
              ${temperature !== undefined ? html`${temperature}°C<br />` : ""}
              ${humidity !== undefined ? html`${humidity}%<br />` : ""}
            </div>
            ${power_supply !== undefined
              ? html`<div class="var-power-supply">
                  <ha-icon icon="mdi:power-plug-${power_supply ? "" : "off-"}outline"></ha-icon>
                </div>`
              : ""}
            <div class="fanbox ${state.state === "on" ? "active" : ""} ${horizontalOscillating ? "oscillation" : ""}">
              <div class="blades level${state.state === "on" ? Math.max(1, speedLevel) : 0}">
                <div class="b1 ang1"></div>
                <div class="b2 ang25"></div>
                <div class="b3 ang49"></div>
              </div>
              ${createFanBladeHtml()}
              <div class="c2"></div>
              <div class="c3 ${led ? "active" : ""}">
                <span class="icon-waper">
                  <ha-icon icon="mdi:power"></ha-icon>
                </span>
              </div>
              <div class="c1" @click=${this.toggleOnOff}></div>
              ${this.supportedAttributes.rotationHorizontalAngle
                ? html`<div class="chevron left" @click=${this.rotateLeft}>
                      <span class="icon-waper">
                        <ha-icon icon="mdi:chevron-left"></ha-icon>
                      </span>
                    </div>
                    <div class="chevron right" @click=${this.rotateRight}>
                      <span class="icon-waper">
                        <ha-icon icon="mdi:chevron-right"></ha-icon>
                      </span>
                    </div>`
                : ""}
              ${this.supportedAttributes.rotationVerticalAngle
                ? html`
                    <div class="chevron up" @click=${this.rotateUp}>
                      <span class="icon-waper">
                        <ha-icon icon="mdi:chevron-up"></ha-icon>
                      </span>
                    </div>
                    <div class="chevron down" @click=${this.rotateDown}>
                      <span class="icon-waper">
                        <ha-icon icon="mdi:chevron-down"></ha-icon>
                      </span>
                    </div>`
                : ""}
            </div>
          </div>`}
      <div class="attr-row upper-container">
        ${child_lock !== undefined
          ? html`<div class="attr button-childlock" @click=${this.toggleChildLock}>
              <p class="attr-title">Child Lock</p>
              <p class="attr-value var-childlock">${child_lock ? "On" : "Off"}</p>
            </div>`
          : ""}
        ${this.supportedAttributes.horizontalAngle
          ? html`<div class="attr button-angle" @click=${this.toggleHorizontalOscillationAngle}>
              <p class="attr-title">Horizontal Angle(&deg;)</p>
              <p class="attr-value var-angle">${horizontalAngle}</p>
            </div>`
          : ""}
        ${this.supportedAttributes.verticalAngle
          ? html`<div class="attr button-angle" @click=${this.toggleVerticalOscillationAngle}>
              <p class="attr-title">Vertical Angle(&deg;)</p>
              <p class="attr-value var-angle">${verticalAngle}</p>
            </div>`
          : ""}
        ${delay_off_countdown !== undefined
          ? html`<div class="attr button-timer" @click=${this.toggleTimer}>
              <p class="attr-title">Timer</p>
              <p class="attr-value var-timer">${delayOffCountdownText(delay_off_countdown, model)}</p>
            </div>`
          : ""}
      </div>

      <div class="op-row">
        ${this.supportedAttributes.speedIncreaseDecreaseButtons
          ? html`<div class="op var-speedup" @click=${this.increaseSpeed}>
                <button>
                  <span class="icon-waper">
                    <ha-icon icon="mdi:fan-chevron-up"></ha-icon>
                  </span>
                  Speed up
                </button>
              </div>
              <div class="op var-speeddown" @click=${this.decreaseSpeed}>
                <button>
                  <span class="icon-waper">
                    <ha-icon icon="mdi:fan-chevron-down"></ha-icon>
                  </span>
                  Speed down
                </button>
              </div>`
          : html`<div
                class="op var-speed ${speedLevel > 0 && state.state === "on" ? "active" : ""}"
                @click=${this.toggleSpeedLevel}
              >
                <button>
                  <span class="icon-waper">
                    <ha-icon icon="mdi:numeric-${state.state === "on" ? speedLevel : 0}-box-outline"></ha-icon>
                  </span>
                  Speed
                </button>
              </div>
              <div class="op var-oscillating ${horizontalOscillating ? "active" : ""}" @click=${this.toggleOscillation}>
                <button>
                  <span class="icon-waper">
                    <ha-icon icon="mdi:debug-step-over"></ha-icon>
                  </span>
                  Oscillate
                </button>
              </div>`}
        ${this.supportedAttributes.naturalSpeed
          ? html`<div
              class="op var-natural ${preset_mode === "nature" ? "active" : ""}"
              @click=${this.toggleNatureMode}
            >
              <button>
                <span class="icon-waper">
                  <ha-icon icon="mdi:leaf"></ha-icon>
                </span>
                Natural
              </button>
            </div>`
          : ""}
        ${this.supportedAttributes.sleepMode
          ? html`<div class="op var-sleep ${speed_percentage === 1 ? "active" : ""}" @click=${this.toggleSleepMode}>
              <button>
                <span class="icon-waper">
                  <ha-icon icon="mdi:power-sleep"></ha-icon>
                </span>
                Sleep
              </button>
            </div>`
          : ""}
        ${this.supportedAttributes.smartMode
          ? html`<div class="op var-sleep ${speed_percentage === 1 ? "active" : ""}" @click=${this.toggleSmartMode}>
              <button>
                <span class="icon-waper">
                  <ha-icon icon="mdi:brain"></ha-icon>
                </span>
                Sleep
              </button>
            </div>`
          : ""}
        ${this.supportedAttributes.led && !this.config.hide_led_button
          ? html`<div class="op var-led ${led ? "active" : ""}" @click=${this.toggleLed}>
              <button>
                <span class="icon-waper">
                  <ha-icon icon="mdi:lightbulb-outline"></ha-icon>
                </span>
                LED
              </button>
            </div>`
          : ""}
      </div>
    </div>`;
  }

  private onCardTitleClick(): void {
    if (this.hass && this.config) {
      handleAction(this, this.hass, this.config, "click");
    }
  }

  private toggleOnOff(): void {
    this.hass.callService("xiaomi_miot", "set_property", {
      entity_id: this.config.entity,
      field: "dm_service.speed_level",
      value: !this.hass.states[this.config.entity].attributes["fan.on"]
    });
  }

  private setMiotProperty(siid: number, piid: number, value: any): void{
    this.hass.callService("xiaomi_miot", "set_miot_property", {
      entity_id: this.config.entity,
      siid: siid,
      piid: piid,
      value: value
    });
  }
  
  private rotateLeft(): void {
    this.setMiotProperty(8,3,1)
  }

  private rotateRight(): void {
    this.setMiotProperty(8,3,2)
  }
  
  private rotateUp(): void {
    this.setMiotProperty(8,2,1)
  }

  private rotateDown(): void {
    this.setMiotProperty(8,2,2)
  }

  /**
   * Rotate through speed levels
   * e.g. if at level 1, jumps to level 2
   * If at the maximum speed, this turns the fan of (i.e. "level 0") as this is the only way to turn off
   *   the fan when animations/fanbox is disabled.
   *
   * When animations/fanbox is enabled, max level jumps to level 1.
   * Jump from level 0 - turns on the fan
   */
  private toggleSpeedLevel(): void {
    const currentLevel = this.getSpeedLevel();

    const newLevel =
      currentLevel >= this.supportedAttributes.speedLevels
        ? this.config.disable_animation
          ? this.hass.states[this.config.entity].state === "off"
            ? 1
            : 0
          : 1
        : currentLevel + 1;
    const newPercentage = (newLevel / this.supportedAttributes.speedLevels) * 100;

    this.changeSpeed(newPercentage);
  }


  private changeSpeed(value){
    this.hass.callService("xiaomi_miot", "set_property", {
      entity_id: this.config.entity,
      field: "dm_service.speed_level",
      value: value
    });
  }

  private increaseSpeed() {
    let newValue = this.getSpeedPercentage() + 5;
    if (newValue > 100) {
      newValue = 100;
    }
    this.changeSpeed(newValue);
  }

  private decreaseSpeed() {
    let newValue = this.getSpeedPercentage() - 5;
    if (newValue <= 0) {
      newValue = 1;
    }
    this.changeSpeed(newValue);
  }

  private toggleHorizontalOscillationAngle() {
    const oldAngle = this.getHorizontalAngle();
    let newAngle;
    const curAngleIndex = this.supportedAttributes.supportedHorizontalAngles.indexOf(oldAngle);
    if (curAngleIndex >= 0 && curAngleIndex < this.supportedAttributes.supportedHorizontalAngles.length - 1) {
      newAngle = this.supportedAttributes.supportedHorizontalAngles[curAngleIndex + 1];
    } else {
      newAngle = this.supportedAttributes.supportedHorizontalAngles[0];
    }

    this.setHorizontalAngle(newAngle);
  }

  private toggleVerticalOscillationAngle() {
    const oldAngle = this.getVerticalAngle();
    let newAngle;
    const curAngleIndex = this.supportedAttributes.supportedVerticalAngles.indexOf(oldAngle);
    if (curAngleIndex >= 0 && curAngleIndex < this.supportedAttributes.supportedVerticalAngles.length - 1) {
      newAngle = this.supportedAttributes.supportedVerticalAngles[curAngleIndex + 1];
    } else {
      newAngle = this.supportedAttributes.supportedVerticalAngles[0];
    }

    this.setVerticalAngle(newAngle);
  }

  private toggleTimer() {
    const minutesRemaining = this.getTimer();
    const fullHoursRemaining = Math.floor(minutesRemaining / 60);
    const newTimerHours = fullHoursRemaining >= 8 ? 0 : fullHoursRemaining + 1;
    this.setTimer(newTimerHours * 60);
  }

  private toggleChildLock() {
    const currentValue = this.getChildLock();
    this.setChildLock(!currentValue);
  }

  private toggleNatureMode() {
    const currentlyEnabled = this.getPresetMode() === "Straight Wind";
    this.setPresetMode(currentlyEnabled ? "Straight Wind" : "Natural Wind");
  }

  private toggleSleepMode() {
    const currentlyEnabled = this.getPresetMode() === "Sleep";
    this.setPresetMode(currentlyEnabled ? "Straight Wind" : "Sleep");
  }

  private toggleSmartMode() {
    const currentlyEnabled = this.getPresetMode() === "Smart";
    this.setPresetMode(currentlyEnabled ? "Straight Wind" : "Smart");
  }

  private toggleLed() {
    const currentlOn = this.getLed();
    this.setLed(!currentlOn);
  }

  private toggleOscillation() {
    const currentlyOscillating = this.getHorizontalOscillation();
    this.setHorizontalOscillation(!currentlyOscillating);
  }

  // https://lit.dev/docs/components/styles/
  static get styles(): CSSResultGroup {
    const result: CSSResultGroup = [];

    for (let i = 1; i < 73; i++) {
      result.push(css`
        .ang${i} {
          transform: rotate(${(i - 1) * 5}deg);
        }
      `);
    }

    result.push(css`
      .offline {
        opacity: 0.3;
      }
      .loading {
        opacity: 0.6;
      }
      .icon {
        overflow: hidden;
        width: 2em;
        height: 2em;
        vertical-align: -0.15em;
        fill: gray;
      }
      .fan-xiaomi-panel {
        text-align: center;
      }
      p {
        margin: 0;
        padding: 0;
      }
      .title {
        margin-top: 20px;
        height: 35px;
        cursor: pointer;
      }
      .title p {
        margin: 0;
        padding: 0;
        font-weight: 700;
        font-size: 18px;
      }
      .title span {
        font-size: 9pt;
      }
      .attr-row {
        display: flex;
      }
      .attr-row .attr {
        width: 100%;
        padding-bottom: 2px;
        border-left: 1px solid #01be9e;
      }
      .attr-row .attr:first-child {
        border-left: none;
      }
      .attr-row .attr-title {
        font-size: 9pt;
      }
      .attr-row .attr-value {
        font-size: 14px;
      }
      .op-row {
        display: flex;
        padding: 10px;
        border-top: 3px solid #717376 !important;
      }
      .op-row .op {
        width: 100%;
      }
      .op-row .op button {
        outline: 0;
        border: none;
        background: 0 0;
        cursor: pointer;
      }
      .op-row .op .icon-waper {
        display: block;
        margin: 0 auto 5px;
        width: 30px;
        height: 30px;
      }
      .op-row .op.active button {
        color: #01be9e !important;
        text-shadow: 0 0 10px #01be9e;
      }
      .fanbox-container {
        position: relative;
      }
      .var-sensors {
        position: absolute;
        left: 10px;
        text-align: left;
        color: var(--secondary-text-color);
      }
      .var-power-supply {
        position: absolute;
        right: 10px;
        color: var(--secondary-text-color);
      }
      .fanbox {
        position: relative;
        margin: 10px auto;
        width: 150px;
        height: 150px;
        border-radius: 50%;
        background: #80808061;
      }
      .fanbox.active.oscillation {
        animation: oscillate 8s infinite linear;
      }
      .blades div {
        position: absolute;
        margin: 15% 0 0 15%;
        width: 35%;
        height: 35%;
        border-radius: 100% 50% 0;
        background: #989898;
        transform-origin: 100% 100%;
      }
      .blades {
        width: 100%;
        height: 100%;
      }
      .fanbox.active .blades.level1 {
        transform-origin: 50% 50%;
        animation: blades 9s infinite linear;
        transform-box: fill-box !important;
      }
      .fanbox.active .blades.level2 {
        transform-origin: 50% 50%;
        animation: blades 7s infinite linear;
        transform-box: fill-box !important;
      }
      .fanbox.active .blades.level3 {
        transform-origin: 50% 50%;
        animation: blades 5s infinite linear;
        transform-box: fill-box !important;
      }
      .fanbox.active .blades.level4 {
        transform-origin: 50% 50%;
        animation: blades 3s infinite linear;
        transform-box: fill-box !important;
      }
      .fan {
        top: 0;
        transform-origin: 0 250%;
      }
      .fan,
      .fan1 {
        position: absolute;
        left: 0;
        margin-left: 50%;
        width: 1%;
        height: 20%;
        background: #fff;
      }
      .fan1 {
        top: 20%;
        transform-origin: 0 150%;
      }
      .c1 {
        top: 20%;
        left: 20%;
        width: 60%;
        height: 60%;
        border: 2px solid #fff;
        border-radius: 50%;
        cursor: pointer;
        background: #ffffff00;
      }
      .c1,
      .c2 {
        position: absolute;
        box-sizing: border-box;
      }
      .c2 {
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: 10px solid #f7f7f7;
        border-radius: 50%;
      }
      .c3 {
        position: absolute;
        top: 40%;
        left: 40%;
        box-sizing: border-box;
        width: 20%;
        height: 20%;
        border-radius: 50%;
        background: #fff;
        color: #ddd;
        border: 2px solid white;
        line-height: 24px;
      }
      .c3.active {
        border: 2px solid #8dd5c3;
      }
      .c3 span ha-icon {
        width: 100%;
        height: 100%;
      }
      .chevron {
        position: absolute;
        top: 0;
        height: 100%;
        opacity: 0;
      }
      .chevron:hover {
        opacity: 1;
      }
      .chevron.left {
        left: -30px;
        cursor: pointer;
      }
      .chevron.right {
        right: -30px;
        cursor: pointer;
      }
      .chevron span ha-icon {
        width: 30px;
        height: 100%;
      }
      .chevron span ha-icon {
        width: 30px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .button-angle,
      .button-childlock,
      .button-timer {
        cursor: pointer;
      }

      @keyframes blades {
        0% {
          transform: translate(0, 0) rotate(0);
        }
        to {
          transform: translate(0, 0) rotate(3600deg);
        }
      }
      @keyframes oscillate {
        0% {
          transform: perspective(10em) rotateY(0);
        }
        25% {
          transform: perspective(10em) rotateY(40deg);
        }
        50% {
          transform: perspective(10em) rotateY(0);
        }
        75% {
          transform: perspective(10em) rotateY(-40deg);
        }
        to {
          transform: perspective(10em) rotateY(0);
        }
      }
    `);
    return result;
  }
}
