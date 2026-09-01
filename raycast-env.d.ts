/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Default Search Engine - Choose which visual search engine opens when circling an image */
  "searchEngine": "google" | "bing" | "yandex" | "tineye" | "baidu" | "all"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-screen` command */
  export type SearchScreen = ExtensionPreferences & {}
  /** Preferences accessible in the `search-clipboard` command */
  export type SearchClipboard = ExtensionPreferences & {}
  /** Preferences accessible in the `search-fullscreen` command */
  export type SearchFullscreen = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-screen` command */
  export type SearchScreen = {}
  /** Arguments passed to the `search-clipboard` command */
  export type SearchClipboard = {}
  /** Arguments passed to the `search-fullscreen` command */
  export type SearchFullscreen = {}
}

