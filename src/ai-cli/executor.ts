import { exec } from 'child_process';
import { promisify } from 'util';
import { AIContext, AIResult } from './types';

const execAsync = promisify(exec);

export class AICLIExecutor {
  private workingDir: string;

  constructor(workingDir: string = '/tmp/ai-github-helper') {
    this.workingDir = workingDir;
  }

  async executeClaude(prompt: string, context?: AIContext): Promise<AIResult> {
    const startTime = Date.now();
    
    try {
      // Replace template variables in prompt
      const processedPrompt = this.processPrompt(prompt, context);
      
      // Execute claude-code with the prompt
      const command = `claude-code "${processedPrompt.replace(/"/g, '\\"')}"`;
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workingDir,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 600000 // 10 minutes
      });

      const executionTime = Date.now() - startTime;

      return {
        output: stdout,
        success: true,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        output: '',
        success: false,
        error: error.message || 'Unknown error occurred',
        executionTime
      };
    }
  }

  private processPrompt(prompt: string, context?: AIContext): string {
    if (!context) {
      return prompt;
    }

    let processedPrompt = prompt;

    // Replace template variables like {{prNumber}} with actual values
    Object.entries(context).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      processedPrompt = processedPrompt.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return processedPrompt;
  }

  setWorkingDir(workingDir: string): void {
    this.workingDir = workingDir;
  }

  getWorkingDir(): string {
    return this.workingDir;
  }
}