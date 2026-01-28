#!/bin/bash
#
# Initialize Ariadne for first-time use
#
# Run this once after cloning the repository.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
EXAMPLE_DIR="$SCRIPT_DIR/data.example"

echo "=== Ariadne Initialization ==="
echo ""

if [[ -d "$DATA_DIR" ]]; then
    echo "data/ directory already exists."
    echo "To start fresh: rm -rf data/ && ./init.sh"
    exit 1
fi

if [[ ! -d "$EXAMPLE_DIR" ]]; then
    echo "ERROR: data.example/ not found."
    exit 1
fi

echo "Creating data/ from templates..."
cp -r "$EXAMPLE_DIR" "$DATA_DIR"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Edit data/profile.md with your name and background"
echo "2. Edit data/resume-content.md with your resume"
echo "3. Edit data/work-stories.md with your interview stories"
echo "4. Edit data/search-criteria.md with your search preferences"
echo ""
echo "Your data/ directory is git-ignored."
echo ""
