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
      const repoPath = resolve(tempWorkDir, repository.name);
      await this.cloneRepository(repository, repoPath);

      // Checkout the PR branch
      await this.checkoutPRBranch(repoPath, pullRequest);

      // Create a comprehensive prompt for review comment response
      const processedPrompt = this.createReviewCommentPrompt(pullRequest, repository, comment);

      this.logger.info(
        `Starting AI analysis for review comment ${comment.id} on PR #${pullRequest.number}`,
      );

      // Get AI provider based on configuration
      const aiProvider = await AIProviderFactory.create(
        this.config.ai.preferredProvider,
        this.config.ai.fallbackEnabled,
      );
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
      const repoPath = resolve(tempWorkDir, repository.name);
      await this.cloneRepository(repository, repoPath);

      // Checkout the PR branch
      await this.checkoutPRBranch(repoPath, pullRequest);

      // Create a comprehensive prompt for general review response
      const processedPrompt = this.createGeneralReviewPrompt(pullRequest, repository, review);

      this.logger.info(`Starting AI analysis for review ${review.id} on PR #${pullRequest.number}`);

      // Get AI provider based on configuration
      const aiProvider = await AIProviderFactory.create(
        this.config.ai.preferredProvider,
        this.config.ai.fallbackEnabled,
      );
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
    this.logger.info(`Cloning repository ${repository.full_name} to ${repoPath}`);

    return new Promise<void>((resolve, reject) => {
      const ghClone = spawn('gh', ['repo', 'clone', repository.full_name, repoPath], {
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
    this.logger.info(`Checking out PR branch ${pullRequest.head.ref} in ${repoPath}`);

    return new Promise<void>((resolve, reject) => {
      const gitCheckout = spawn('git', ['checkout', pullRequest.head.ref], {
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

      // Replace template variables
      promptTemplate = promptTemplate
        .replace(/{{repoName}}/g, repository.full_name)
        .replace(/{{prNumber}}/g, pullRequest.number.toString())
        .replace(/{{prTitle}}/g, pullRequest.title)
        .replace(/{{prAuthor}}/g, pullRequest.user.login)
        .replace(/{{prUrl}}/g, pullRequest.html_url)
        .replace(/{{headBranch}}/g, pullRequest.head.ref)
        .replace(/{{baseBranch}}/g, pullRequest.base.ref)
        .replace(/{{commentId}}/g, comment.id.toString())
        .replace(/{{commentAuthor}}/g, comment.user.login)
        .replace(/{{commentBody}}/g, comment.body)
        .replace(/{{commentPath}}/g, comment.path)
        .replace(/{{commentLine}}/g, comment.line?.toString() || 'N/A')
        .replace(/{{diffHunk}}/g, comment.diff_hunk);

      // Handle comment section - show comment block, hide review block
      promptTemplate = promptTemplate
        .replace(/{{#comment}}/g, '')
        .replace(/{{\/comment}}/g, '')
        .replace(/{{#review}}[\s\S]*?{{\/review}}/g, '');

      return promptTemplate;
    } catch (error) {
      this.logger.error(`Failed to load review comment prompt template: ${error}`);
      // Fallback to simple prompt if template loading fails
      return this.createFallbackReviewCommentPrompt(pullRequest, repository, comment);
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

      // Replace template variables for general review
      promptTemplate = promptTemplate
        .replace(/{{repoName}}/g, repository.full_name)
        .replace(/{{prNumber}}/g, pullRequest.number.toString())
        .replace(/{{prTitle}}/g, pullRequest.title)
        .replace(/{{prAuthor}}/g, pullRequest.user.login)
        .replace(/{{prUrl}}/g, pullRequest.html_url)
        .replace(/{{headBranch}}/g, pullRequest.head.ref)
        .replace(/{{baseBranch}}/g, pullRequest.base.ref)
        .replace(/{{reviewId}}/g, review.id.toString())
        .replace(/{{reviewAuthor}}/g, review.user.login)
        .replace(/{{reviewBody}}/g, review.body || 'No review body provided')
        .replace(/{{reviewState}}/g, review.state);

      // Handle review section - show review block, hide comment block
      promptTemplate = promptTemplate
        .replace(/{{#review}}/g, '')
        .replace(/{{\/review}}/g, '')
        .replace(/{{#comment}}[\s\S]*?{{\/comment}}/g, '');

      return promptTemplate;
    } catch (error) {
      this.logger.error(`Failed to load general review prompt template: ${error}`);
      // Fallback to simple prompt if template loading fails
      return this.createFallbackGeneralReviewPrompt(pullRequest, repository, review);
    }
  }

  private createFallbackReviewCommentPrompt(
    pullRequest: GitHubPullRequest,
    repository: GitHubRepository,
    comment: GitHubReviewComment,
  ): string {
    return `# AI Helper - Review Comment Response

You are responding to a code review comment that mentions @ai-helper. Your job is to implement the requested changes and push them to the PR branch.

## Context
- Repository: ${repository.full_name}
- PR Number: #${pullRequest.number}
- PR Title: ${pullRequest.title}
- PR Author: ${pullRequest.user.login}
- Comment Author: ${comment.user.login}
- File: ${comment.path}
- Line: ${comment.line || 'N/A'}

## Review Comment
${comment.body}

## Diff Context
\`\`\`
${comment.diff_hunk}
\`\`\`

## Task
Analyze the review comment and implement the requested changes:
1. Understand what the reviewer is asking for
2. Locate the relevant code in the repository
3. Implement the requested changes
4. Commit the changes with a descriptive message
5. Reply to the comment confirming implementation

## Working Environment
You are working in a cloned repository with the PR branch checked out.
Make changes directly to the files and commit them.

Start by analyzing the comment and implementing the solution.`;
  }

  private createFallbackGeneralReviewPrompt(
    pullRequest: GitHubPullRequest,
    repository: GitHubRepository,
    review: GitHubReview,
  ): string {
    return `# AI Helper - General Review Response

You are responding to a general pull request review that mentions @ai-helper. Your job is to implement the requested changes and push them to the PR branch.

## Context
- Repository: ${repository.full_name}
- PR Number: #${pullRequest.number}
- PR Title: ${pullRequest.title}
- PR Author: ${pullRequest.user.login}
- Review Author: ${review.user.login}
- Review State: ${review.state}

## Review Comments
${review.body || 'No review body provided'}

## Task
Analyze the review and implement the requested changes:
1. Understand what the reviewer is asking for
2. Locate the relevant code in the repository
3. Implement the requested changes
4. Commit the changes with a descriptive message
5. Reply to the review confirming implementation

## Working Environment
You are working in a cloned repository with the PR branch checked out.
Make changes directly to the files and commit them.

Start by analyzing the review and implementing the solution.`;
  }
}
