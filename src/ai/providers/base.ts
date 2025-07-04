import { ChildProcess } from 'child_process';

export interface AIProvider {
  name: string;
  execute(prompt: string, workingDir: string): Promise<ChildProcess>;
  isAvailable(): Promise<boolean>;
  getCommand(): string[];
}

export interface AIProviderConfig {
  workingDir: string;
  preferredProvider: 'claude' | 'gemini' | 'auto';
  fallbackEnabled?: boolean;
}
