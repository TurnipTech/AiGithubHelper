import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { AIProvider } from './base';

const execAsync = promisify(exec);

export class GeminiProvider implements AIProvider {
  public readonly name = 'gemini';
  private primaryModel = 'gemini-2.5-pro';
  private fallbackModel = 'gemini-2.5-flash';

  async execute(prompt: string, workingDir: string): Promise<ChildProcess> {
    // Try primary model first
    try {
      const primaryChild = await this.tryModel(this.primaryModel, prompt, workingDir);
      if (primaryChild) {
        return primaryChild;
      }
    } catch (error) {
      console.log(`Primary model ${this.primaryModel} failed, trying fallback...`);
    }
    
    // Fall back to Flash model
    try {
      const fallbackChild = await this.tryModel(this.fallbackModel, prompt, workingDir);
      if (fallbackChild) {
        console.log(`Successfully fell back to ${this.fallbackModel}`);
        return fallbackChild;
      }
    } catch (error) {
      console.log(`Fallback model ${this.fallbackModel} also failed`);
    }
    
    throw new Error(`Both ${this.primaryModel} and ${this.fallbackModel} failed`);
  }
  
  private async tryModel(model: string, prompt: string, workingDir: string): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      const child = spawn('gemini', ['--model', model, '--yolo', '--prompt', ''], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });
      
      let stderrBuffer = '';
      let resolved = false;
      
      // Set up a timeout to determine if the process is working
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(child);
        }
      }, 5000); // 5 second timeout
      
      child.stderr.on('data', (data) => {
        stderrBuffer += data.toString();
        
        // Check for quota exceeded or other critical errors
        if (stderrBuffer.includes('Quota exceeded') || 
            stderrBuffer.includes('status 429') || 
            stderrBuffer.includes('rateLimitExceeded') ||
            stderrBuffer.includes('NOT_FOUND') ||
            stderrBuffer.includes('API Error')) {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            child.kill('SIGTERM');
            reject(new Error(`Model ${model} failed: ${stderrBuffer}`));
          }
        }
      });
      
      child.on('error', (error) => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });
      
      child.on('exit', (code) => {
        clearTimeout(timeout);
        if (!resolved && code !== 0) {
          resolved = true;
          reject(new Error(`Model ${model} exited with code ${code}`));
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