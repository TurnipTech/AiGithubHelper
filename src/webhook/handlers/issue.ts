import { Request, Response } from 'express';
import { Logger } from '../../utils/logger';
import { Config } from '../../config';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export class IssueHandler {
  constructor(
    private logger: Logger,
    private config: Config
  ) {}

  async handleIssue(payload: any, req: Request, res: Response): Promise<void> {
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

    // Check if the AI helper is mentioned
    const aiHelperMentioned = textToCheck.includes('@ai-helper') || textToCheck.includes('@ai helper');
    
    if (!aiHelperMentioned) {
      this.logger.info(`AI helper not mentioned in issue #${issue.number}`);
      res.status(200).json({ message: 'AI helper not mentioned' });
      return;
    }

    this.logger.info(`AI helper mentioned in issue #${issue.number}, starting code generation process`);

    try {
      // Create a comprehensive prompt for issue analysis and code generation
      const promptContent = this.createIssueAnalysisPrompt(issue, repository, comment);
      
      // Create temporary prompt file
      const tempPromptFile = join(process.cwd(), 'temp', `issue-prompt-${issue.number}-${Date.now()}.md`);
      writeFileSync(tempPromptFile, promptContent);

      const workingDir = this.config.ai.workingDir;
      
      this.logger.info(`Starting AI analysis for issue #${issue.number}`);
      this.logger.info(`Working directory: ${workingDir}`);
      this.logger.info(`Temp prompt file: ${tempPromptFile}`);
      
      // Create a simple prompt that references the temp file
      const simplePrompt = `Please read and execute the instructions in the file: ${tempPromptFile}`;
      
      this.logger.info(`Starting Claude issue analysis in background...`);
      
      // Start Claude process without awaiting - fire and forget
      const child = spawn('claude', ['--print', '--dangerously-skip-permissions'], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true
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
          unlinkSync(tempPromptFile);
          this.logger.info(`Cleaned up temp file: ${tempPromptFile}`);
        } catch (e) {
          this.logger.warn(`Failed to clean up temp file: ${tempPromptFile} - ${e}`);
        }
      });
      
      child.on('error', (error) => {
        this.logger.error(`Claude spawn error: ${error.message}`);
        // Clean up temp file on error
        try {
          unlinkSync(tempPromptFile);
          this.logger.info(`Cleaned up temp file after error: ${tempPromptFile}`);
        } catch (e) {
          this.logger.warn(`Failed to clean up temp file after error: ${tempPromptFile} - ${e}`);
        }
      });
      
      // Unref the child process so it doesn't keep the parent alive
      child.unref();

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

  private createIssueAnalysisPrompt(issue: any, repository: any, comment?: any): string {
    return `# AI Helper - Issue Analysis and Code Generation

## Task
You are an AI assistant helping with GitHub issue resolution. You need to:
1. Analyze the issue description thoroughly
2. Create a new feature branch for this issue
3. Implement the requested feature/fix
4. Create a pull request with your changes
5. Add comprehensive commit messages

## Issue Details
- **Repository**: ${repository.full_name}
- **Issue Number**: #${issue.number}
- **Issue Title**: ${issue.title}
- **Issue Author**: ${issue.user.login}
- **Issue State**: ${issue.state}
- **Issue URL**: ${issue.html_url}

## Issue Description
${issue.body || 'No description provided'}

${comment ? `## Additional Context (from comment)
**Comment by**: ${comment.user.login}
**Comment**: ${comment.body}` : ''}

## Instructions
1. **Branch Management**: Create a new branch named \`feature/issue-${issue.number}\` or \`fix/issue-${issue.number}\` depending on the issue type
2. **Code Analysis**: First understand the current codebase structure and identify what needs to be changed
3. **Implementation**: Implement the requested feature or fix following the existing code patterns and conventions
4. **Testing**: Ensure your changes work correctly and don't break existing functionality
5. **Documentation**: Update relevant documentation if needed
6. **Pull Request**: Create a pull request with:
   - Clear title referencing the issue
   - Detailed description of changes made
   - Link to the original issue using "Closes #${issue.number}"

## Quality Requirements
- Follow existing code style and patterns
- Add appropriate error handling
- Include logging where appropriate
- Ensure backward compatibility
- Write clear, self-documenting code

## Commit Message Format
Use conventional commits format:
- \`feat: description\` for new features
- \`fix: description\` for bug fixes
- \`docs: description\` for documentation changes
- \`refactor: description\` for code refactoring

Each commit message should end with:
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## GitHub CLI Commands
Use these commands to create the PR:
\`\`\`bash
gh pr create --title "Implement: ${issue.title}" --body "Closes #${issue.number}

## Summary
[Describe what was implemented]

## Changes Made
[List key changes]

🤖 Generated with [Claude Code](https://claude.ai/code)"
\`\`\`

Start by analyzing the issue and creating the appropriate branch. Then implement the solution step by step.
`;
  }
}

export function createIssueHandler(payload: any) {
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