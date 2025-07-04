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

if [ ! -f "$COMMENTS_FILE" ]; then
    echo "Error: Comments file '$COMMENTS_FILE' not found"
    exit 1
fi

# Start building the JSON payload
echo "Creating batch review with inline comments..."

# Build the comments array
COMMENTS_JSON=""
FIRST=true

while IFS=':' read -r file_path line_number comment_body; do
    # Skip empty lines
    if [ -z "$file_path" ] || [ -z "$line_number" ] || [ -z "$comment_body" ]; then
        continue
    fi
    
    # Add comma if not first comment
    if [ "$FIRST" = false ]; then
        COMMENTS_JSON+=","
    fi
    FIRST=false
    
    # Escape quotes in comment body
    escaped_comment=$(echo "$comment_body" | sed 's/"/\\"/g')
    
    # Add comment to JSON
    COMMENTS_JSON+=$(cat <<EOF

    {
      "path": "$file_path",
      "line": $line_number,
      "body": "$escaped_comment"
    }
EOF
    )
done < "$COMMENTS_FILE"

# Create the full JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "body": "Automated code review with inline comments",
  "event": "COMMENT",
  "comments": [$COMMENTS_JSON
  ]
}
EOF
)

# Submit the review
echo "$JSON_PAYLOAD" | gh api repos/"$REPO_NAME"/pulls/"$PR_NUMBER"/reviews \
  --method POST \
  --input -

echo "Batch review submitted with inline comments"