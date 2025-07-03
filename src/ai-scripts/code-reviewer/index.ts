import { AIAutomationScript, AIScriptContext, AIScriptResult } from '../script-interface';
import { readFileSync } from 'fs';
import { join } from 'path';

export const codeReviewerScript: AIAutomationScript = {
  name: 'Code Reviewer',
  description: 'AI-powered code review using GitHub CLI',
  triggers: [
    { event: 'pull_request', action: 'opened' },
    { event: 'pull_request', action: 'synchronize' }
  ],
  preferredAI: 'claude',

  async execute(context: AIScriptContext): Promise<AIScriptResult> {
    const { aiExecutor, payload, logger } = context;
    
    try {
      // Extract PR information from webhook payload
      const prNumber = payload.number;
      const repoName = payload.repository.full_name;
      const prTitle = payload.pull_request.title;
      const prAuthor = payload.pull_request.user.login;
      const baseBranch = payload.pull_request.base.ref;
      const headBranch = payload.pull_request.head.ref;
      
      logger.info(`Starting code review for PR #${prNumber} in ${repoName}`);
      
      // Load the review prompt
      const promptPath = join(__dirname, 'prompts.md');
      const promptTemplate = readFileSync(promptPath, 'utf-8');
      
      // Replace template variables with actual values
      const prompt = promptTemplate
        .replace(/{{repoName}}/g, repoName)
        .replace(/{{prNumber}}/g, prNumber.toString())
        .replace(/{{prTitle}}/g, prTitle)
        .replace(/{{prAuthor}}/g, prAuthor)
        .replace(/{{baseBranch}}/g, baseBranch)
        .replace(/{{headBranch}}/g, headBranch);
      
      logger.info(`Executing AI code review for PR #${prNumber}`);
      
      // Execute the AI review
      const result = await aiExecutor.executeClaude(prompt, {
        prNumber,
        repoName,
        prTitle,
        prAuthor,
        baseBranch,
        headBranch,
        event: 'pull_request_review'
      });
      
      logger.info(`Code review completed for PR #${prNumber}`);
      
      return {
        success: true,
        message: `Code review completed for PR #${prNumber}`,
        data: {
          prNumber,
          repoName,
          aiOutput: result.output,
          executionTime: result.executionTime
        }
      };
      
    } catch (error) {
      logger.error(`Error during code review: ${error.message}`);
      
      return {
        success: false,
        message: `Code review failed: ${error.message}`,
        error: error.message
      };
    }
  },

  validate(payload: any): boolean {
    // Basic validation for PR events
    return (
      payload &&
      payload.pull_request &&
      payload.repository &&
      payload.number &&
      typeof payload.number === 'number'
    );
  }
};