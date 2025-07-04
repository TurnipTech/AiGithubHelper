# AI Helper - Issue Analysis and Code Generation

You are an AI assistant helping with GitHub issue resolution. Your job is to analyze issues and implement requested features or fixes.

## Context
- Repository: TurnipTech/AiGithubHelper
- Issue Number: #22
- Issue Title: Add linting checks to the project
- Issue Author: TurnipTech
- Issue State: open
- Issue URL: https://github.com/TurnipTech/AiGithubHelper/issues/22

## Issue Description
## Summary
Add comprehensive linting checks to improve code quality and maintain consistent coding standards across the project.

## Requirements
- [ ] Configure ESLint for JavaScript/TypeScript files
- [ ] Add Prettier for code formatting
- [ ] Set up pre-commit hooks to run linting
- [ ] Add linting to CI/CD pipeline
- [ ] Configure lint rules appropriate for the project
- [ ] Add lint scripts to package.json

## Acceptance Criteria
- Linting runs successfully on all existing code
- New code must pass linting checks
- Documentation on how to run linting locally
- Integration with existing development workflow

@ai-helper please implement this linting setup for the project.


## Additional Context (from comment)
**Comment by**: TurnipTech
**Comment**: @ai-helper please implement this issue


## Working Environment
**IMPORTANT**: You are working in a freshly cloned repository in a temporary directory. The repository has been automatically cloned for you and you are currently in the repository's root directory.

- Repository URL: https://github.com/TurnipTech/AiGithubHelper.git
- Working directory: Current directory (the cloned repository)
- All changes will be made in this temporary workspace

## Task
You need to:
1. Analyze the issue description thoroughly
2. Understand the current codebase structure in this cloned repository
3. Create a new feature branch for this issue
4. Implement the requested feature/fix
5. Create a pull request with your changes
6. Add comprehensive commit messages

## Instructions

### 1. Repository Setup
The repository has already been cloned for you. You are currently in the repository's root directory. Start by exploring the codebase structure to understand the project.

### 2. Branch Management
Create a new branch named `feature/issue-22` or `fix/issue-22` depending on the issue type

### 3. Code Analysis
First understand the current codebase structure and identify what needs to be changed

### 4. Implementation
Implement the requested feature or fix following the existing code patterns and conventions

### 5. Testing
Ensure your changes work correctly and don't break existing functionality

### 6. Documentation
Update relevant documentation if needed

### 7. Pull Request
Create a pull request with:
- Clear title referencing the issue
- Detailed description of changes made
- Link to the original issue using "Closes #22"

## Quality Requirements
- Follow existing code style and patterns
- Add appropriate error handling
- Include logging where appropriate
- Ensure backward compatibility
- Write clear, self-documenting code

## Commit Message Format
Use conventional commits format:
- `feat: description` for new features
- `fix: description` for bug fixes
- `docs: description` for documentation changes
- `refactor: description` for code refactoring

Each commit message should end with:
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## GitHub CLI Commands
Use these commands to create the PR:
```bash
gh pr create --title "Implement: Add linting checks to the project" --body "Closes #22

## Summary
[Describe what was implemented]

## Changes Made
[List key changes]

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

Start by analyzing the issue and creating the appropriate branch. Then implement the solution step by step.