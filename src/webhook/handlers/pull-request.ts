import { Request, Response } from 'express';
import { Logger } from '../../utils/logger';
import { Config } from '../../config';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AIProviderFactory } from '../../ai/factory';

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

      // Create temporary prompt file in temp folder
      const tempPromptFile = join(process.cwd(), 'temp', `temp-prompt-${prNumber}-${Date.now()}.md`);
      writeFileSync(tempPromptFile, processedPrompt);

      // Execute Claude CLI directly instead of using bash script
      const workingDir = this.config.ai.workingDir;
      
      this.logger.info(`Executing Claude directly`);
      this.logger.info(`Working directory: ${workingDir}`);
      this.logger.info(`Temp prompt file: ${tempPromptFile}`);
      
      this.logger.info(`About to execute Claude with spawn...`);
      
      // Create a simple prompt that references the temp file
      const simplePrompt = `Please read and execute the instructions in the file: ${tempPromptFile}`;
      
      this.logger.info(`Starting AI review in background...`);
      
      // Get AI provider based on configuration
      const aiProvider = await AIProviderFactory.create(this.config.ai.preferredProvider, this.config.ai.fallbackEnabled);
      this.logger.info(`Using AI provider: ${aiProvider.name}`);
      
      // Start AI process without awaiting - fire and forget
      const child = await aiProvider.execute(simplePrompt, workingDir);
      
      // Make process detached so it continues after webhook returns
      child.unref();
      
      // Log output for debugging but don't wait for completion
      child.stdout.on('data', (data) => {
        this.logger.info(`AI stdout: ${data.toString()}`);
      });
      
      child.stderr.on('data', (data) => {
        this.logger.error(`AI stderr: ${data.toString()}`);
      });
      
      child.on('close', (code) => {
        this.logger.info(`AI process exited with code ${code}`);
        
        // Clean up temp file after AI finishes
        try {
          unlinkSync(tempPromptFile);
          this.logger.info(`Cleaned up temp file: ${tempPromptFile}`);
        } catch (e) {
          this.logger.warn(`Failed to clean up temp file: ${tempPromptFile} - ${e}`);
        }
      });
      
      child.on('error', (error) => {
        this.logger.error(`AI spawn error: ${error.message}`);
        // Clean up temp file on error
        try {
          unlinkSync(tempPromptFile);
          this.logger.info(`Cleaned up temp file after error: ${tempPromptFile}`);
        } catch (e) {
          this.logger.warn(`Failed to clean up temp file after error: ${tempPromptFile} - ${e}`);
        }
      });

      this.logger.info(`AI review started for PR #${prNumber}`);
      
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
  const action = payload.action;
  const pullRequest = payload.pull_request;
  const repository = payload.repository;
}