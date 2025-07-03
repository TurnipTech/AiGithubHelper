# GitHub Helper Automation System - Implementation Plan

## Project Overview

This repository contains a webhook-based automation system for GitHub that can perform various helper actions like code reviewing PRs, completing work based on issues, and other automated GitHub workflows. The system uses a hybrid approach combining GitHub API for secure webhooks and **AI CLI tools** (like Claude Code, Gemini CLI) for performing the actual automation tasks through detailed prompt-based scripts.

## Core Requirements

- **Simple Setup**: One command to get everything running after checkout
- **Webhook-Driven**: Responds to GitHub events via webhooks
- **Extensible**: Easy to add new automation scripts
- **Secure**: Proper GitHub authentication and webhook validation
- **Scalable**: Handle multiple repositories and concurrent requests

## Architecture Overview

### Hybrid GitHub Integration Strategy

**GitHub API** - Used for:
- Webhook signature verification (security)
- Real-time event processing
- Basic operations (comments, labels, status updates)

**AI CLI Tools** - Used for:
- Executing detailed prompts for automation tasks
- Code review analysis using Claude Code or Gemini CLI
- Issue completion and PR creation through AI-powered workflows
- Complex reasoning and decision-making for GitHub operations

### High-Level Components

1. **Webhook Server** - Receives and processes GitHub events (API-based)
2. **AI Prompt Scripts** - Detailed prompts for AI CLI tools to execute
3. **GitHub Integration** - Hybrid API + AI CLI approach
4. **Configuration Management** - Environment-based settings
5. **Setup Automation** - One-command deployment and configuration

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Web Framework**: Express.js or Fastify
- **GitHub Integration**: 
  - Webhooks: `@octokit/webhooks` (for signature verification)
  - Operations: AI CLI tools (Claude Code, Gemini) + `@octokit/rest` (minimal API usage)
- **Process Management**: PM2 for production
- **Containerization**: Docker for consistent deployment

## Project Structure

```
/
├── src/
│   ├── webhook/
│   │   ├── server.ts          # Main webhook server
│   │   ├── handlers/          # Event-specific handlers
│   │   │   ├── pull-request.ts
│   │   │   ├── issues.ts
│   │   │   └── push.ts
│   │   └── middleware/        # Authentication, validation
│   │       ├── auth.ts
│   │       └── validate.ts
│   ├── ai-scripts/            # AI CLI prompt scripts
│   │   ├── code-reviewer/
│   │   │   ├── index.ts       # Script orchestrator
│   │   │   └── prompts.md     # Detailed AI prompts
│   │   ├── issue-completer/
│   │   │   ├── index.ts       # Script orchestrator
│   │   │   └── prompts.md     # Detailed AI prompts
│   │   └── script-interface.ts # Common interface for all scripts
│   ├── ai-cli/
│   │   ├── claude.ts          # Claude Code CLI wrapper
│   │   ├── gemini.ts          # Gemini CLI wrapper
│   │   ├── executor.ts        # AI CLI execution engine
│   │   └── types.ts           # AI CLI types
│   ├── github/
│   │   ├── api.ts             # Minimal GitHub API client
│   │   ├── auth.ts            # Authentication handling
│   │   └── types.ts           # GitHub-specific types
│   ├── config/
│   │   ├── index.ts           # Configuration management
│   │   └── env.ts             # Environment variable handling
│   ├── utils/
│   │   ├── logger.ts          # Logging utilities
│   │   ├── errors.ts          # Error handling
│   │   └── validation.ts      # Input validation
│   └── types/
│       └── index.ts           # Global type definitions
├── setup/
│   ├── install.sh             # Main setup script
│   ├── github-setup.md        # GitHub authentication guide
│   └── docker-setup.sh        # Docker deployment setup
├── config/
│   ├── .env.example           # Environment variable template
│   └── ecosystem.config.js    # PM2 configuration
├── docker-compose.yml         # Local development environment
├── Dockerfile                 # Production container
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

## Detailed Implementation Plan

### 1. Webhook Server Architecture

#### Core Server (`src/webhook/server.ts`)
- Express/Fastify server with webhook endpoints
- GitHub webhook signature verification using `@octokit/webhooks`
- Event routing based on GitHub event types
- Middleware for authentication and validation
- Error handling and logging

#### Event Handlers (`src/webhook/handlers/`)
- Separate handlers for different GitHub events
- Pull Request events: opened, synchronize, review_requested
- Issues events: opened, assigned, labeled
- Push events: commits to specific branches
- Each handler routes to appropriate scripts

#### Middleware (`src/webhook/middleware/`)
- **Authentication**: Verify GitHub webhook signatures (API-based)
- **Validation**: Validate payload structure and content
- **Rate Limiting**: Prevent abuse
- **Logging**: Request/response logging with correlation IDs

### 2. AI CLI Integration

#### AI CLI Execution Engine (`src/ai-cli/executor.ts`)
```typescript
class AICLIExecutor {
  async executeClaude(prompt: string, context: AIContext): Promise<AIResult> {
    // Execute Claude Code CLI with detailed prompts
    const fullPrompt = this.buildPrompt(prompt, context);
    return await this.exec(`claude-code "${fullPrompt}"`);
  }
  
