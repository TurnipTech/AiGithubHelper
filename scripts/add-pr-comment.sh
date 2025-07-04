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