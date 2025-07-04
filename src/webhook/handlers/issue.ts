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

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: GitHubUser;
}

interface GitHubComment {
  body: string;
  user: GitHubUser;
}

interface GitHubRepository {
  full_name: string;
  name: string;
  html_url: string;
}

interface GitHubIssuePayload {
  action: string;
  issue: GitHubIssue;
  repository: GitHubRepository;
  comment?: GitHubComment;
}

export class IssueHandler {
  constructor(
    private logger: Logger,
    private config: Config,
  ) {}

  async handleIssue(payload: GitHubIssuePayload, req: Request, res: Response): Promise<void> {
    const action = payload.action;
    const issue = payload.issue;
    const repository = payload.repository;
    const comment = payload.comment; // For issue_comment events

    this.logger.info(
      `Processing issue ${action} event for #${issue.number} in ${repository.full_name}`,
    );

    // Handle both issue events and issue comment events
    let textToCheck = '';
    let isValidEvent = false;

    if (action === 'opened' || action === 'edited') {
      // New or edited issue
      textToCheck = `${issue.title} ${issue.body || ''}`;
      isValidEvent = true;
    } else if (action === 'created' && comment) {
      // New comment on issue
      textToCheck = comment.body || '';
      isValidEvent = true;
    }

    if (!isValidEvent) {
      this.logger.info(`Ignoring issue action: ${action}`);
      res.status(200).json({ message: 'Event ignored' });
      return;
    }

    // Check if the AI helper is mentioned (ensure proper word boundaries)
    const aiHelperRegex = /(?:^|[^\w])@ai-helper\b/i;
    const aiHelperMentioned = aiHelperRegex.test(textToCheck);

    if (!aiHelperMentioned) {
      this.logger.info(`AI helper not mentioned in issue #${issue.number}`);
      res.status(200).json({ message: 'AI helper not mentioned' });
      return;
    }

    this.logger.info(
      `AI helper mentioned in issue #${issue.number}, starting code generation process`,
    );

    try {
      // Create a unique temporary working directory for this issue
      const tempWorkDir = resolve(
        tmpdir(),
        'ai-github-helper',
        `issue-${issue.number}-${Date.now()}`,
      );

      // Ensure temp directory exists
      if (!existsSync(tempWorkDir)) {
        mkdirSync(tempWorkDir, { recursive: true });
      }

      this.logger.info(`Created temporary working directory: ${tempWorkDir}`);

      // Clone the repository using GitHub CLI (already authenticated)
      const repoPath = resolve(tempWorkDir, repository.name);

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

      // Create a comprehensive prompt for issue analysis and code generation
      const processedPrompt = this.createIssueAnalysisPrompt(issue, repository, comment);

      const workingDir = repoPath;

      this.logger.info(`Starting AI analysis for issue #${issue.number}`);
      this.logger.info(`Working directory: ${workingDir}`);

      this.logger.info(`Starting AI issue analysis in background...`);

      // Get AI provider based on configuration
      const aiProvider = await AIProviderFactory.create(
        this.config.ai.preferredProvider,
        this.config.ai.fallbackEnabled,
      );
      this.logger.info(`Using AI provider: ${aiProvider.name}`);

      // Start AI process with proper process management
      const child = await aiProvider.execute(processedPrompt, workingDir);

      // Set up proper cleanup handlers
      let isCleanedUp = false;
      const cleanup = () => {
        if (isCleanedUp) return; // Prevent multiple cleanup calls
        isCleanedUp = true;

        try {
          if (!child.killed) {
            child.kill('SIGTERM');
          }
        } catch (e) {
          this.logger.warn(`Failed to kill Claude process: ${e}`);
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

      this.logger.info(`AI issue analysis started for issue #${issue.number}`);

      res.status(200).json({
        message: 'Issue analysis and code generation started',
        issueNumber: issue.number,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error handling issue event: ${errorMessage}`);
      res.status(500).json({
        error: 'Internal server error',
        message: errorMessage,
      });
    }
  }

  private createIssueAnalysisPrompt(
    issue: GitHubIssue,
    repository: GitHubRepository,
    comment?: GitHubComment,
    repoPath?: string,
  ): string {
    try {
      // Load prompt template from file
      const promptTemplatePath = resolve(__dirname, '../../ai-scripts/issue-handler/prompts.md');
      let promptTemplate = readFileSync(promptTemplatePath, 'utf8');

      // Replace template variables
      promptTemplate = promptTemplate
        .replace(/{{repoName}}/g, repository.full_name)
        .replace(/{{issueNumber}}/g, issue.number.toString())
        .replace(/{{issueTitle}}/g, issue.title)
        .replace(/{{issueAuthor}}/g, issue.user.login)
        .replace(/{{issueState}}/g, issue.state)
        .replace(/{{issueUrl}}/g, issue.html_url)
        .replace(/{{issueDescription}}/g, issue.body || 'No description provided');

      // Handle comment section
      if (comment) {
        promptTemplate = promptTemplate
          .replace(/{{#comment}}/g, '')
          .replace(/{{\/comment}}/g, '')
          .replace(/{{commentAuthor}}/g, comment.user.login)
          .replace(/{{commentBody}}/g, comment.body);
      } else {
        // Remove comment section if no comment
        promptTemplate = promptTemplate.replace(/{{#comment}}[\s\S]*?{{\/comment}}/g, '');
      }

      return promptTemplate;
    } catch (error) {
      this.logger.error(`Failed to load prompt template: ${error}`);
      // Fallback to simple prompt if template loading fails
      return `# AI Helper - Issue Analysis and Code Generation

Analyze and implement solution for issue #${issue.number}: ${issue.title}

Repository: ${repository.full_name}
Issue: ${issue.body || 'No description provided'}
${comment ? `\nComment: ${comment.body}` : ''}

Create a feature branch, implement the solution, and create a pull request.`;
    }
  }
}

export function createIssueHandler(payload: GitHubIssuePayload) {
  console.log('Processing issue event...');

  const action = payload.action;
  const issue = payload.issue;
  const repository = payload.repository;

  console.log(`Issue ${action}:`);
  console.log(`- Repository: ${repository.full_name}`);
  console.log(`- Issue #${issue.number}: ${issue.title}`);
  console.log(`- Author: ${issue.user.login}`);
  console.log(`- State: ${issue.state}`);
}
