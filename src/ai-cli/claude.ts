import { spawn } from 'child_process';
import { AIResult, AIExecutionOptions } from './types';

export class ClaudeCodeCLI {
  private cliCommand: string;

  constructor(cliCommand: string = 'claude-code') {
    this.cliCommand = cliCommand;
  }

  async execute(prompt: string, options?: AIExecutionOptions): Promise<AIResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.runCommand(prompt, options);
      const executionTime = Date.now() - startTime;
      
      return {
        output: result.stdout,
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

  private async runCommand(prompt: string, options?: AIExecutionOptions): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const args = ['--message', prompt];
      
      // Add any additional arguments based on options
      if (options?.workingDir) {
        args.push('--working-dir', options.workingDir);
      }

      const child = spawn(this.cliCommand, args, {
        cwd: options?.workingDir || process.cwd(),
        env: { ...process.env, ...options?.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle timeout
      const timeout = options?.timeout || 300000; // 5 minutes default
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  async checkAvailability(): Promise<boolean> {
    try {
      await this.runCommand('--help', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}