export interface AIContext {
  [key: string]: any;
}

export interface AIResult {
  output: string;
  success: boolean;
  error?: string;
  executionTime?: number;
}

export interface AIExecutionOptions {
  timeout?: number;
  workingDir?: string;
  env?: Record<string, string>;
}

export type AIProvider = 'claude' | 'gemini' | 'auto';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  cliCommand?: string;
  enabled: boolean;
}