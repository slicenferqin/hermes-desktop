/**
 * Type definitions for hermes-desktop
 */

// Hermes configuration types
export interface HermesConfig {
  model: {
    provider: string;
    name: string;
    temperature?: number;
    max_tokens?: number;
  };
  agent: {
    max_iterations: number;
    compression_threshold: number;
    personality?: string;
  };
  gateway: {
    enabled: boolean;
    port: number;
    webhook_url?: string;
  };
  channels?: {
    telegram?: ChannelConfig;
    discord?: ChannelConfig;
    slack?: ChannelConfig;
    wechat?: ChannelConfig;
    feishu?: ChannelConfig;
    whatsapp?: ChannelConfig;
  };
  tools?: {
    tts?: boolean;
    web_search?: boolean;
    image_generation?: boolean;
    code_execution?: boolean;
  };
}

export interface ChannelConfig {
  enabled: boolean;
  token?: string;
  api_key?: string;
  webhook_url?: string;
  [key: string]: unknown;
}

// Message types
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Session types
export interface Session {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  message_count: number;
}

// Skill types
export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  author?: string;
  repository?: string;
}

// Cron job types
export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  task: string;
  enabled: boolean;
  last_run?: Date;
  next_run?: Date;
}

// Gateway status types
export interface GatewayStatus {
  running: boolean;
  port: number;
  uptime?: number;
  channels: {
    name: string;
    connected: boolean;
    last_ping?: Date;
  }[];
}

// Theme types
export type Theme = 'light' | 'dark';

export interface ThemeConfig {
  mode: Theme;
  accent_color?: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// System check types
export interface SystemCheckResult {
  name: string;
  installed: boolean;
  version?: string;
  path?: string;
  error?: string;
}

// Install wizard state
export interface InstallWizardState {
  step: number;
  systemChecks: SystemCheckResult[];
  hermesInstalled: boolean;
  hermesVersion: string | null;
  configSaved: boolean;
}
