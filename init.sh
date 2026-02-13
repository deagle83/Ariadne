#!/bin/bash
#
# Initialize Ariadne for first-time use (non-interactive fallback)
#
# PREFERRED: Start Claude Code in this directory and say hello.
# Ariadne will detect first run and walk you through interactive setup
# with resume analysis, pre-filled suggestions, and dependency checks.
#
# This script is a quick alternative that copies templates without
# the interactive onboarding experience.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
EXAMPLE_DIR="$SCRIPT_DIR/data.example"

echo "=== Ariadne Initialization ==="
echo ""

# --- Dependency Check ---
echo "Checking dependencies..."
echo ""

check_dep() {
    local cmd="$1"
    local purpose="$2"
    local install="$3"
    if command -v "$cmd" &>/dev/null; then
        local version
        version=$("$cmd" --version 2>/dev/null | head -1 || echo "found")
        echo "  [x] $cmd ($version)"
    else
        echo "  [ ] $cmd — $purpose ($install)"
    fi
}

check_dep "node"      "Dashboard build"          "https://nodejs.org"
check_dep "npm"       "Package install"          "comes with node"
check_dep "pandoc"    "Resume PDF generation"    "brew install pandoc"
check_dep "weasyprint" "Resume PDF generation"   "brew install weasyprint"
check_dep "wrangler"  "Dashboard deploy"         "npm install -g wrangler"
check_dep "gemini"    "Job search fallback"      "npm install -g @google/gemini-cli"

echo ""

# --- Data Directory ---
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

# Install npm dependencies if node is available
if command -v npm &>/dev/null && [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
    echo "Installing npm dependencies..."
    (cd "$SCRIPT_DIR" && npm install)
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Edit data/profile.md with your name and background"
echo "2. Edit data/resume-content.md with your resume"
echo "3. Edit data/work-stories.md with your interview stories"
echo "4. Edit data/search-criteria.md with your search preferences"
echo "5. Edit data/config.json with your JobBot API credentials (or set searchBackend to \"gemini\")"
echo ""
echo "Your data/ directory is git-ignored."
echo ""
echo "TIP: For a guided setup experience, start Claude Code and say hello."
echo ""
