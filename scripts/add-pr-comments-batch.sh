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

# Create temporary files for optimized processing with error handling and race condition prevention
TEMP_COMMENTS_FILE=$(mktemp -t "pr-comments-XXXXXX") || { echo "Error: Failed to create temporary file for comments"; exit 1; }
TEMP_VALIDATED_FILE=$(mktemp -t "pr-validated-XXXXXX") || { echo "Error: Failed to create temporary file for validation"; exit 1; }
trap "rm -f '$TEMP_COMMENTS_FILE' '$TEMP_VALIDATED_FILE'" EXIT

# First pass: validate and collect all comments
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines
    if [ -z "$line" ]; then
        continue
    fi
    
    # Split line on first two colons to handle file paths with colons
    file_path=$(echo "$line" | cut -d: -f1)
    line_number=$(echo "$line" | cut -d: -f2)
    comment_body=$(echo "$line" | cut -d: -f3-)
    
    # Skip if any part is empty
    if [ -z "$file_path" ] || [ -z "$line_number" ] || [ -z "$comment_body" ]; then
        continue
    fi
    
    # Validate line number is a positive integer
    if [[ ! "$line_number" =~ ^[0-9]+$ ]]; then
        echo "Warning: Skipping invalid line number '$line_number' for file '$file_path'"
        continue
    fi
    
    # Store validated comment data (using tab as delimiter to avoid issues with colons in content)
    printf '%s\t%s\t%s\n' "$file_path" "$line_number" "$comment_body" >> "$TEMP_VALIDATED_FILE"
done < "$COMMENTS_FILE"

# Second pass: build JSON array efficiently using jq with all comments at once
if [ -s "$TEMP_VALIDATED_FILE" ]; then
    # Process all comments in a single jq call for better performance
    jq -R -n '[
        inputs | 
        split("\t") | 
        {
            path: .[0], 
            line: (.[1] | tonumber), 
            body: .[2]
        }
    ]' "$TEMP_VALIDATED_FILE" > "$TEMP_COMMENTS_FILE"
else
    echo "[]" > "$TEMP_COMMENTS_FILE"
fi

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