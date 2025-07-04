#!/bin/bash

# Script to add inline comments to a GitHub PR
# Usage: ./add-pr-comment.sh <repo-name> <pr-number> <file-path> <line-number> <comment-body>

set -e

if [ $# -ne 5 ]; then
    echo "Usage: $0 <repo-name> <pr-number> <file-path> <line-number> <comment-body>"
    echo "Example: $0 myorg/myrepo 123 'src/app.ts' 45 'Add null check here'"
    exit 1
fi

REPO_NAME="$1"
PR_NUMBER="$2"
FILE_PATH="$3"
LINE_NUMBER="$4"
COMMENT_BODY="$5"

# Input validation
if [[ ! "$REPO_NAME" =~ ^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$ ]]; then
    echo "Error: Invalid repository name format. Expected: owner/repo"
    exit 1
fi

if [[ ! "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
    echo "Error: PR number must be a positive integer"
    exit 1
fi

if [[ ! "$LINE_NUMBER" =~ ^[0-9]+$ ]]; then
    echo "Error: Line number must be a positive integer"
    exit 1
fi

if [[ -z "$FILE_PATH" ]]; then
    echo "Error: File path cannot be empty"
    exit 1
fi

if [[ -z "$COMMENT_BODY" ]]; then
    echo "Error: Comment body cannot be empty"
    exit 1
fi

# Create the JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "body": "Automated code review comment",
  "event": "COMMENT",
  "comments": [
    {
      "path": "$FILE_PATH",
      "line": $LINE_NUMBER,
      "body": "$COMMENT_BODY"
    }
  ]
}
EOF
)

# Submit the comment
echo "$JSON_PAYLOAD" | gh api repos/"$REPO_NAME"/pulls/"$PR_NUMBER"/reviews \
  --method POST \
  --input -

echo "Comment added to $FILE_PATH:$LINE_NUMBER"