# AI GitHub Helper

A webhook-based automation system that uses AI (Claude Code) to perform automated code reviews on GitHub pull requests.

## Features

- **Automated Code Reviews**: AI analyzes pull requests and provides feedback
- **GitHub CLI Integration**: Uses `gh` commands to interact with GitHub
- **Simple Setup**: Minimal configuration required
- **Webhook Driven**: Responds to GitHub PR events in real-time

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

3. **Claude Code CLI** installed and authenticated
   ```bash
   # Install Claude Code CLI
   # Follow instructions at https://docs.anthropic.com/en/docs/claude-code

   # Authenticate with Claude
   claude-code auth
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
AI_PROVIDER=claude
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
   - **Events**: Select "Pull requests" (and optionally "Pull request reviews")
   - **Active**: ✅ Checked

4. Click **Add webhook**

### 3. Test the Setup

1. Create a test pull request in your repository
2. Check your server logs to see if the webhook was received
3. The AI should automatically review the PR and add comments

## How It Works

1. **GitHub sends webhook** when PR is opened/updated
2. **Server receives webhook** and validates the signature
3. **AI Executor runs** `claude-code` with the code review prompt
4. **Claude Code analyzes** the PR using GitHub CLI commands:
   - `gh pr checkout <number>` - Checks out the PR
   - `gh pr diff <number>` - Reviews the changes
   - `gh pr review <number> --comment` - Adds review comments
5. **AI provides feedback** directly on the GitHub PR

## File Structure

```
src/
├── ai-scripts/
│   └── code-reviewer/
│       ├── index.ts        # Code review orchestrator
│       └── prompts.md      # AI prompt template
├── ai-cli/
│   ├── executor.ts         # AI CLI execution engine
│   └── types.ts           # Type definitions
├── webhook/
│   ├── server.ts          # Main webhook server
│   └── handlers/
│       └── pull-request.ts # PR event handler
├── github/
│   └── api.ts             # GitHub API utilities
├── utils/
│   └── logger.ts          # Logging utilities
└── config/
    └── index.ts           # Configuration management
```

## Configuration Options

Environment variables you can set:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `localhost` |
| `GITHUB_WEBHOOK_SECRET` | GitHub webhook secret | Required |
| `AI_WORKING_DIR` | Directory for AI operations | `/tmp/ai-github-helper` |
| `AI_PROVIDER` | AI provider to use | `claude` |

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
   - Ensure Claude Code CLI is installed and authenticated
   - Check the AI working directory exists and is writable
   - Verify the webhook secret matches between GitHub and your `.env`

### Logs

Check the server logs for detailed error information:

```bash
npm run dev
# Server logs will show webhook events and AI execution details
```

### Testing Locally

You can test the AI executor manually:

```bash
# Test Claude Code CLI directly
claude-code "Review this code and provide feedback"

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.