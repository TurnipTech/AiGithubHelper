# GitHub Helper Automation - Basic Setup Tickets

## High Priority (Core Setup)

### Ticket 1: Set up basic project structure with TypeScript configuration
**Priority:** High  
**Status:** Pending

**Description:**
Create the foundational project structure with TypeScript configuration to support the GitHub Helper automation system.

**Acceptance Criteria:**
- [ ] Initialize npm project with package.json
- [ ] Configure TypeScript with tsconfig.json
- [ ] Set up basic folder structure following the plan:
  - `src/webhook/` - webhook server components
  - `src/github/` - GitHub integration layer
  - `src/scripts/` - automation scripts
  - `src/config/` - configuration management
  - `src/utils/` - utilities and helpers
  - `src/types/` - TypeScript type definitions
- [ ] Add basic development dependencies (TypeScript, ts-node, nodemon)
- [ ] Create basic npm scripts for development (dev, build, start)
- [ ] Add .gitignore for Node.js project

---

### Ticket 2: Create minimal webhook server that receives GitHub events
**Priority:** High  
**Status:** Pending

**Description:**
Implement a basic Express server that can receive GitHub webhook events and route them appropriately.

**Acceptance Criteria:**
- [ ] Create Express server in `src/webhook/server.ts`
- [ ] Set up webhook endpoint (`/webhook`) to receive POST requests
- [ ] Parse JSON payloads from GitHub webhooks
- [ ] Log incoming webhook events with basic information
- [ ] Handle different GitHub event types (pull_request, issues, push)
- [ ] Create basic event handlers in `src/webhook/handlers/`
- [ ] Add proper error handling and HTTP response codes
- [ ] Server runs on configurable port (default 3000)

---

### Ticket 3: Implement webhook signature verification for security
**Priority:** High  
**Status:** Pending

**Description:**
Add GitHub webhook signature verification to ensure requests are legitimate and secure.

**Acceptance Criteria:**
- [ ] Install and configure `@octokit/webhooks` package
- [ ] Create signature verification middleware in `src/webhook/middleware/auth.ts`
- [ ] Verify webhook signatures using GitHub's secret
- [ ] Reject requests with invalid signatures (401 Unauthorized)
- [ ] Add configuration for webhook secret via environment variables
- [ ] Create `.env.example` file with required environment variables
- [ ] Add proper error messages for authentication failures
- [ ] Test signature verification with sample payloads

---

### Ticket 4: Create basic GitHub CLI wrapper for repository operations
**Priority:** High  
**Status:** Pending

**Description:**
Build a wrapper around GitHub CLI to perform repository operations programmatically.

**Acceptance Criteria:**
- [ ] Create `GitHubCLI` class in `src/github/cli.ts`
- [ ] Implement basic CLI command execution with error handling
- [ ] Add methods for common operations:
  - `cloneRepo()` - clone repository to local directory
  - `createBranch()` - create new branch
  - `addComment()` - add comment to PR or issue
  - `getRepoInfo()` - get repository information
- [ ] Handle CLI authentication status and errors
- [ ] Add proper TypeScript types for CLI responses
- [ ] Create configuration for temporary directory management
- [ ] Add logging for CLI operations

---

## Medium Priority (First Feature)

### Ticket 5: Build simple code review script that posts comments on PRs
**Priority:** Medium  
**Status:** Pending

**Description:**
Create a basic automation script that analyzes pull requests and posts helpful comments.

**Acceptance Criteria:**
- [ ] Create script interface in `src/scripts/script-interface.ts`
- [ ] Implement code reviewer script in `src/scripts/code-reviewer/`
- [ ] Script triggers on PR opened/updated events
- [ ] Basic code analysis:
  - Count changed files
  - Identify file types
  - Check for common patterns (TODO comments, console.log, etc.)
- [ ] Post summary comment with analysis results
- [ ] Handle errors gracefully without breaking webhook processing
- [ ] Make script configurable (enable/disable features)
- [ ] Add logging for script execution

---

### Ticket 6: Create setup script for easy installation and configuration
**Priority:** Medium  
**Status:** Pending

**Description:**
Build an automated setup script that handles installation and configuration of the GitHub Helper system.

**Acceptance Criteria:**
- [ ] Create `setup/install.sh` script
- [ ] Check for prerequisites (Node.js, GitHub CLI)
- [ ] Install GitHub CLI if not present
- [ ] Run `npm install` to install dependencies
- [ ] Guide user through GitHub authentication (`gh auth login`)
- [ ] Help configure webhook secret in `.env` file
- [ ] Provide instructions for setting up GitHub webhook
- [ ] Test the setup process on clean environment
- [ ] Add error handling for common setup issues
- [ ] Create documentation in README.md for manual setup

---

## Testing Checklist

Once all tickets are complete, verify the system works by:
- [ ] Running the setup script on a clean environment
- [ ] Starting the webhook server
- [ ] Creating a test PR in a repository
- [ ] Confirming the webhook receives the event
- [ ] Verifying the code review script executes and posts a comment
- [ ] Checking logs for proper operation

## Next Steps

After completing these basic tickets, the system will be ready for:
- Additional automation scripts (issue handling, etc.)
- Advanced code review features
- Production deployment configuration
- Enhanced security and error handling