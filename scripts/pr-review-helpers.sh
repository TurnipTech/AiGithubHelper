#!/bin/bash

# Helper functions for PR reviews
# Source this file to use the functions: source ./pr-review-helpers.sh

# Function to add a single inline comment
add_inline_comment() {
    local repo_name="$1"
    local pr_number="$2"
    local file_path="$3"
    local line_number="$4"
    local comment_body="$5"
    
    if [ $# -ne 5 ]; then
        echo "Usage: add_inline_comment <repo-name> <pr-number> <file-path> <line-number> <comment-body>"
        return 1
    fi
    
    "$(dirname "$0")/add-pr-comment.sh" "$repo_name" "$pr_number" "$file_path" "$line_number" "$comment_body"
}

# Function to add multiple inline comments from a temporary file
add_batch_comments() {
    local repo_name="$1"
    local pr_number="$2"
    local comments_file="$3"
    
    if [ $# -ne 3 ]; then
        echo "Usage: add_batch_comments <repo-name> <pr-number> <comments-file>"
        return 1
    fi
    
    "$(dirname "$0")/add-pr-comments-batch.sh" "$repo_name" "$pr_number" "$comments_file"
}

# Function to create a temporary comments file and add multiple comments
create_and_submit_comments() {
    local repo_name="$1"
    local pr_number="$2"
    shift 2
    
    if [ $# -eq 0 ]; then
        echo "Usage: create_and_submit_comments <repo-name> <pr-number> <comment1> [comment2] ..."
        echo "Comment format: 'file_path:line_number:comment_body'"
        return 1
    fi
    
    local temp_file=$(mktemp)
    
    # Add each comment to the temp file
    for comment in "$@"; do
        echo "$comment" >> "$temp_file"
    done
    
    # Submit the batch
    "$(dirname "$0")/add-pr-comments-batch.sh" "$repo_name" "$pr_number" "$temp_file"
    
    # Clean up
    rm "$temp_file"
}

# Function to assign reviewer
assign_reviewer() {
    local pr_number="$1"
    local reviewer="${2:-@me}"
    
    if [ $# -lt 1 ]; then
        echo "Usage: assign_reviewer <pr-number> [reviewer]"
        echo "Default reviewer is @me"
        return 1
    fi
    
    gh pr edit "$pr_number" --add-reviewer "$reviewer"
    echo "Assigned reviewer: $reviewer"
}

# Function to submit final review decision
submit_review() {
    local pr_number="$1"
    local action="$2"  # approve, request-changes, or comment
    local message="$3"
    
    if [ $# -ne 3 ]; then
        echo "Usage: submit_review <pr-number> <action> <message>"
        echo "Actions: approve, request-changes, comment"
        return 1
    fi
    
    case "$action" in
        "approve")
            gh pr review "$pr_number" --approve --body "$message"
            ;;
        "request-changes")
            gh pr review "$pr_number" --request-changes --body "$message"
            ;;
        "comment")
            gh pr review "$pr_number" --comment --body "$message"
            ;;
        *)
            echo "Invalid action: $action. Use approve, request-changes, or comment"
            return 1
            ;;
    esac
    
    echo "Review submitted with action: $action"
}

# Function to add final completion comment
add_completion_comment() {
    local pr_number="$1"
    
    if [ $# -ne 1 ]; then
        echo "Usage: add_completion_comment <pr-number>"
        return 1
    fi
    
    local completion_message="✅ **Automated Code Review Complete**

This pull request has been automatically reviewed by Claude AI. The review focused on code quality, security, performance, and best practices.

*This is an automated review - please also consider having a human reviewer look at significant changes.*"
    
    gh pr comment "$pr_number" --body "$completion_message"
    echo "Added completion comment"
}

echo "PR Review Helper Functions loaded:"
echo "- add_inline_comment <repo> <pr> <file> <line> <comment>"
echo "- add_batch_comments <repo> <pr> <comments-file>"
echo "- create_and_submit_comments <repo> <pr> <comment1> [comment2] ..."
echo "- assign_reviewer <pr> [reviewer]"
echo "- submit_review <pr> <action> <message>"
echo "- add_completion_comment <pr>"