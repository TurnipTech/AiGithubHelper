import { Request, Response } from 'express';
import { Logger } from '../../utils/logger';
import { Config } from '../../config';
import { spawn } from 'child_process';
import { mkdirSync, existsSync, readFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { AIProviderFactory } from '../../ai/factory';

interface GitHubUser {
  login: string;
}

interface GitHubPullRequest {
  number: number;
  html_url: string;
  head: {
    ref: string;
    sha: string;
  };
}

interface GitHubRepository {
  full_name: string;
  name: string;
  clone_url: string;
}

interface GitHubReviewComment {
  body: string;
  user: GitHubUser;
  path: string;
  diff_hunk: string;
}

interface GitHubReview {
  body: string;
  user: GitHubUser;
}

interface GitHubReviewPayload {
  action: string;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  comment?: GitHubReviewComment;
  review?: GitHubReview;
}

export class ReviewCommentHandler {
  constructor(
    private logger: Logger,
    private config: Config,
  ) {}

  async handleReviewComment(payload: GitHubReviewPayload, req: Request, res: Response): Promise<void> {
    const { action, pull_request, repository, comment, review } = payload;

    this.logger.info(
      `Processing review comment event for PR #${pull_request.number} in ${repository.full_name}`,
    );

    let textToCheck = '';
    if (action === 'created' && comment) {
      textToCheck = comment.body;
    } else if (action === 'submitted' && review) {
      textToCheck = review.body;
    } else {
      this.logger.info(`Ignoring review comment action: ${action}`);
      res.status(200).json({ message: 'Event ignored' });
      return;
    }

    const aiHelperRegex = /(?:^|[^\w])@ai-helper\b/i;
    if (!aiHelperRegex.test(textToCheck)) {
      this.logger.info(`AI helper not mentioned in PR #${pull_request.number}`);
      res.status(200).json({ message: 'AI helper not mentioned' });
      return;
    }

    this.logger.info(
      `AI helper mentioned in PR #${pull_request.number}, starting code generation process`,
    );

    try {
      // Create a unique temporary working directory for this issue
      const tempWorkDir = resolve(
        tmpdir(),
        'ai-github-helper',
        `pr-${pull_request.number}-${Date.now()}`,
      );

      // Ensure temp directory exists
      if (!existsSync(tempWorkDir)) {
        mkdirSync(tempWorkDir, { recursive: true });
      }

      this.logger.info(`Created temporary working directory: ${tempWorkDir}`);

      // Clone the repository using GitHub CLI (already authenticated)
      const sanitizedRepoName = repository.name.replace(/[^a-zA-Z0-9-._]/g, '_');
      const repoPath = resolve(tempWorkDir, sanitizedRepoName);

      this.logger.info(`Cloning repository ${repository.full_name} to ${repoPath}`);

      // Clone the repository using gh CLI
      const ghClone = spawn('gh', ['repo', 'clone', repository.full_name, repoPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      await new Promise<void>((resolve, reject) => {
        let cloneOutput = '';
        let cloneError = '';

        ghClone.stdout.on('data', (data) => {
          cloneOutput += data.toString();
        });

        ghClone.stderr.on('data', (data) => {
          cloneError += data.toString();
        });

        ghClone.on('close', (code) => {
          if (code === 0) {
            this.logger.info(`Successfully cloned repository: ${cloneOutput}`);
            resolve();
          } else {
            this.logger.error(`Failed to clone repository: ${cloneError}`);
            reject(new Error(`GitHub CLI clone failed with code ${code}: ${cloneError}`));
          }
        });

        ghClone.on('error', (error) => {
          this.logger.error(`GitHub CLI clone spawn error: ${error.message}`);
          reject(error);
        });
      });

      // Checkout the PR branch
      const gitCheckout = spawn('git', ['checkout', pull_request.head.ref], {
        cwd: repoPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      await new Promise<void>((resolve, reject) => {
        let checkoutOutput = '';
        let checkoutError = '';

        gitCheckout.stdout.on('data', (data) => {
          checkoutOutput += data.toString();
        });

        gitCheckout.stderr.on('data', (data) => {
          checkoutError += data.toString();
        });

        gitCheckout.on('close', (code) => {
          if (code === 0) {
            this.logger.info(`Successfully checked out branch: ${checkoutOutput}`);
            resolve();
          } else {
            this.logger.error(`Failed to checkout branch: ${checkoutError}`);
            reject(new Error(`Git checkout failed with code ${code}: ${checkoutError}`));
          }
        });

        gitCheckout.on('error', (error) => {
          this.logger.error(`Git checkout spawn error: ${error.message}`);
          reject(error);
        });
      });

      // Create a comprehensive prompt for review response
      const processedPrompt = this.createReviewResponsePrompt(pull_request, repository, comment, review);

      const workingDir = repoPath;

      this.logger.info(`Starting AI analysis for PR #${pull_request.number}`);
      this.logger.info(`Working directory: ${workingDir}`);

      this.logger.info(`Starting AI review response in background...`);

      // Get AI provider based on configuration
      let aiProvider;
      try {
        aiProvider = await AIProviderFactory.create(
          this.config.ai.preferredProvider,
          this.config.ai.fallbackEnabled,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to create AI provider: ${errorMessage}`);
        res.status(500).json({
          error: 'Failed to create AI provider',
          message: errorMessage,
        });
        return;
      }
      this.logger.info(`Using AI provider: ${aiProvider.name}`);

      // Start AI process with proper process management
      const child = await aiProvider.execute(processedPrompt, workingDir);

      // Set up proper cleanup handlers
      let isCleanedUp = false;
      let isCleaningUp = false;
      const cleanup = () => {
        if (isCleanedUp || isCleaningUp) return;
        isCleaningUp = true;

        try {
          if (!child.killed) {
            child.kill('SIGTERM');
          }
        } catch (e) {
          this.logger.warn(`Failed to kill AI process: ${e}`);
        }

        try {
          // Clean up the entire temporary working directory
          rmSync(tempWorkDir, { recursive: true, force: true });
          this.logger.info(`Cleaned up temp working directory: ${tempWorkDir}`);
        } catch (e) {
          this.logger.warn(`Failed to clean up temp working directory: ${tempWorkDir} - ${e}`);
        }

        // Remove event listeners to prevent memory leaks
        try {
          process.off('exit', cleanup);
          process.off('SIGINT', cleanup);
          process.off('SIGTERM', cleanup);
        } catch (e) {
          this.logger.warn(`Failed to remove process listeners: ${e}`);
        }
        isCleanedUp = true;
        isCleaningUp = false;
      };

      // Set up timeout to prevent hanging processes
      const timeout = setTimeout(
        () => {
          this.logger.warn(`AI process timeout, killing process`);
          cleanup();
        },
        10 * 60 * 1000,
      ); // 10 minutes timeout

      // Log output for debugging but don't wait for completion
      child.stdout?.on('data', (data) => {
        this.logger.info(`AI stdout: ${data.toString()}`);
      });

      child.stderr?.on('data', (data) => {
        this.logger.error(`AI stderr: ${data.toString()}`);
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        this.logger.info(`AI process exited with code ${code}`);
        cleanup();
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        this.logger.error(`AI spawn error: ${error.message}`);
        cleanup();
      });

      // Handle process exit cleanup (will be removed in cleanup function)
      process.on('exit', cleanup);
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      this.logger.info(`AI review response started for PR #${pull_request.number}`);

      res.status(200).json({
        message: 'Review comment analysis and code generation started',
        prNumber: pull_request.number,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error handling review comment event: ${errorMessage}`);
      res.status(500).json({
        error: 'Internal server error',
        message: errorMessage,
      });
    }
  }

  private createReviewResponsePrompt(
    pullRequest: GitHubPullRequest,
    repository: GitHubRepository,
    comment?: GitHubReviewComment,
    review?: GitHubReview,
  ): string {
    try {
      // Load prompt template from file
      const promptTemplatePath = resolve(__dirname, '../../ai-scripts/review-response/prompts.md');
      let promptTemplate = readFileSync(promptTemplatePath, 'utf8');

      const escape = (str: string) => str.replace(/[&<>"]/g, (tag) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
      }[tag] || tag));

      // Replace template variables
      promptTemplate = promptTemplate
        .replace(/{{repoName}}/g, escape(repository.full_name))
        .replace(/{{prNumber}}/g, escape(pullRequest.number.toString()))
        .replace(/{{prUrl}}/g, escape(pullRequest.html_url))
        .replace(/{{headBranch}}/g, escape(pullRequest.head.ref));

      if (comment) {
        promptTemplate = promptTemplate
          .replace(/{{#comment}}/g, '')
          .replace(/{{\/comment}}/g, '')
          .replace(/{{filePath}}/g, escape(comment.path))
          .replace(/{{diff}}/g, escape(comment.diff_hunk))
          .replace(/{{commentBody}}/g, escape(comment.body));
      } else {
        promptTemplate = promptTemplate.replace(/{{#comment}}[\s\S]*?{{\/comment}}/g, '');
      }

      if (review) {
        promptTemplate = promptTemplate
          .replace(/{{#review}}/g, '')
          .replace(/{{\/review}}/g, '')
          .replace(/{{reviewBody}}/g, escape(review.body));
      } else {
        promptTemplate = promptTemplate.replace(/{{#review}}[\s\S]*?{{\/review}}/g, '');
      }

      return promptTemplate;
    } catch (error) {
      this.logger.error(`Failed to load prompt template: ${error}`);
      // Fallback to simple prompt if template loading fails
      return `# AI Helper - Review Response

Implement the requested changes for PR #${pullRequest.number} in ${repository.full_name}`;
    }
  }
}
