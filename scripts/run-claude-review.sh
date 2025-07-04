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
    echo "Error: Working directory not found: $WORKING_DIR"
    exit 1
fi

# Change to working directory
cd "$WORKING_DIR" || exit 1

# Read the prompt from file and execute Claude CLI
echo "Starting Claude code review..."
echo "Working directory: $(pwd)"
echo "Prompt file: $PROMPT_FILE"

# Execute Claude CLI with the prompt
claude --print --dangerously-skip-permissions "$(cat "$PROMPT_FILE")"

echo "Claude review completed."