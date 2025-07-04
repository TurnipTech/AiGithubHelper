import { Request, Response } from 'express';
import { Logger } from '../../utils/logger';
import { Config } from '../../config';
import { exec } from 'child_process';
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
      // Read the prompt template
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

      // Create temporary prompt file
      const tempPromptFile = join(__dirname, `../../temp-prompt-${prNumber}-${Date.now()}.md`);
      writeFileSync(tempPromptFile, processedPrompt);

      // Execute bash script
      const scriptPath = join(__dirname, '../../../scripts/run-claude-review.sh');
      const workingDir = this.config.ai.workingDir;
      
      const { stdout, stderr } = await execAsync(`bash "${scriptPath}" "${tempPromptFile}" "${workingDir}"`);

      if (stderr && stderr.trim()) {
        this.logger.error(`Script stderr: ${stderr}`);
      }

      this.logger.info(`Code review completed successfully for PR #${prNumber}`);
      this.logger.info(`Script output: ${stdout}`);
      
      res.status(200).json({
        message: 'Code review completed',
        output: stdout
      });

      // Clean up temp file
      try {
        require('fs').unlinkSync(tempPromptFile);
      } catch (e) {
        this.logger.warn(`Failed to clean up temp file: ${tempPromptFile}`);
      }

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