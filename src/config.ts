import { LovelaceCardConfig } from "custom-card-helpers";

export const platforms = ["xiaomi_miio_fan"] as const;

interface FanXiaomiCustomConfig {
  name: string;
  platform: typeof platforms[number];
  entity: string;
  disable_animation: boolean;
  force_sleep_mode_support: boolean;
  hide_led_button: boolean;
}

export interface FanXiaomiCardConfig extends LovelaceCardConfig, FanXiaomiCustomConfig {}

export const defaultConfig: FanXiaomiCustomConfig = {
  name: "",
  platform: platforms[0],
  entity: "",
  disable_animation: false,
  force_sleep_mode_support: false,
  hide_led_button: false,
};
