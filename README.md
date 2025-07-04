# AI GitHub Helper

A Node.js-based automation system that provides intelligent, automated code reviews for GitHub pull requests using AI. The system leverages a hybrid architecture combining webhook-driven event handling with CLI-based GitHub operations for secure, scalable code review automation.

## Features

- **Automated AI Code Reviews**: Intelligent analysis of pull requests with contextual feedback
- **Issue-Based AI Helper**: Mention `@ai-helper` in GitHub issues to automatically generate code and create pull requests
- **Asynchronous Processing**: Fast webhook response with background AI processing
- **GitHub CLI Integration**: Secure authentication using pre-configured `gh` CLI
- **Multi-AI Provider Support**: Works with Claude CLI, Gemini CLI, or auto-detection
- **Flexible AI Prompts**: Customizable review behavior via Markdown templates
- **Provider Fallback**: Automatic fallback between AI providers for reliability
- **Inline Comments**: Detailed feedback with batch comment posting
- **Review Actions**: Automated approve/request-changes/comment decisions
- **Detached Processing**: Non-blocking webhook handling for optimal performance
- **Shell Script Integration**: Reusable bash scripts for GitHub operations

## Prerequisites

Before setting up the AI GitHub Helper, ensure you have:

1. **Node.js** (v18 or higher)
2. **GitHub CLI** installed and authenticated
   ```bash
   # Install GitHub CLI (if not already installed)
   brew install gh  # macOS
   # or follow instructions at https://cli.github.com/

   # Authenticate with GitHub
   gh auth login
   ```

3. **AI Provider CLI** - Choose one or both:

   ### Option 1: Claude Code CLI (Default)
   ```bash
   # Install Claude Code CLI
   # Follow instructions at https://docs.anthropic.com/en/docs/claude-code

   # Authenticate with Claude
   claude auth
   ```

   ### Option 2: Google Gemini CLI
   ```bash
   # Install Gemini CLI
   npm install -g @google-cloud/gemini-cli

   # Authenticate with Google
   gemini auth  # Follow interactive authentication
   ```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and set your configuration:

```env
# Server Configuration
PORT=3000
HOST=localhost

# GitHub Configuration
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here

# AI Configuration
AI_WORKING_DIR=/tmp/ai-github-helper
AI_PROVIDER=claude                # Options: claude, gemini, auto
AI_FALLBACK_ENABLED=false        # Enable automatic fallback between providers
```

### 3. Generate Webhook Secret

Generate a secure webhook secret:

```bash
# Generate a random secret
openssl rand -hex 32
```

Copy this value to your `.env` file as `GITHUB_WEBHOOK_SECRET`.

### 4. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

The server will start on `http://localhost:3000` (or your configured port).

## GitHub Repository Setup

To connect this system to your GitHub repository:

### 1. Expose Your Local Server (Development)

For local development, use a tool like ngrok to expose your local server:

```bash
# Install ngrok (if not already installed)
brew install ngrok  # macOS

# Expose your local server
ngrok http 3000
```

This will give you a public URL like `https://abc123.ngrok.io`.

### 2. Configure GitHub Webhook

1. Go to your GitHub repository
2. Navigate to **Settings** → **Webhooks** → **Add webhook**
3. Configure the webhook:
   - **Payload URL**: `https://your-domain.com/webhook` (or your ngrok URL + `/webhook`)
   - **Content type**: `application/json`
   - **Secret**: The webhook secret you generated earlier
   - **Events**: Select "Pull requests", "Issues", and "Issue comments"
   - **Active**: ✅ Checked

4. Click **Add webhook**

### 3. Test the Setup

1. Create a test pull request in your repository
2. Check your server logs to see if the webhook was received
3. The AI should automatically review the PR and add comments

## How It Works

The system operates as a stateless, asynchronous webhook server with two main workflows:

### Pull Request Review Workflow

