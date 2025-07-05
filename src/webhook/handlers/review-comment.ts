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
  id: number;
  html_url: string;
}

interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  user: GitHubUser;
}

interface GitHubRepository {
  full_name: string;
  name: string;
  html_url: string;
  clone_url: string;
}

interface GitHubReviewComment {
  id: number;
  body: string;
  user: GitHubUser;
  path: string;
  position: number | null;
  line: number | null;
  diff_hunk: string;
  html_url: string;
}

interface GitHubReview {
  id: number;
  body: string | null;
  user: GitHubUser;
  state: string;
  html_url: string;
}

interface GitHubReviewCommentPayload {
  action: string;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  comment: GitHubReviewComment;
}

interface GitHubPullRequestReviewPayload {
  action: string;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  review: GitHubReview;
}

export class ReviewCommentHandler {
  constructor(
    private logger: Logger,
    private config: Config,
  ) {}

  async handleReviewComment(
    payload: GitHubReviewCommentPayload,
    req: Request,
    res: Response,
  ): Promise<void> {
    const action = payload.action;
    const pullRequest = payload.pull_request;
    const repository = payload.repository;
    const comment = payload.comment;

    this.logger.info(
      `Processing review comment ${action} event for PR #${pullRequest.number} in ${repository.full_name}`,
    );

    // Only handle created comments
    if (action !== 'created') {
      this.logger.info(`Ignoring review comment action: ${action}`);
      res.status(200).json({ message: 'Event ignored' });
      return;
    }

    // Check if the AI helper is mentioned
    const aiHelperRegex = /(?:^|[^\w])@ai-helper\b/i;
    const aiHelperMentioned = aiHelperRegex.test(comment.body);

    if (!aiHelperMentioned) {
      this.logger.info(`AI helper not mentioned in review comment for PR #${pullRequest.number}`);
      res.status(200).json({ message: 'AI helper not mentioned' });
      return;
    }

    this.logger.info(
      `AI helper mentioned in review comment for PR #${pullRequest.number}, starting response process`,
    );

    try {
      await this.processReviewComment(pullRequest, repository, comment);
      res.status(200).json({
        message: 'Review comment processing started',
        prNumber: pullRequest.number,
        commentId: comment.id,
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

  async handlePullRequestReview(
    payload: GitHubPullRequestReviewPayload,
    req: Request,
    res: Response,
  ): Promise<void> {
    const action = payload.action;
    const pullRequest = payload.pull_request;
    const repository = payload.repository;
    const review = payload.review;

    this.logger.info(
      `Processing pull request review ${action} event for PR #${pullRequest.number} in ${repository.full_name}`,
    );

    // Only handle submitted reviews
    if (action !== 'submitted') {
      this.logger.info(`Ignoring pull request review action: ${action}`);
      res.status(200).json({ message: 'Event ignored' });
      return;
    }

    // Check if the AI helper is mentioned in the review body
    const aiHelperRegex = /(?:^|[^\w])@ai-helper\b/i;
    const aiHelperMentioned = review.body && aiHelperRegex.test(review.body);

    if (!aiHelperMentioned) {
      this.logger.info(
        `AI helper not mentioned in pull request review for PR #${pullRequest.number}`,
      );
      res.status(200).json({ message: 'AI helper not mentioned' });
      return;
    }

    this.logger.info(
      `AI helper mentioned in pull request review for PR #${pullRequest.number}, starting response process`,
    );

    try {
      await this.processGeneralReview(pullRequest, repository, review);
      res.status(200).json({
        message: 'Pull request review processing started',
        prNumber: pullRequest.number,
        reviewId: review.id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error handling pull request review event: ${errorMessage}`);
      res.status(500).json({
        error: 'Internal server error',
        message: errorMessage,
      });
    }
  }

  private async processReviewComment(
    pullRequest: GitHubPullRequest,
    repository: GitHubRepository,
    comment: GitHubReviewComment,
  ): Promise<void> {
    // Create a unique temporary working directory for this review comment
    const tempWorkDir = resolve(
      tmpdir(),
      'ai-github-helper',
      `review-comment-${comment.id}-${Date.now()}`,
    );

    // Ensure temp directory exists
    if (!existsSync(tempWorkDir)) {
      mkdirSync(tempWorkDir, { recursive: true });
    }

    this.logger.info(`Created temporary working directory: ${tempWorkDir}`);

    try {
      // Clone the repository using GitHub CLI
      const repoPath = resolve(tempWorkDir, this.sanitizeFilename(repository.name));
      await this.cloneRepository(repository, repoPath);

      // Checkout the PR branch
      await this.checkoutPRBranch(repoPath, pullRequest);

      // Create a comprehensive prompt for review comment response
      const processedPrompt = this.createReviewCommentPrompt(pullRequest, repository, comment);

      this.logger.info(
        `Starting AI analysis for review comment ${comment.id} on PR #${pullRequest.number}`,
      );

      // Get AI provider based on configuration
      const aiProvider = await this.getAIProvider();
      this.logger.info(`Using AI provider: ${aiProvider.name}`);

      // Start AI process with proper process management
      const child = await aiProvider.execute(processedPrompt, repoPath);

      // Set up cleanup handlers
      this.setupCleanupHandlers(child, tempWorkDir);

      this.logger.info(`AI review comment response started for PR #${pullRequest.number}`);
    } catch (error) {
      // Clean up on error
      try {
        rmSync(tempWorkDir, { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger.warn(`Failed to clean up temp directory: ${cleanupError}`);
      }
      throw error;
    }
  }

  private async processGeneralReview(
    pullRequest: GitHubPullRequest,
    repository: GitHubRepository,
    review: GitHubReview,
  ): Promise<void> {
    // Create a unique temporary working directory for this review
    const tempWorkDir = resolve(tmpdir(), 'ai-github-helper', `review-${review.id}-${Date.now()}`);

    // Ensure temp directory exists
    if (!existsSync(tempWorkDir)) {
      mkdirSync(tempWorkDir, { recursive: true });
    }

    this.logger.info(`Created temporary working directory: ${tempWorkDir}`);

    try {
      // Clone the repository using GitHub CLI
      const repoPath = resolve(tempWorkDir, this.sanitizeFilename(repository.name));
      await this.cloneRepository(repository, repoPath);

      // Checkout the PR branch
      await this.checkoutPRBranch(repoPath, pullRequest);

      // Create a comprehensive prompt for general review response
      const processedPrompt = this.createGeneralReviewPrompt(pullRequest, repository, review);

      this.logger.info(`Starting AI analysis for review ${review.id} on PR #${pullRequest.number}`);

      // Get AI provider based on configuration
      const aiProvider = await this.getAIProvider();
      this.logger.info(`Using AI provider: ${aiProvider.name}`);

      // Start AI process with proper process management
      const child = await aiProvider.execute(processedPrompt, repoPath);

      // Set up cleanup handlers
      this.setupCleanupHandlers(child, tempWorkDir);

      this.logger.info(`AI review response started for PR #${pullRequest.number}`);
    } catch (error) {
      // Clean up on error
      try {
        rmSync(tempWorkDir, { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger.warn(`Failed to clean up temp directory: ${cleanupError}`);
      }
      throw error;
    }
  }

  private async cloneRepository(repository: GitHubRepository, repoPath: string): Promise<void> {
    const sanitizedRepoName = this.sanitizeRepositoryName(repository.full_name);
    this.logger.info(`Cloning repository ${sanitizedRepoName} to ${repoPath}`);

    return new Promise<void>((resolve, reject) => {
      const ghClone = spawn('gh', ['repo', 'clone', sanitizedRepoName, repoPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

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
  }

  private async checkoutPRBranch(repoPath: string, pullRequest: GitHubPullRequest): Promise<void> {
    const sanitizedBranchName = this.sanitizeBranchName(pullRequest.head.ref);
    this.logger.info(`Checking out PR branch ${sanitizedBranchName} in ${repoPath}`);

    return new Promise<void>((resolve, reject) => {
      const gitCheckout = spawn('git', ['checkout', sanitizedBranchName], {
        cwd: repoPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

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
          this.logger.info(`Successfully checked out PR branch: ${checkoutOutput}`);
          resolve();
        } else {
          this.logger.error(`Failed to checkout PR branch: ${checkoutError}`);
          reject(new Error(`Git checkout failed with code ${code}: ${checkoutError}`));
        }
      });

      gitCheckout.on('error', (error) => {
        this.logger.error(`Git checkout spawn error: ${error.message}`);
        reject(error);
      });
    });
  }

  private setupCleanupHandlers(child: any, tempWorkDir: string): void {
    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;

      try {
        if (!child.killed) {
          child.kill('SIGTERM');
        }
      } catch (e) {
        this.logger.warn(`Failed to kill AI process: ${e}`);
      }

      try {
        rmSync(tempWorkDir, { recursive: true, force: true });
        this.logger.info(`Cleaned up temp working directory: ${tempWorkDir}`);
      } catch (e) {
        this.logger.warn(`Failed to clean up temp working directory: ${tempWorkDir} - ${e}`);
      }

      try {
        process.off('exit', cleanup);
        process.off('SIGINT', cleanup);
        process.off('SIGTERM', cleanup);
      } catch (e) {
        this.logger.warn(`Failed to remove process listeners: ${e}`);
      }
    };

    // Set up timeout to prevent hanging processes
    const timeout = setTimeout(
      () => {
        this.logger.warn(`AI process timeout, killing process`);
        cleanup();
      },
      10 * 60 * 1000,
    ); // 10 minutes timeout

    // Log output for debugging
    child.stdout?.on('data', (data: Buffer) => {
      this.logger.info(`AI stdout: ${data.toString()}`);
    });

    child.stderr?.on('data', (data: Buffer) => {
      this.logger.error(`AI stderr: ${data.toString()}`);
    });

    child.on('close', (code: number) => {
      clearTimeout(timeout);
      this.logger.info(`AI process exited with code ${code}`);
      cleanup();
    });

    child.on('error', (error: Error) => {
      clearTimeout(timeout);
      this.logger.error(`AI spawn error: ${error.message}`);
      cleanup();
    });

    // Handle process exit cleanup
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  private createReviewCommentPrompt(
    pullRequest: GitHubPullRequest,
    repository: GitHubRepository,
    comment: GitHubReviewComment,
  ): string {
    try {
      // Load prompt template from file
      const promptTemplatePath = resolve(__dirname, '../../ai-scripts/review-response/prompts.md');
      let promptTemplate = readFileSync(promptTemplatePath, 'utf8');

      // Replace template variables with escaped values
      promptTemplate = promptTemplate
        .replace(/{{repoName}}/g, this.escapeTemplateString(repository.full_name))
        .replace(/{{prNumber}}/g, pullRequest.number.toString())
        .replace(/{{prTitle}}/g, this.escapeTemplateString(pullRequest.title))
        .replace(/{{prAuthor}}/g, this.escapeTemplateString(pullRequest.user.login))
        .replace(/{{prUrl}}/g, this.escapeTemplateString(pullRequest.html_url))
        .replace(/{{headBranch}}/g, this.escapeTemplateString(pullRequest.head.ref))
        .replace(/{{baseBranch}}/g, this.escapeTemplateString(pullRequest.base.ref))
        .replace(/{{commentId}}/g, comment.id.toString())
        .replace(/{{commentAuthor}}/g, this.escapeTemplateString(comment.user.login))
        .replace(/{{commentBody}}/g, this.escapeTemplateString(comment.body))
        .replace(/{{commentPath}}/g, this.escapeTemplateString(comment.path))
        .replace(/{{commentLine}}/g, comment.line?.toString() || 'N/A')
        .replace(/{{diffHunk}}/g, this.escapeTemplateString(comment.diff_hunk));

      // Handle comment section - show comment block, hide review block
      promptTemplate = promptTemplate
        .replace(/{{#comment}}/g, '')
        .replace(/{{\/comment}}/g, '')
        .replace(/{{#review}}[\s\S]*?{{\/review}}/g, '');

      return promptTemplate;
    } catch (error) {
      this.logger.error(`Failed to load review comment prompt template: ${error}`);
      throw new Error(`Unable to load prompt template: ${error}`);
    }
  }

  private createGeneralReviewPrompt(
    pullRequest: GitHubPullRequest,
    repository: GitHubRepository,
    review: GitHubReview,
  ): string {
    try {
      // Load prompt template from file
      const promptTemplatePath = resolve(__dirname, '../../ai-scripts/review-response/prompts.md');
      let promptTemplate = readFileSync(promptTemplatePath, 'utf8');

      // Replace template variables for general review with escaped values
      promptTemplate = promptTemplate
        .replace(/{{repoName}}/g, this.escapeTemplateString(repository.full_name))
        .replace(/{{prNumber}}/g, pullRequest.number.toString())
        .replace(/{{prTitle}}/g, this.escapeTemplateString(pullRequest.title))
        .replace(/{{prAuthor}}/g, this.escapeTemplateString(pullRequest.user.login))
        .replace(/{{prUrl}}/g, this.escapeTemplateString(pullRequest.html_url))
        .replace(/{{headBranch}}/g, this.escapeTemplateString(pullRequest.head.ref))
        .replace(/{{baseBranch}}/g, this.escapeTemplateString(pullRequest.base.ref))
        .replace(/{{reviewId}}/g, review.id.toString())
        .replace(/{{reviewAuthor}}/g, this.escapeTemplateString(review.user.login))
        .replace(
          /{{reviewBody}}/g,
          this.escapeTemplateString(review.body || 'No review body provided'),
        )
        .replace(/{{reviewState}}/g, this.escapeTemplateString(review.state));

      // Handle review section - show review block, hide comment block
      promptTemplate = promptTemplate
        .replace(/{{#review}}/g, '')
        .replace(/{{\/review}}/g, '')
        .replace(/{{#comment}}[\s\S]*?{{\/comment}}/g, '');

      return promptTemplate;
    } catch (error) {
      this.logger.error(`Failed to load general review prompt template: ${error}`);
      throw new Error(`Unable to load prompt template: ${error}`);
    }
  }

  private sanitizeRepositoryName(fullName: string): string {
    if (!fullName || typeof fullName !== 'string') {
      throw new Error('Repository name must be a non-empty string');
    }

    // Basic GitHub repository name validation
    const repoNameRegex = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
    if (!repoNameRegex.test(fullName)) {
      throw new Error('Invalid repository name format');
    }

    return fullName;
  }

  private sanitizeBranchName(branchName: string): string {
    if (!branchName || typeof branchName !== 'string') {
      throw new Error('Branch name must be a non-empty string');
    }

    // Basic Git branch name validation
    const branchNameRegex = /^[a-zA-Z0-9/_.-]+$/;
    if (!branchNameRegex.test(branchName)) {
      throw new Error('Invalid branch name format');
    }

    // Prevent potentially dangerous branch names
    if (branchName.includes('..') || branchName.startsWith('/') || branchName.endsWith('/')) {
      throw new Error('Branch name contains invalid characters');
    }

    return branchName;
  }

  private sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Filename must be a non-empty string');
    }

    // Remove dangerous characters and paths
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Prevent directory traversal
    if (sanitized.includes('..') || sanitized.startsWith('/') || sanitized.startsWith('\\')) {
      throw new Error('Filename contains invalid characters');
    }

    return sanitized;
  }

  private escapeTemplateString(value: string): string {
    if (!value || typeof value !== 'string') {
      return '';
    }

    // Escape special characters to prevent template injection
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async getAIProvider() {
    return await AIProviderFactory.create(
      this.config.ai.preferredProvider,
      this.config.ai.fallbackEnabled,
    );
  }
}
