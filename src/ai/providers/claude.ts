import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { AIProvider } from './base';

const execAsync = promisify(exec);

export class ClaudeProvider implements AIProvider {
  public readonly name = 'claude';

  async execute(prompt: string, workingDir: string): Promise<ChildProcess> {
    const child = spawn('claude', ['--print', '--dangerously-skip-permissions'], {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    child.stdin.write(prompt);
    child.stdin.end();

    return child;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync('claude --version');
      return true;
    } catch (error) {
      return false;
    }
  }

  getCommand(): string[] {
    return ['claude', '--print', '--dangerously-skip-permissions'];
  }
}