1. **Webhook Reception**: GitHub sends a `pull_request` event when a PR is opened/updated
2. **Security Verification**: HMAC signature validation ensures the request is authentic
3. **Prompt Generation**: Dynamic prompt creation by injecting PR context into templates
4. **Detached AI Process**: Background AI execution spawned as a separate process
5. **Fast Response**: Immediate `200 OK` response to GitHub (prevents timeouts)
6. **AI-Driven Review**: The AI follows scripted instructions to:
   - Check out the PR branch using `gh pr checkout`
   - Analyze code changes with `gh pr diff`
   - Post batch inline comments via helper scripts
   - Submit final review decision (approve/request-changes/comment)
7. **Cleanup**: Temporary prompt files are automatically removed

### Issue-Based AI Helper Workflow

1. **Issue Creation/Comment**: User creates an issue or comments on an existing issue mentioning `@ai-helper`
2. **AI Helper Detection**: The system detects the mention and triggers the AI helper workflow
3. **Issue Analysis**: AI analyzes the issue description and requirements
4. **Branch Creation**: AI creates a new feature/fix branch for the issue
5. **Code Implementation**: AI implements the requested feature or fix following project patterns
6. **Pull Request Creation**: AI creates a pull request with comprehensive description
7. **Automatic Linking**: PR is automatically linked to the original issue using "Closes #X"

### Using the Issue-Based AI Helper

To use the issue-based AI helper:

1. **Create an Issue**: Create a GitHub issue describing what you want implemented
2. **Mention the AI Helper**: Include `@ai-helper` anywhere in the issue title, description, or comments
3. **Wait for Processing**: The AI will automatically start analyzing and implementing your request
4. **Review the PR**: The AI will create a pull request with the implementation for your review

**Example Issue:**
```
Title: Add user authentication feature
Description: 
We need to implement user authentication with login/logout functionality.
The feature should include:
- Login form with email/password
- JWT token handling
- Protected routes
- User session management

@ai-helper implement this feature
```

The AI will automatically:
- Create a new branch (`feature/issue-123` or similar)
- Implement the authentication system
- Follow existing code patterns and conventions
- Create a pull request with detailed description
- Link the PR to close the original issue

### Architecture Benefits

- **Non-blocking**: Webhook endpoint remains responsive
- **Secure**: No API tokens stored; relies on pre-authenticated CLI tools
- **Scalable**: Stateless design supports multiple concurrent reviews
- **Extensible**: Bash scripts provide reusable GitHub operation interfaces

## File Structure

```
/
├── src/
│   ├── ai-scripts/             # AI prompt templates and instructions
│   │   └── code-reviewer/
│   │       └── prompts.md      # Dynamic prompt template for code reviews
│   ├── config/                 # Configuration management
│   │   └── index.ts           # Environment variable handling
│   ├── utils/                  # Utility classes and functions
│   │   └── logger.ts          # Structured logging utility
│   └── webhook/
│       ├── handlers/           # Event-specific webhook handlers
│       │   ├── pull-request.ts # Pull request event processing
│       │   ├── issue.ts        # Issue and issue comment event processing
│       │   └── push.ts         # Push event processing
│       ├── middleware/         # Express middleware
│       │   └── auth.ts        # HMAC webhook signature verification
│       └── server.ts          # Main Express.js webhook server
├── scripts/                    # Reusable bash scripts for GitHub operations
│   ├── add-pr-comments-batch.sh   # Batch inline comment posting
│   ├── pr-review-helpers.sh       # Review submission utilities
│   └── run-claude-review.sh       # AI execution wrapper
├── temp/                       # Temporary prompt files (auto-generated)
├── .env.example               # Environment variable template
├── package.json              # Node.js dependencies and scripts
└── tsconfig.json            # TypeScript compiler configuration
```

### Key Components

