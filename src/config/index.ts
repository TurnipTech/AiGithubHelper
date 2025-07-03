export interface Config {
  server: {
    port: number;
    host: string;
    webhookPath: string;
  };
  github: {
    webhookSecret: string;
  };
  ai: {
    workingDir: string;
    preferredProvider: 'claude' | 'gemini' | 'auto';
  };
}

export const defaultConfig: Config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || 'localhost',
    webhookPath: process.env.WEBHOOK_PATH || '/webhook'
  },
  github: {
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || ''
  },
  ai: {
    workingDir: process.env.AI_WORKING_DIR || '/tmp/ai-github-helper',
    preferredProvider: (process.env.AI_PROVIDER as any) || 'claude'
  }
};