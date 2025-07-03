import { config } from 'dotenv';

config();

export const environment = {
  port: process.env.PORT || 3000,
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export function validateEnvironment(): void {
  if (!environment.webhookSecret) {
    throw new Error('WEBHOOK_SECRET environment variable is required');
  }
}