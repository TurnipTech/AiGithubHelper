#!/bin/bash

# Simple bash script to run Claude code review
# Usage: ./run-claude-review.sh <prompt_file> <working_dir>

PROMPT_FILE="$1"
WORKING_DIR="$2"

if [ -z "$PROMPT_FILE" ] || [ -z "$WORKING_DIR" ]; then
    echo "Usage: $0 <prompt_file> <working_dir>"
    exit 1
fi

if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: Prompt file not found: $PROMPT_FILE"
    exit 1
fi

if [ ! -d "$WORKING_DIR" ]; then
    echo "Creating working directory: $WORKING_DIR"
    mkdir -p "$WORKING_DIR"
fi

# Change to working directory
echo "Changing to working directory: $WORKING_DIR"
cd "$WORKING_DIR" || exit 1

# Read the prompt from file and execute Claude CLI
echo "Starting Claude code review..."
echo "Working directory: $(pwd)"
echo "Prompt file: $PROMPT_FILE"
echo "Prompt content preview:"
echo "--- START PROMPT ---"
head -n 10 "$PROMPT_FILE"
echo "--- END PROMPT PREVIEW ---"

echo "Executing Claude CLI..."
# Execute Claude CLI with the prompt
claude --print --dangerously-skip-permissions "$(cat "$PROMPT_FILE")"
echo "Claude CLI execution finished."

echo "Claude review completed."