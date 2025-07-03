import { Request, Response } from 'express';
import { AIScriptContext } from '../../ai-scripts/script-interface';
import { codeReviewerScript } from '../../ai-scripts/code-reviewer';
import { AICLIExecutor } from '../../ai-cli/executor';
import { GitHubAPI } from '../../github/api';
import { Logger } from '../../utils/logger';
import { Config } from '../../config';

export class PullRequestHandler {
  constructor(
    private aiExecutor: AICLIExecutor,
    private githubAPI: GitHubAPI,
    private logger: Logger,
    private config: Config
  ) {}

  async handlePullRequest(payload: any, req: Request, res: Response): Promise<void> {
    if (payload.action !== 'opened' && payload.action !== 'synchronize') {
      this.logger.info(`Ignoring PR action: ${payload.action}`);
      res.status(200).json({ message: 'Event ignored' });
      return;
    }

    const prNumber = (payload as any).number;
    const repoName = (payload as any).repository.full_name;
    
    this.logger.info(`Processing PR ${payload.action} event for #${prNumber} in ${repoName}`);

    try {
      // Validate the payload
      if (!codeReviewerScript.validate || !codeReviewerScript.validate(payload)) {
        this.logger.error('Invalid payload for code review');
        res.status(400).json({ error: 'Invalid payload' });
        return;
      }

      // Create script context
      const context: AIScriptContext = {
        aiExecutor: this.aiExecutor,
        api: this.githubAPI,
        payload: payload,
        logger: this.logger,
        config: this.config,
        workingDir: this.config.ai.workingDir
      };

      // Execute the code review script
      const result = await codeReviewerScript.execute(context);

      if (result.success) {
        this.logger.info(`Code review completed successfully for PR #${prNumber}`);
        res.status(200).json({
          message: 'Code review completed',
          data: result.data
        });
      } else {
        this.logger.error(`Code review failed for PR #${prNumber}: ${result.message}`);
        res.status(500).json({
          error: 'Code review failed',
          message: result.message
        });
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