  async executeGemini(prompt: string, context: AIContext): Promise<AIResult> {
    // Execute Gemini CLI with detailed prompts
    const fullPrompt = this.buildPrompt(prompt, context);
    return await this.exec(`gemini "${fullPrompt}"`);
  }
  
  private buildPrompt(basePrompt: string, context: AIContext): string {
    // Build comprehensive prompt with context about the GitHub event,
    // repository state, and specific instructions for the AI
    return `${basePrompt}\n\nContext: ${JSON.stringify(context)}`;
  }
  
  private async exec(command: string): Promise<AIResult> {
    // Execute AI CLI commands with proper error handling and output parsing
  }
}
```

#### AI Script Structure (`src/ai-scripts/*/prompts.md`)
Each AI script contains detailed markdown prompts that provide:
- Context about the GitHub event and repository
- Specific instructions for the AI to follow
- Expected output format and actions to take
- Error handling and edge case instructions

#### Minimal GitHub API Client (`src/github/api.ts`)
```typescript
class GitHubAPI {
  // Only used for webhook verification and simple operations
  constructor(private webhookSecret: string) {}
  
  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Verify webhook signatures for security
  }
  
  async updateCommitStatus(sha: string, state: string, description: string): Promise<void> {
    // Simple API operations where CLI is overkill
  }
}
```

### 3. AI Script System Architecture

#### AI Script Interface (`src/ai-scripts/script-interface.ts`)
```typescript
interface AIAutomationScript {
  name: string;
  description: string;
  triggers: GitHubEventTrigger[];
  preferredAI: 'claude' | 'gemini' | 'auto';
  execute(context: AIScriptContext): Promise<AIScriptResult>;
  validate?(payload: any): boolean;
}

interface AIScriptContext {
  aiExecutor: AICLIExecutor;  // AI CLI execution engine
  api: GitHubAPI;            // Minimal API operations
  payload: any;              // Webhook payload
  logger: Logger;
  config: Config;
  workingDir: string;        // Temporary working directory for AI operations
}
```

#### Example AI Scripts

**Code Reviewer Script** (`src/ai-scripts/code-reviewer/`)
- `prompts.md`: Detailed instructions for AI to review code changes
- `index.ts`: Orchestrates cloning repo and executing AI review
- Uses AI CLI to analyze code and generate review comments
- Triggers: PR opened, synchronize, review_requested

**Issue Completer Script** (`src/ai-scripts/issue-completer/`)
- `prompts.md`: Detailed instructions for AI to implement solutions
- `index.ts`: Orchestrates repo setup and AI-driven development
- Uses AI CLI to analyze issues and implement fixes
- Triggers: Issue mentioned in comments (@bot complete this)

### 4. Configuration Management

#### Simplified Configuration (`src/config/`)
```typescript
interface Config {
  server: {
    port: number;
    host: string;
    webhookPath: string;
  };
  github: {
    webhookSecret: string;  // Only webhook secret needed
    // GitHub CLI handles authentication via gh auth login
  };
  ai: {
    preferredProvider: 'claude' | 'gemini' | 'auto';
    claudeApiKey?: string;  // Optional if using Claude Code CLI
    geminiApiKey?: string;  // Optional if using Gemini CLI
    workingDir: string;     // Temporary directory for AI operations
  };
  scripts: {
    [scriptName: string]: any;
  };
  logging: {
    level: string;
    format: string;
  };
}
```

### 5. Simplified Setup and Deployment

#### One-Command Setup (`setup/install.sh`)
```bash
#!/bin/bash
echo "Setting up GitHub Helper Automation..."

# 1. Check prerequisites
if ! command -v gh &> /dev/null; then
    echo "Installing GitHub CLI..."
    # Install GitHub CLI based on OS
fi

if ! command -v claude-code &> /dev/null; then
    echo "Installing Claude Code CLI..."
    # Install Claude Code CLI
fi

# 2. Install dependencies
echo "Installing dependencies..."
npm install

# 3. GitHub authentication
echo "Authenticating with GitHub..."
gh auth login

# 4. AI CLI authentication
echo "Authenticating with AI CLI tools..."
claude-code auth

# 5. Setup webhook secret
echo "Setting up webhook configuration..."
cp config/.env.example .env
echo "Please set your GITHUB_WEBHOOK_SECRET in .env"

# 6. Start development server
echo "Starting development server..."
npm run dev
```

#### Development Environment
- Docker Compose with GitHub CLI and AI CLI tools pre-installed
- Hot reload for development
- Local webhook testing with ngrok integration
- No database needed (stateless design)
- Isolated working directories for AI operations

### 6. Security Considerations

#### Webhook Security
- **Signature Verification**: All webhooks verified using GitHub's signature
- **Rate Limiting**: Prevent abuse and handle concurrent requests
- **Input Validation**: Sanitize all webhook payloads
- **Secret Management**: Secure environment variable handling

#### AI CLI Security
- **Authenticated Context**: All AI CLI operations use authenticated user
- **Isolated Execution**: Each AI operation runs in isolated working directory
- **Prompt Validation**: Sanitize and validate all prompts sent to AI
- **Output Filtering**: Filter AI responses for sensitive information

#### AI Script Execution Security
- **Sandboxed Execution**: AI scripts run in isolated context
- **Timeout Controls**: Prevent long-running AI operations
- **Resource Limits**: Memory and CPU constraints for AI processes
- **Input Sanitization**: Validate all script inputs and webhook payloads
- **Working Directory Cleanup**: Automatically clean up temporary files

## Development Workflow

### Phase 1: Foundation (Week 1)
1. Project structure setup
2. Basic webhook server with signature verification
3. AI CLI wrapper implementation (Claude Code, Gemini)
4. Configuration management
5. Basic logging and error handling

### Phase 2: Core Features (Week 2)
1. AI script interface and registry
2. First AI automation script (code reviewer using detailed prompts)
3. Webhook event routing
4. Setup automation script

### Phase 3: Enhancement (Week 3)
1. Additional AI scripts (issue completer)
2. Advanced AI prompt engineering
3. Error handling and retry logic
4. Production deployment setup

### Phase 4: Polish (Week 4)
1. Comprehensive testing
2. Documentation and prompt examples
3. Performance optimization
4. Security hardening

## Benefits of AI CLI Approach

### Security Benefits
- **Webhook Verification**: Cryptographic proof requests came from GitHub
- **No API Token Management**: AI CLI tools handle authentication
- **Granular Permissions**: Inherit user's permissions for both GitHub and AI services

### Simplicity Benefits
- **No GitHub App Creation**: Just authenticate with existing accounts
- **Familiar AI Tools**: Use well-known AI CLI tools like Claude Code
- **Reduced Complexity**: Less API client code to maintain

### Intelligence Benefits
- **Real-time Events**: Immediate webhook processing
- **AI-Powered Operations**: Intelligent code review, issue analysis, and implementation
- **Flexible Reasoning**: AI can handle complex scenarios and edge cases
- **Natural Language Instructions**: Prompts written in natural language

## Setup Requirements

### Prerequisites
1. **GitHub CLI** - `gh` command available
2. **AI CLI Tools** - `claude-code` or `gemini` command available
3. **GitHub Authentication** - `gh auth login` completed
4. **AI Authentication** - `claude-code auth` or equivalent completed
5. **Node.js** - Version 18+ recommended
6. **Webhook Secret** - Generated secret for webhook verification

### Simple Setup Process
1. Clone repository
2. Run `npm run setup`
3. Configure webhook secret in `.env`
4. Add webhook URL to GitHub repository settings
5. Start server with `npm start`

## Example Usage

### Adding a Webhook
```bash
# Repository settings -> Webhooks -> Add webhook
# Payload URL: https://your-domain.com/webhook
# Content type: application/json
# Secret: [your-webhook-secret]
# Events: Pull requests, Issues, Push
```

### Creating a New AI Script
```typescript
// src/ai-scripts/my-script/index.ts
export const myAIScript: AIAutomationScript = {
  name: 'My Custom AI Script',
  description: 'Uses AI to do something awesome',
  triggers: [{ event: 'pull_request', action: 'opened' }],
  preferredAI: 'claude',
  
  async execute(context) {
    const { aiExecutor, payload, logger } = context;
    
    // Load detailed prompt from prompts.md
    const prompt = await loadPrompt('my-script/prompts.md');
    
    // Execute AI with context
    const result = await aiExecutor.executeClaude(prompt, {
      prNumber: payload.number,
      repoName: payload.repository.name,
      // ... other context
    });
    
    return { success: true, aiOutput: result };
  }
};
```

```markdown
<!-- src/ai-scripts/my-script/prompts.md -->
# My Custom AI Script Prompt

You are an AI assistant helping with GitHub automation. 

## Context
- PR Number: {{prNumber}}
- Repository: {{repoName}}
- Action: {{action}}

## Instructions
1. Clone the repository
2. Analyze the pull request changes
3. Provide feedback or take actions as needed
4. Use GitHub CLI commands as needed

## Expected Output
Return a JSON object with your analysis and any actions taken.
```

This AI CLI approach gives you the security and real-time capabilities of GitHub webhooks with the intelligence and flexibility of AI tools like Claude Code. Setup is much simpler while providing powerful AI-driven automation capabilities.