- **Webhook Server**: Express.js server handling GitHub webhook events (pull requests, issues, comments)
- **Pull Request Handler**: Automated code review system with AI-driven feedback
- **Issue Handler**: AI helper that responds to `@ai-helper` mentions in issues
- **AI Scripts**: Markdown-based prompt templates with dynamic context injection
- **Shell Scripts**: Bash utilities providing GitHub CLI operation interfaces
- **Middleware**: Security and request validation components
- **Configuration**: Environment-based configuration management

## Configuration Options

Environment variables you can set:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `HOST` | Server host | `localhost` | No |
| `GITHUB_WEBHOOK_SECRET` | GitHub webhook secret for HMAC validation | - | Yes |
| `AI_WORKING_DIR` | Directory for AI operations | `/tmp/ai-github-helper` | No |
| `AI_PROVIDER` | AI provider to use (`claude`, `gemini`, `auto`) | `claude` | No |
| `AI_FALLBACK_ENABLED` | Enable automatic fallback between providers | `false` | No |

### AI Provider Configuration

The system supports multiple AI providers with automatic fallback:

#### Provider Options

- **`claude`**: Uses Claude Code CLI (Anthropic) - paid service with high quality
- **`gemini`**: Uses Gemini CLI (Google) - free tier available
- **`auto`**: Automatically selects the first available provider (claude → gemini)

#### Provider Features

| Feature | Claude | Gemini |
|---------|--------|--------|
| **Cost** | Paid service | Free tier: 60 req/min, 1000/day |
| **Installation** | Built-in auth flow | NPM package |
| **Quality** | High-quality responses | Good quality responses |
| **Rate Limits** | Usage-based billing | Free tier limits |

#### Fallback Behavior

When `AI_FALLBACK_ENABLED=true`:
- If primary provider is unavailable, automatically tries the fallback
- Provides redundancy and reduces service interruption
- Logs which provider is actually used for each request

### Security Notes

- **GITHUB_WEBHOOK_SECRET**: Must match the secret configured in your GitHub webhook settings
- **CLI Authentication**: AI provider CLIs must be pre-authenticated
- **No API Tokens**: The system deliberately avoids storing API tokens

## Troubleshooting

### Common Issues

1. **Webhook not received**
   - Check if your server is running and accessible
   - Verify the webhook URL is correct
   - Check GitHub webhook delivery logs

2. **Authentication errors**
   - Make sure `gh auth login` is completed
   - Verify `claude-code auth` is set up
   - Check that the GitHub CLI has access to your repository

3. **AI execution fails**
   - Ensure your chosen AI provider CLI is installed and authenticated
   - For Claude: `claude auth` and verify connection
   - For Gemini: `gemini auth` and verify connection
   - Check the AI working directory exists and is writable
   - Verify the webhook secret matches between GitHub and your `.env`
   - Try `AI_PROVIDER=auto` to test provider availability

### Logs

Check the server logs for detailed error information:

```bash
npm run dev
# Server logs will show webhook events and AI execution details
```

### Testing Locally

You can test the AI executor manually:

```bash
# Test Claude CLI directly
claude "Review this code and provide feedback"

# Test Gemini CLI directly  
gemini "Review this code and provide feedback"

# Test GitHub CLI
gh pr list
gh pr checkout <number>
gh pr diff <number>
```

## Production Deployment

For production deployment:

1. **Use a proper domain** instead of ngrok
2. **Set up SSL/TLS** for webhook security
3. **Use PM2** or similar for process management
4. **Configure proper logging** and monitoring
5. **Set up environment variables** securely
6. **Monitor AI process execution** and cleanup
7. **Configure rate limiting** for webhook endpoints
8. **Set up health checks** for the webhook server

### Performance Considerations

- **Concurrent Reviews**: The detached process model supports multiple simultaneous PR reviews
- **Resource Management**: Monitor disk usage for temporary prompt files
- **AI Rate Limits**: Be aware of your AI provider's rate limits and quotas

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.