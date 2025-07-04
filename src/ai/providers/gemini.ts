import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { AIProvider } from './base';

const execAsync = promisify(exec);

export class GeminiProvider implements AIProvider {
  public readonly name = 'gemini';

  async execute(prompt: string, workingDir: string): Promise<ChildProcess> {
    const child = spawn('gemini', [prompt], {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });
    
    return child;
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
    return ['gemini'];
  }
}