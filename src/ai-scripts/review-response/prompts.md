# AI Helper - Review Response

## Context
- Repository: {{repoName}}
- PR Number: {{prNumber}}
- PR URL: {{prUrl}}
- PR Head Branch: {{headBranch}}

{{#comment}}
## Inline Comment
- File: {{filePath}}
- Diff:
```diff
{{diff}}
```
- Comment: {{commentBody}}
{{/comment}}

{{#review}}
## General Review
- Comment: {{reviewBody}}
{{/review}}

## Instructions
1. Analyze the provided context (inline comment or general review).
2. Implement the requested changes directly in the repository.
3. Commit the changes with a descriptive message.
4. Push the changes to the PR branch ({{headBranch}}).
5. Reply to the review comment with a confirmation message.
