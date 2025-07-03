export interface GitHubEventTrigger {
  event: string;
  action?: string;
}

export interface AIScriptContext {
  aiExecutor: AICLIExecutor;
  api: GitHubAPI;
  payload: any;
  logger: Logger;
  config: Config;
  workingDir: string;
}

export interface AIScriptResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface AIAutomationScript {
  name: string;
  description: string;
  triggers: GitHubEventTrigger[];
  preferredAI: 'claude' | 'gemini' | 'auto';
  execute(context: AIScriptContext): Promise<AIScriptResult>;
  validate?(payload: any): boolean;
}

// Import types that will be defined elsewhere
import { AICLIExecutor } from '../ai-cli/executor';
import { GitHubAPI } from '../github/api';
import { Logger } from '../utils/logger';
import { Config } from '../config';