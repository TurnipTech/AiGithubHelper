#!/bin/bash

# AI code review script supporting multiple providers
# Usage: ./run-ai-review.sh <prompt_file> <working_dir> [provider]

PROMPT_FILE="$1"
WORKING_DIR="$2"
PROVIDER="${3:-claude}"  # Default to claude if not specified

if [ -z "$PROMPT_FILE" ] || [ -z "$WORKING_DIR" ]; then
    echo "Usage: $0 <prompt_file> <working_dir> [provider]"
    echo "Supported providers: claude, gemini"
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

# Read the prompt from file and execute AI CLI
echo "Starting AI code review with provider: $PROVIDER"
echo "Working directory: $(pwd)"
echo "Prompt file: $PROMPT_FILE"
echo "Prompt content preview:"
echo "--- START PROMPT ---"
head -n 10 "$PROMPT_FILE"
echo "--- END PROMPT PREVIEW ---"

echo "Executing AI CLI..."

# Execute appropriate AI CLI based on provider
case $PROVIDER in
  "claude")
    echo "Using Claude CLI..."
    claude --print --dangerously-skip-permissions "$(cat "$PROMPT_FILE")"
    ;;
  "gemini")
    echo "Using Gemini CLI..."
    gemini "$(cat "$PROMPT_FILE")"
    ;;
  *)
    echo "Error: Unsupported provider: $PROVIDER"
    echo "Supported providers: claude, gemini"
    exit 1
    ;;
esac

echo "AI CLI execution finished."
echo "AI review completed with provider: $PROVIDER"