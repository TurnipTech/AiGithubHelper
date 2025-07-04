import { AIProvider } from './providers/base';
import { ClaudeProvider } from './providers/claude';
import { GeminiProvider } from './providers/gemini';

export class AIProviderFactory {
  private static claudeProvider = new ClaudeProvider();
  private static geminiProvider = new GeminiProvider();

  static async create(provider: 'claude' | 'gemini' | 'auto', fallbackEnabled: boolean = false): Promise<AIProvider> {
    switch (provider) {
      case 'claude':
        if (fallbackEnabled && !(await this.claudeProvider.isAvailable())) {
          return this.getFallbackProvider('claude');
        }
        return this.claudeProvider;
      
      case 'gemini':
        if (fallbackEnabled && !(await this.geminiProvider.isAvailable())) {
          return this.getFallbackProvider('gemini');
        }
        return this.geminiProvider;
      
      case 'auto':
        return this.selectBestAvailableProvider();
      
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  private static async getFallbackProvider(requestedProvider: 'claude' | 'gemini'): Promise<AIProvider> {
    const fallbackProvider = requestedProvider === 'claude' ? this.geminiProvider : this.claudeProvider;
    
    if (await fallbackProvider.isAvailable()) {
      return fallbackProvider;
    }
    
    throw new Error(`Neither ${requestedProvider} nor fallback provider are available. Please ensure at least one AI CLI is installed and configured.`);
  }

  private static async selectBestAvailableProvider(): Promise<AIProvider> {
    const providers = [this.claudeProvider, this.geminiProvider];
    
    for (const provider of providers) {
      if (await provider.isAvailable()) {
        return provider;
      }
    }
    
    throw new Error('No AI providers are available. Please ensure Claude CLI or Gemini CLI is installed and configured.');
  }

  static async getAvailableProviders(): Promise<string[]> {
    const providers = [this.claudeProvider, this.geminiProvider];
    const available: string[] = [];
    
    for (const provider of providers) {
      if (await provider.isAvailable()) {
        available.push(provider.name);
      }
    }
    
    return available;
  }
}