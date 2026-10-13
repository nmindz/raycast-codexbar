/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `usage_report` command */
  export type UsageReport = ExtensionPreferences & {}
  /** Preferences accessible in the `metrics_query` command */
  export type MetricsQuery = ExtensionPreferences & {}
  /** Preferences accessible in the `providers_settings` command */
  export type ProvidersSettings = ExtensionPreferences & {}
  /** Preferences accessible in the `set_api_key` command */
  export type SetApiKey = ExtensionPreferences & {}
  /** Preferences accessible in the `config_validate` command */
  export type ConfigValidate = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `usage_report` command */
  export type UsageReport = {}
  /** Arguments passed to the `metrics_query` command */
  export type MetricsQuery = {}
  /** Arguments passed to the `providers_settings` command */
  export type ProvidersSettings = {}
  /** Arguments passed to the `set_api_key` command */
  export type SetApiKey = {}
  /** Arguments passed to the `config_validate` command */
  export type ConfigValidate = {}
}

