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
    // Try primary model first, with fallback to flash model if usage limits hit
    let child = await this.tryExecuteWithModel(prompt, workingDir, this.primaryModel);
    
    // If primary model fails (possibly due to usage limits), try fallback
    if (!child) {
      child = await this.tryExecuteWithModel(prompt, workingDir, this.fallbackModel);
    }
    
    if (!child) {
      throw new Error('Failed to execute with both Gemini pro and flash models');
    }
    
    return child;
  }

  private async tryExecuteWithModel(prompt: string, workingDir: string, model: string): Promise<ChildProcess | null> {
    try {
      const child = spawn('gemini', ['--model', model, '--yolo', '--prompt', ''], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });
      
      child.stdin.write(prompt);
      child.stdin.end();
      
      return child;
    } catch (error) {
      // Return null if this model fails, so we can try fallback
      return null;
    }
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