import { Request, Response } from 'express';
import { Logger } from '../../utils/logger';
import { Config } from '../../config';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export class PullRequestHandler {
  constructor(
    private logger: Logger,
    private config: Config
  ) {}

  async handlePullRequest(payload: any, req: Request, res: Response): Promise<void> {
    if (payload.action !== 'opened' && payload.action !== 'synchronize') {
      this.logger.info(`Ignoring PR action: ${payload.action}`);
      res.status(200).json({ message: 'Event ignored' });
      return;
    }

    const prNumber = payload.number;
    const repoName = payload.repository.full_name;
    const prTitle = payload.pull_request.title;
    const prAuthor = payload.pull_request.user.login;
    const baseBranch = payload.pull_request.base.ref;
    const headBranch = payload.pull_request.head.ref;
    
    this.logger.info(`Processing PR ${payload.action} event for #${prNumber} in ${repoName}`);

    try {
      // Read the main prompt template
      const promptTemplatePath = join(__dirname, '../../ai-scripts/code-reviewer/prompts.md');
      const promptTemplate = readFileSync(promptTemplatePath, 'utf8');

      // Replace template variables
      const processedPrompt = promptTemplate
        .replace(/\{\{repoName\}\}/g, repoName)
        .replace(/\{\{prNumber\}\}/g, prNumber.toString())
        .replace(/\{\{prTitle\}\}/g, prTitle)
        .replace(/\{\{prAuthor\}\}/g, prAuthor)
        .replace(/\{\{baseBranch\}\}/g, baseBranch)
        .replace(/\{\{headBranch\}\}/g, headBranch);

      // Create temporary prompt file outside src directory
      const tempPromptFile = join(process.cwd(), `temp-prompt-${prNumber}-${Date.now()}.md`);
      writeFileSync(tempPromptFile, processedPrompt);

      // Execute Claude CLI directly instead of using bash script
      const workingDir = this.config.ai.workingDir;
      
      this.logger.info(`Executing Claude directly`);
      this.logger.info(`Working directory: ${workingDir}`);
      this.logger.info(`Temp prompt file: ${tempPromptFile}`);
      
      this.logger.info(`About to execute Claude with spawn...`);
      
      // Create a simple prompt that references the temp file
      const simplePrompt = `Please read and execute the instructions in the file: ${tempPromptFile}`;
      
      this.logger.info(`Starting Claude review in background...`);
      
      // Start Claude process without awaiting - fire and forget
      const child = spawn('claude', ['--print', '--dangerously-skip-permissions'], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true // Run detached so it continues after webhook returns
      });
      
      // Write the simple prompt to stdin
      child.stdin.write(simplePrompt);
      child.stdin.end();
      
      // Log output for debugging but don't wait for completion
      child.stdout.on('data', (data) => {
        this.logger.info(`Claude stdout: ${data.toString()}`);
      });
      
      child.stderr.on('data', (data) => {
        this.logger.error(`Claude stderr: ${data.toString()}`);
      });
      
      child.on('close', (code) => {
        this.logger.info(`Claude process exited with code ${code}`);
        
        // Clean up temp file after Claude finishes
        try {
          require('fs').unlinkSync(tempPromptFile);
          this.logger.info(`Cleaned up temp file: ${tempPromptFile}`);
        } catch (e) {
          this.logger.warn(`Failed to clean up temp file: ${tempPromptFile}`);
        }
      });
      
      child.on('error', (error) => {
        this.logger.error(`Claude spawn error: ${error.message}`);
      });
      
      // Unref the child process so it doesn't keep the parent alive
      child.unref();

      this.logger.info(`Claude review started for PR #${prNumber}`);
      
      res.status(200).json({
        message: 'Code review started',
        prNumber: prNumber
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error handling PR event: ${errorMessage}`);
      res.status(500).json({
        error: 'Internal server error',
        message: errorMessage
      });
    }
  }
}

export function createPullRequestHandler(payload: any) {
  console.log('Processing pull request event...');
  
  const action = payload.action;
  const pullRequest = payload.pull_request;
  const repository = payload.repository;
  
  console.log(`Pull request ${action}:`);
  console.log(`- Repository: ${repository.full_name}`);
  console.log(`- PR #${pullRequest.number}: ${pullRequest.title}`);
  console.log(`- Author: ${pullRequest.user.login}`);
  console.log(`- State: ${pullRequest.state}`);
}