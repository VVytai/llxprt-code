/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export * from './src/index.js';
export {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
} from './src/config/models.js';
export {
  QwenDeviceFlow,
  DeviceFlowConfig,
} from './src/auth/qwen-device-flow.js';
export { MultiProviderTokenStore } from './src/auth/token-store.js';
export {
  openBrowserSecurely,
  shouldLaunchBrowser,
} from './src/utils/secure-browser-launcher.js';

// Re-export settings system for explicit access
export { SettingsService } from './src/settings/SettingsService.js';
export type {
  ISettingsService,
  GlobalSettings,
  SettingsChangeEvent,
  ProviderSettings,
  UISettings,
  AdvancedSettings,
  EventListener,
  EventUnsubscribe,
} from './src/settings/types.js';
export type { TelemetrySettings as SettingsTelemetrySettings } from './src/settings/types.js';
// IDE connection telemetry exports removed - telemetry disabled in llxprt
