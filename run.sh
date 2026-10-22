#!/bin/bash
# Multi-Agent Parallel CLI Hub Quick Launcher

cd "$(dirname "$0")"

# Find suitable python
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    if command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        echo "Error: Python environment not found. Please install Python 3 first."
        exit 1
    fi
fi

# Verify Tornado
if ! $PYTHON_CMD -c "import tornado" 2>/dev/null; then
    echo "Installing required dependency: tornado..."
    $PYTHON_CMD -m pip install tornado
fi

echo "Starting Multi-Agent Parallel CLI Hub (ahub)..."
exec $PYTHON_CMD server.py "$@"
