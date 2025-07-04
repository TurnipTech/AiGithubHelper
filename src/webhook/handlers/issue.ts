import { Request, Response } from 'express';
import { Logger } from '../../utils/logger';
import { Config } from '../../config';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

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
    private config: Config
  ) {}

  async handleIssue(payload: GitHubIssuePayload, req: Request, res: Response): Promise<void> {
    const action = payload.action;
    const issue = payload.issue;
    const repository = payload.repository;
    const comment = payload.comment; // For issue_comment events
    
    this.logger.info(`Processing issue ${action} event for #${issue.number} in ${repository.full_name}`);
    
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

    // Check if the AI helper is mentioned (using word boundaries for exact matches)
    const aiHelperRegex = /\b@ai-helper\b/i;
    const aiHelperMentioned = aiHelperRegex.test(textToCheck);
    
    if (!aiHelperMentioned) {
      this.logger.info(`AI helper not mentioned in issue #${issue.number}`);
      res.status(200).json({ message: 'AI helper not mentioned' });
      return;
    }

    this.logger.info(`AI helper mentioned in issue #${issue.number}, starting code generation process`);

    try {
      // Create a comprehensive prompt for issue analysis and code generation
      const promptContent = this.createIssueAnalysisPrompt(issue, repository, comment);
      
      // Use system temp directory for better security
      const tempDir = resolve(tmpdir(), 'ai-github-helper');
      
      // Ensure temp directory exists
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }
      
      const tempPromptFile = resolve(tempDir, `issue-prompt-${issue.number}-${Date.now()}.md`);
      
      // Validate that the file path is within the temp directory (prevent path traversal)
      if (!tempPromptFile.startsWith(tempDir)) {
        throw new Error('Invalid file path: potential path traversal attack');
      }
      
      // Write file with proper error handling
      try {
        writeFileSync(tempPromptFile, promptContent);
        this.logger.info(`Created temp prompt file: ${tempPromptFile}`);
      } catch (writeError) {
        this.logger.error(`Failed to write temp prompt file: ${writeError}`);
        throw new Error(`Failed to create prompt file: ${writeError}`);
      }

      const workingDir = this.config.ai.workingDir;
      
      this.logger.info(`Starting AI analysis for issue #${issue.number}`);
      this.logger.info(`Working directory: ${workingDir}`);
      this.logger.info(`Temp prompt file: ${tempPromptFile}`);
      
      // Create a simple prompt that references the temp file
      const simplePrompt = `Please read and execute the instructions in the file: ${tempPromptFile}`;
      
      this.logger.info(`Starting Claude issue analysis in background...`);
      
      // Start Claude process with proper process management
      const child = spawn('claude', ['--print'], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false // Don't detach to prevent zombie processes
      });
      
      // Write the simple prompt to stdin
      child.stdin.write(simplePrompt);
      child.stdin.end();
      
      // Set up proper cleanup handlers
      const cleanup = () => {
        try {
          if (!child.killed) {
            child.kill('SIGTERM');
          }
        } catch (e) {
          this.logger.warn(`Failed to kill Claude process: ${e}`);
        }
        
        try {
          unlinkSync(tempPromptFile);
          this.logger.info(`Cleaned up temp file: ${tempPromptFile}`);
        } catch (e) {
          this.logger.warn(`Failed to clean up temp file: ${tempPromptFile} - ${e}`);
        }
      };
      
      // Set up timeout to prevent hanging processes
      const timeout = setTimeout(() => {
        this.logger.warn(`Claude process timeout, killing process`);
        cleanup();
      }, 10 * 60 * 1000); // 10 minutes timeout
      
      // Log output for debugging but don't wait for completion
      child.stdout.on('data', (data) => {
        this.logger.info(`Claude stdout: ${data.toString()}`);
      });
      
      child.stderr.on('data', (data) => {
        this.logger.error(`Claude stderr: ${data.toString()}`);
      });
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        this.logger.info(`Claude process exited with code ${code}`);
        
        // Clean up temp file after Claude finishes
        try {
          unlinkSync(tempPromptFile);
          this.logger.info(`Cleaned up temp file: ${tempPromptFile}`);
        } catch (e) {
          this.logger.warn(`Failed to clean up temp file: ${tempPromptFile} - ${e}`);
        }
      });
      
      child.on('error', (error) => {
        clearTimeout(timeout);
        this.logger.error(`Claude spawn error: ${error.message}`);
        cleanup();
      });
      
      // Handle process exit cleanup
      process.on('exit', cleanup);
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      this.logger.info(`Claude issue analysis started for issue #${issue.number}`);
      
      res.status(200).json({
        message: 'Issue analysis and code generation started',
        issueNumber: issue.number
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error handling issue event: ${errorMessage}`);
      res.status(500).json({
        error: 'Internal server error',
        message: errorMessage
      });
    }
  }

  private createIssueAnalysisPrompt(issue: GitHubIssue, repository: GitHubRepository, comment?: GitHubComment): string {
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