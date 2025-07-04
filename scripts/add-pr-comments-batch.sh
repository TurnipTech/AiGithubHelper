#!/bin/bash

# Script to add multiple inline comments to a GitHub PR in a single review
# Usage: ./add-pr-comments-batch.sh <repo-name> <pr-number> <comments-file>
# Comments file format: one comment per line as "file_path:line_number:comment_body"

set -e

if [ $# -ne 3 ]; then
    echo "Usage: $0 <repo-name> <pr-number> <comments-file>"
    echo "Comments file format: one comment per line as 'file_path:line_number:comment_body'"
    echo "Example: $0 myorg/myrepo 123 comments.txt"
    exit 1
fi

REPO_NAME="$1"
PR_NUMBER="$2"
COMMENTS_FILE="$3"

# Input validation
if [[ ! "$REPO_NAME" =~ ^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$ ]]; then
    echo "Error: Invalid repository name format. Expected: owner/repo"
    exit 1
fi

if [[ ! "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
    echo "Error: PR number must be a positive integer"
    exit 1
fi

if [ ! -f "$COMMENTS_FILE" ]; then
    echo "Error: Comments file '$COMMENTS_FILE' not found"
    exit 1
fi

# Start building the JSON payload
echo "Creating batch review with inline comments..."

# Create a temporary file to store comment data for jq
TEMP_COMMENTS_FILE=$(mktemp)
trap "rm -f '$TEMP_COMMENTS_FILE'" EXIT

# Read and validate comments, building a JSON array
echo "[]" > "$TEMP_COMMENTS_FILE"

while IFS=':' read -r file_path line_number comment_body; do
    # Skip empty lines
    if [ -z "$file_path" ] || [ -z "$line_number" ] || [ -z "$comment_body" ]; then
        continue
    fi
    
    # Validate line number is a positive integer
    if [[ ! "$line_number" =~ ^[0-9]+$ ]]; then
        echo "Warning: Skipping invalid line number '$line_number' for file '$file_path'"
        continue
    fi
    
    # Add comment to JSON array using jq for safe construction
    jq --arg path "$file_path" \
       --argjson line "$line_number" \
       --arg body "$comment_body" \
       '. += [{path: $path, line: $line, body: $body}]' \
       "$TEMP_COMMENTS_FILE" > "$TEMP_COMMENTS_FILE.tmp" && mv "$TEMP_COMMENTS_FILE.tmp" "$TEMP_COMMENTS_FILE"
done < "$COMMENTS_FILE"

# Create the full JSON payload using jq
JSON_PAYLOAD=$(jq -n \
  --arg body "Automated code review with inline comments" \
  --arg event "COMMENT" \
  --slurpfile comments "$TEMP_COMMENTS_FILE" \
  '{
    body: $body,
    event: $event,
    comments: $comments[0]
  }')

# Submit the review
echo "$JSON_PAYLOAD" | gh api repos/"$REPO_NAME"/pulls/"$PR_NUMBER"/reviews \
  --method POST \
  --input -

echo "Batch review submitted with inline comments"