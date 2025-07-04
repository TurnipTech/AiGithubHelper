import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { AIProvider } from './base';

const execAsync = promisify(exec);

export class GeminiProvider implements AIProvider {
  public readonly name = 'gemini';
  private primaryModel = 'gemini-2.5-pro';
  private fallbackModel = 'gemini-1.5-flash';

  async execute(prompt: string, workingDir: string): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      
      // Start with primary model
      const child = spawn('gemini', ['--model', this.primaryModel, '--yolo', '--prompt', ''], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });
      
      let stderrBuffer = '';
      let quotaExceededDetected = false;
      
      child.stderr.on('data', (data) => {
        stderrBuffer += data.toString();
        
        // Check for quota exceeded errors early
        if (!quotaExceededDetected && (
          stderrBuffer.includes('Quota exceeded') ||
          stderrBuffer.includes('status 429') ||
          stderrBuffer.includes('rateLimitExceeded')
        )) {
          quotaExceededDetected = true;
          console.log(`Gemini Pro quota exceeded, falling back to ${this.fallbackModel}...`);
          
          // Kill the failing process
          try {
            child.kill('SIGTERM');
          } catch (e) {
            // Ignore kill errors
          }
          
          // Start fallback process
          const fallbackChild = spawn('gemini', ['--model', this.fallbackModel, '--yolo', '--prompt', ''], {
            cwd: workingDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false
          });
          
          fallbackChild.stdin.write(prompt);
          fallbackChild.stdin.end();
          
          if (!resolved) {
            resolved = true;
            resolve(fallbackChild);
          }
        }
      });
      
      // Handle normal completion (no quota issues)
      child.on('spawn', () => {
        if (!resolved && !quotaExceededDetected) {
          resolved = true;
          resolve(child);
        }
      });
      
      // Handle spawn errors
      child.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });
      
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync('gemini --version');
      return true;
    } catch (error) {
      return false;
    }
  }

  getCommand(): string[] {
    return ['gemini', '--model', this.primaryModel, '--yolo', '--prompt', ''];
  }
}