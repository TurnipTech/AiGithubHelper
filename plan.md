# GitHub Helper Automation System - Implementation Plan

## Project Overview

This repository contains a webhook-based automation system for GitHub that can perform various helper actions like code reviewing PRs, completing work based on issues, and other automated GitHub workflows. The system uses a hybrid approach combining GitHub API for secure webhooks and GitHub CLI for complex operations.

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

**GitHub CLI** - Used for:
- Complex git operations (clone, branch, merge)
- Advanced GitHub features
- Operations requiring authenticated user context
- Leveraging existing GitHub CLI ecosystem

### High-Level Components

1. **Webhook Server** - Receives and processes GitHub events (API-based)
2. **Script Registry** - Manages and executes automation scripts
3. **GitHub Integration** - Hybrid API + CLI approach
4. **Configuration Management** - Environment-based settings
5. **Setup Automation** - One-command deployment and configuration

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Web Framework**: Express.js or Fastify
- **GitHub Integration**: 
  - Webhooks: `@octokit/webhooks` (for signature verification)
  - Operations: GitHub CLI + `@octokit/rest` (minimal API usage)
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
│   ├── scripts/               # Automation scripts (plugins)
│   │   ├── code-reviewer/
│   │   │   ├── index.ts
│   │   │   └── prompts.ts
│   │   ├── issue-completer/
│   │   │   ├── index.ts
│   │   │   └── templates.ts
│   │   └── script-interface.ts # Common interface for all scripts
│   ├── github/
│   │   ├── cli.ts             # GitHub CLI wrapper
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

### 2. Hybrid GitHub Integration

#### GitHub CLI Wrapper (`src/github/cli.ts`)
```typescript
class GitHubCLI {
  async cloneRepo(repoUrl: string, path: string): Promise<void> {
    await this.exec(`gh repo clone ${repoUrl} ${path}`);
  }
  
  async createPR(title: string, body: string, base: string): Promise<string> {
    const result = await this.exec(`gh pr create --title "${title}" --body "${body}" --base ${base}`);
    return result.stdout;
  }
  
  async addComment(prNumber: number, comment: string): Promise<void> {
    await this.exec(`gh pr comment ${prNumber} --body "${comment}"`);
  }
  
  private async exec(command: string): Promise<{stdout: string, stderr: string}> {
    // Execute GitHub CLI commands with proper error handling
  }
}
```

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

### 3. Script System Architecture

#### Script Interface (`src/scripts/script-interface.ts`)
```typescript
interface AutomationScript {
  name: string;
  description: string;
  triggers: GitHubEventTrigger[];
  execute(context: ScriptContext): Promise<ScriptResult>;
  validate?(payload: any): boolean;
}

interface ScriptContext {
  cli: GitHubCLI;        // GitHub CLI operations
  api: GitHubAPI;        // Minimal API operations
  payload: any;          # Webhook payload
  logger: Logger;
  config: Config;
}
```

#### Example Scripts

**Code Reviewer Script** (`src/scripts/code-reviewer/`)
- Uses CLI to clone repo and analyze changes
- Uses API to post review comments
- Triggers: PR opened, synchronize, review_requested

**Issue Completer Script** (`src/scripts/issue-completer/`)
- Uses CLI to create branches and PRs
- Uses API to update issue status
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

# 2. Install dependencies
echo "Installing dependencies..."
npm install

# 3. GitHub authentication
echo "Authenticating with GitHub..."
gh auth login

# 4. Setup webhook secret
echo "Setting up webhook configuration..."
cp config/.env.example .env
echo "Please set your GITHUB_WEBHOOK_SECRET in .env"

# 5. Start development server
echo "Starting development server..."
npm run dev
```

#### Development Environment
- Docker Compose with GitHub CLI pre-installed
- Hot reload for development
- Local webhook testing with ngrok integration
- No database needed (stateless design)

### 6. Security Considerations

#### Webhook Security
- **Signature Verification**: All webhooks verified using GitHub's signature
- **Rate Limiting**: Prevent abuse and handle concurrent requests
- **Input Validation**: Sanitize all webhook payloads
- **Secret Management**: Secure environment variable handling

#### GitHub CLI Security
- **Authenticated Context**: All CLI operations use authenticated user
- **Permission Scoping**: Leverage GitHub's permission system
- **Audit Trail**: GitHub CLI operations are logged by GitHub

#### Script Execution Security
- **Sandboxed Execution**: Scripts run in isolated context
- **Timeout Controls**: Prevent long-running scripts
- **Resource Limits**: Memory and CPU constraints
- **Input Sanitization**: Validate all script inputs

## Development Workflow

### Phase 1: Foundation (Week 1)
1. Project structure setup
2. Basic webhook server with signature verification
3. GitHub CLI wrapper implementation
4. Configuration management
5. Basic logging and error handling

### Phase 2: Core Features (Week 2)
1. Script interface and registry
2. First automation script (code reviewer using CLI)
3. Webhook event routing
4. Setup automation script

### Phase 3: Enhancement (Week 3)
1. Additional scripts (issue completer)
2. Advanced CLI operations
3. Error handling and retry logic
4. Production deployment setup

### Phase 4: Polish (Week 4)
1. Comprehensive testing
2. Documentation and examples
3. Performance optimization
4. Security hardening

## Benefits of Hybrid Approach

### Security Benefits
- **Webhook Verification**: Cryptographic proof requests came from GitHub
- **No API Token Management**: GitHub CLI handles authentication
- **Granular Permissions**: Inherit user's GitHub permissions

### Simplicity Benefits
- **No GitHub App Creation**: Just authenticate with existing GitHub account
- **Familiar Commands**: Use well-known GitHub CLI commands
- **Reduced Complexity**: Less API client code to maintain

### Functionality Benefits
- **Real-time Events**: Immediate webhook processing
- **Rich Operations**: Full GitHub CLI feature set
- **Reliable Authentication**: GitHub CLI handles token refresh

## Setup Requirements

### Prerequisites
1. **GitHub CLI** - `gh` command available
2. **GitHub Authentication** - `gh auth login` completed
3. **Node.js** - Version 18+ recommended
4. **Webhook Secret** - Generated secret for webhook verification

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

### Creating a New Script
```typescript
// src/scripts/my-script/index.ts
export const myScript: AutomationScript = {
  name: 'My Custom Script',
  description: 'Does something awesome',
  triggers: [{ event: 'pull_request', action: 'opened' }],
  
  async execute(context) {
    const { cli, payload, logger } = context;
    
    // Use GitHub CLI for complex operations
    await cli.addComment(payload.number, 'Hello from automation!');
    
    return { success: true };
  }
};
```

This hybrid approach gives you the security and real-time capabilities of GitHub webhooks with the simplicity and power of GitHub CLI for operations. Setup is much simpler while maintaining all the functionality you need.