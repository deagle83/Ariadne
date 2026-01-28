#!/bin/bash
#
# MIGRATION SCRIPT: Restructure JobSearch for Ariadne Release
#
# Purpose: Separate PII-containing files from portable code/templates
#          to enable zero-touch public releases.
#
# What this script does:
#   1. Pre-flight validation (disk space, not already migrated, etc.)
#   2. Creates backup of all files to be modified
#   3. Creates data/ directory structure
#   4. Moves PII files into data/
#   5. Updates path references in key files
#   6. Validates JSON integrity
#   7. Creates data.example/ with anonymized samples
#   8. Creates .gitignore and init.sh
#   9. Audits for any remaining absolute paths
#   10. Provides rollback instructions
#
# Usage:
#   chmod +x scripts/migrate-to-data-dir.sh
#   ./scripts/migrate-to-data-dir.sh [--dry-run] [--rollback BACKUP_DIR]
#
# Options:
#   --dry-run              Show what would be done without making changes
#   --rollback BACKUP_DIR  Restore from a previous backup
#
# Author: Claude Code + David Eagle
# Date: 2026-01-27
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$ROOT_DIR/data"
EXAMPLE_DIR="$ROOT_DIR/data.example"
BACKUP_DIR="$ROOT_DIR/.migration-backup-$(date +%Y%m%d-%H%M%S)"
MIN_DISK_SPACE_KB=102400  # 100MB

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=false
ROLLBACK_DIR=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --rollback)
            ROLLBACK_DIR="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--dry-run] [--rollback BACKUP_DIR]"
            exit 1
            ;;
    esac
done

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo ""
    echo -e "${CYAN}${BOLD}=== $1 ===${NC}"
}

run_cmd() {
    if $DRY_RUN; then
        echo -e "  ${YELLOW}[DRY-RUN]${NC} $1"
    else
        eval "$1"
    fi
}

# Rollback function
perform_rollback() {
    local backup="$1"

    if [[ ! -d "$backup" ]]; then
        log_error "Backup directory not found: $backup"
        exit 1
    fi

    log_step "Rolling Back Migration"
    log_info "Restoring from: $backup"

    # Restore modified files
    if [[ -f "$backup/CLAUDE.md" ]]; then
        cp "$backup/CLAUDE.md" "$ROOT_DIR/"
        log_success "Restored CLAUDE.md"
    fi

    if [[ -f "$backup/build.js" ]]; then
        cp "$backup/build.js" "$ROOT_DIR/status-page/"
        log_success "Restored build.js"
    fi

    if [[ -f "$backup/jd-resume-compare.md" ]]; then
        cp "$backup/jd-resume-compare.md" "$ROOT_DIR/.claude/agents/"
        log_success "Restored jd-resume-compare.md"
    fi

    # Move data files back to root
    if [[ -d "$DATA_DIR" ]]; then
        for file in tracker.json network.json tasks.json resume-content.md work-stories.md search-criteria.md; do
            if [[ -f "$DATA_DIR/$file" ]]; then
                mv "$DATA_DIR/$file" "$ROOT_DIR/"
                log_success "Moved $file back to root"
            fi
        done

        # Move search-results back
        if [[ -d "$DATA_DIR/search-results" ]]; then
            mkdir -p "$ROOT_DIR/search-results"
            mv "$DATA_DIR/search-results/"* "$ROOT_DIR/search-results/" 2>/dev/null || true
            log_success "Moved search-results/ back to root"
        fi

        # Move role folders back
        for dir in InProgress Applied Rejected Artifacts; do
            if [[ -d "$DATA_DIR/$dir" ]]; then
                mkdir -p "$ROOT_DIR/$dir"
                mv "$DATA_DIR/$dir/"* "$ROOT_DIR/$dir/" 2>/dev/null || true
                log_success "Moved $dir/ back to root"
            fi
        done

        # Clean up empty data directory
        rm -rf "$DATA_DIR"
        log_success "Removed data/ directory"
    fi

    # Remove generated files
    rm -f "$ROOT_DIR/.gitignore" 2>/dev/null || true
    rm -f "$ROOT_DIR/init.sh" 2>/dev/null || true
    rm -rf "$EXAMPLE_DIR" 2>/dev/null || true

    echo ""
    log_success "Rollback complete!"
    echo ""
    echo "Your repository has been restored to pre-migration state."
    echo "Backup preserved at: $backup"
    exit 0
}

# Handle rollback if requested
if [[ -n "$ROLLBACK_DIR" ]]; then
    perform_rollback "$ROLLBACK_DIR"
fi

# ============================================
# PRE-FLIGHT CHECKS
# ============================================

preflight_checks() {
    log_step "Pre-flight Checks"

    local errors=()
    local warnings=()

    # Check we're in the right directory
    log_info "Checking root directory..."
    local required_files=("CLAUDE.md" "tracker.json" "network.json" "tasks.json")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$ROOT_DIR/$file" ]]; then
            errors+=("Missing required file: $file")
        fi
    done

    # Check disk space
    log_info "Checking disk space..."
    local available
    available=$(df -k "$ROOT_DIR" | tail -1 | awk '{print $4}')
    if [[ $available -lt $MIN_DISK_SPACE_KB ]]; then
        errors+=("Insufficient disk space: need 100MB, have $((available / 1024))MB")
    else
        log_success "Disk space OK: $((available / 1024))MB available"
    fi

    # Check if already migrated
    log_info "Checking migration status..."
    if [[ -d "$DATA_DIR" && -f "$DATA_DIR/tracker.json" ]]; then
        errors+=("data/ directory already contains tracker.json - migration may have already run")
    fi

    # Check if CLAUDE.md already has data/ paths (partial migration)
    if grep -q "data/tracker.json" "$ROOT_DIR/CLAUDE.md" 2>/dev/null; then
        warnings+=("CLAUDE.md already contains 'data/tracker.json' - may be partially migrated")
    fi

    # Check for open file handles (best effort)
    log_info "Checking for file conflicts..."
    if command -v lsof &> /dev/null; then
        local open_files
        open_files=$(lsof +D "$ROOT_DIR" 2>/dev/null | grep -E "tracker\.json|network\.json|tasks\.json" || true)
        if [[ -n "$open_files" ]]; then
            warnings+=("Some data files may be open in other processes")
        fi
    fi

    # Check JSON validity before we start
    log_info "Validating JSON files..."
    for file in tracker.json network.json tasks.json; do
        if [[ -f "$ROOT_DIR/$file" ]]; then
            if ! node -e "JSON.parse(require('fs').readFileSync('$ROOT_DIR/$file'))" 2>/dev/null; then
                errors+=("Invalid JSON: $file (fix before migrating)")
            fi
        fi
    done

    # Report warnings
    if [[ ${#warnings[@]} -gt 0 ]]; then
        echo ""
        for warn in "${warnings[@]}"; do
            log_warn "$warn"
        done
    fi

    # Report errors and exit if any
    if [[ ${#errors[@]} -gt 0 ]]; then
        echo ""
        log_error "Pre-flight checks failed:"
        for err in "${errors[@]}"; do
            echo -e "  ${RED}✗${NC} $err"
        done
        echo ""
        echo "Fix these issues before running migration."
        exit 1
    fi

    log_success "All pre-flight checks passed"
}

# ============================================
# BACKUP
# ============================================

create_backup() {
    log_step "Creating Backup"

    if $DRY_RUN; then
        log_info "Would create backup at: $BACKUP_DIR"
        return
    fi

    mkdir -p "$BACKUP_DIR"

    # Backup files that will be modified
    cp "$ROOT_DIR/CLAUDE.md" "$BACKUP_DIR/"
    cp "$ROOT_DIR/status-page/build.js" "$BACKUP_DIR/"
    cp "$ROOT_DIR/.claude/agents/jd-resume-compare.md" "$BACKUP_DIR/"

    # Backup all JSON files
    cp "$ROOT_DIR/tracker.json" "$BACKUP_DIR/"
    cp "$ROOT_DIR/network.json" "$BACKUP_DIR/"
    cp "$ROOT_DIR/tasks.json" "$BACKUP_DIR/"

    # Create manifest
    cat > "$BACKUP_DIR/MANIFEST.txt" << EOF
Migration Backup
Created: $(date)
Root: $ROOT_DIR

Files backed up:
- CLAUDE.md
- status-page/build.js
- .claude/agents/jd-resume-compare.md
- tracker.json
- network.json
- tasks.json

To rollback:
  $0 --rollback $BACKUP_DIR
EOF

    log_success "Backup created at: $BACKUP_DIR"
}

# ============================================
# CREATE DATA STRUCTURE
# ============================================

create_data_structure() {
    log_step "Creating Data Directory Structure"

    run_cmd "mkdir -p '$DATA_DIR'"
    run_cmd "mkdir -p '$DATA_DIR/search-results'"
    run_cmd "mkdir -p '$DATA_DIR/InProgress'"
    run_cmd "mkdir -p '$DATA_DIR/Applied'"
    run_cmd "mkdir -p '$DATA_DIR/Rejected'"
    run_cmd "mkdir -p '$DATA_DIR/Artifacts'"

    log_success "Created data/ directory structure"
}

# ============================================
# MOVE PII FILES
# ============================================

move_pii_files() {
    log_step "Moving PII Files to data/"

    # Core JSON files
    local json_files=("tracker.json" "network.json" "tasks.json")
    for file in "${json_files[@]}"; do
        if [[ -f "$ROOT_DIR/$file" ]]; then
            run_cmd "mv '$ROOT_DIR/$file' '$DATA_DIR/$file'"
            log_success "Moved $file"
        fi
    done

    # Resume and personal content
    local personal_files=("resume-content.md" "work-stories.md" "search-criteria.md")
    for file in "${personal_files[@]}"; do
        if [[ -f "$ROOT_DIR/$file" ]]; then
            run_cmd "mv '$ROOT_DIR/$file' '$DATA_DIR/$file'"
            log_success "Moved $file"
        fi
    done

    # Search results directory contents
    if [[ -d "$ROOT_DIR/search-results" ]]; then
        if $DRY_RUN; then
            log_info "Would move search-results/ contents"
        else
            mv "$ROOT_DIR/search-results/"* "$DATA_DIR/search-results/" 2>/dev/null || true
            rmdir "$ROOT_DIR/search-results" 2>/dev/null || true
            log_success "Moved search-results/ contents"
        fi
    fi

    # Role folders (InProgress, Applied, Rejected, Artifacts)
    local role_dirs=("InProgress" "Applied" "Rejected" "Artifacts")
    for dir in "${role_dirs[@]}"; do
        if [[ -d "$ROOT_DIR/$dir" ]]; then
            if $DRY_RUN; then
                log_info "Would move $dir/ contents"
            else
                # Check if there's anything to move
                if [[ -n "$(ls -A "$ROOT_DIR/$dir" 2>/dev/null)" ]]; then
                    mv "$ROOT_DIR/$dir/"* "$DATA_DIR/$dir/" 2>/dev/null || true
                fi
                rmdir "$ROOT_DIR/$dir" 2>/dev/null || true
                log_success "Moved $dir/ contents"
            fi
        fi
    done
}

# ============================================
# UPDATE PATH REFERENCES
# ============================================

update_claude_md() {
    log_step "Updating CLAUDE.md Paths"

    if $DRY_RUN; then
        log_info "Would update paths in CLAUDE.md"
        echo "  - Remove /Users/davideagle/Documents/JobSearch/ prefix"
        echo "  - Add data/ prefix to: InProgress/, Applied/, Rejected/, tracker.json, etc."
        return
    fi

    local claude_file="$ROOT_DIR/CLAUDE.md"
    local temp_file="$ROOT_DIR/CLAUDE.md.tmp"

    # Build comprehensive sed script
    sed \
        -e 's|/Users/davideagle/Documents/JobSearch/||g' \
        -e 's|`/InProgress/`|`data/InProgress/`|g' \
        -e 's|`/Applied/`|`data/Applied/`|g' \
        -e 's|`/Rejected/`|`data/Rejected/`|g' \
        -e 's|`/search-results/`|`data/search-results/`|g' \
        -e 's|in `InProgress/`|in `data/InProgress/`|g' \
        -e 's|in InProgress/|in data/InProgress/|g' \
        -e 's|to `InProgress/`|to `data/InProgress/`|g' \
        -e 's|folder in `InProgress/|folder in `data/InProgress/|g' \
        -e 's|Create folder in `InProgress/`|Create folder in `data/InProgress/`|g' \
        -e 's|Folders in InProgress/Applied/Rejected|Folders in data/InProgress/data/Applied/data/Rejected|g' \
        -e 's|"folder": "InProgress/|"folder": "data/InProgress/|g' \
        -e 's|"folder": "Applied/|"folder": "data/Applied/|g' \
        -e 's|"folder": "Rejected/|"folder": "data/Rejected/|g' \
        -e 's|InProgress/Stripe|data/InProgress/Stripe|g' \
        -e 's|InProgress/Acme|data/InProgress/Acme|g' \
        -e 's|Rejected/Databricks|data/Rejected/Databricks|g' \
        -e 's|Applied/|data/Applied/|g' \
        -e 's|`tracker.json`|`data/tracker.json`|g' \
        -e 's|`network.json`|`data/network.json`|g' \
        -e 's|`tasks.json`|`data/tasks.json`|g' \
        -e 's|`resume-content.md`|`data/resume-content.md`|g' \
        -e 's|`work-stories.md`|`data/work-stories.md`|g' \
        -e 's|`search-results/gemini-results.md`|`data/search-results/gemini-results.md`|g' \
        -e 's|search-results/gemini-results.md|data/search-results/gemini-results.md|g' \
        -e 's|from `tracker.json`|from `data/tracker.json`|g' \
        -e 's|Read tracker.json|Read data/tracker.json|g' \
        -e 's|to tracker.json|to data/tracker.json|g' \
        -e 's|in tracker.json|in data/tracker.json|g' \
        -e 's|from tracker.json|from data/tracker.json|g' \
        -e 's| tracker.json | data/tracker.json |g' \
        -e 's|Read `network.json`|Read `data/network.json`|g' \
        -e 's|Read `tasks.json`|Read `data/tasks.json`|g' \
        -e 's|Write network.json|Write data/network.json|g' \
        -e 's|Write tasks.json|Write data/tasks.json|g' \
        -e 's|to network.json|to data/network.json|g' \
        -e 's|to tasks.json|to data/tasks.json|g' \
        -e 's|Move physical folder to `Rejected/`|Move physical folder to `data/Rejected/`|g' \
        -e 's|folder to `Rejected/`|folder to `data/Rejected/`|g' \
        "$claude_file" > "$temp_file"

    mv "$temp_file" "$claude_file"
    log_success "Updated CLAUDE.md"
}

update_build_js() {
    log_step "Updating build.js Paths"

    if $DRY_RUN; then
        log_info "Would update paths in status-page/build.js"
        return
    fi

    local build_file="$ROOT_DIR/status-page/build.js"
    local temp_file="$ROOT_DIR/status-page/build.js.tmp"

    sed \
        -e "s|path.join(ROOT, 'tracker.json')|path.join(ROOT, 'data', 'tracker.json')|g" \
        -e "s|path.join(ROOT, 'network.json')|path.join(ROOT, 'data', 'network.json')|g" \
        -e "s|path.join(ROOT, 'tasks.json')|path.join(ROOT, 'data', 'tasks.json')|g" \
        "$build_file" > "$temp_file"

    mv "$temp_file" "$build_file"
    log_success "Updated build.js"
}

update_agent_config() {
    log_step "Updating Agent Config Paths"

    if $DRY_RUN; then
        log_info "Would update paths in .claude/agents/jd-resume-compare.md"
        return
    fi

    local agent_file="$ROOT_DIR/.claude/agents/jd-resume-compare.md"
    local temp_file="$ROOT_DIR/.claude/agents/jd-resume-compare.md.tmp"

    sed \
        -e 's|/Users/davideagle/Documents/JobSearch/InProgress/|data/InProgress/|g' \
        -e 's|/Users/davideagle/Documents/JobSearch/resume-content.md|data/resume-content.md|g' \
        -e 's|/Users/davideagle/Documents/JobSearch/work-stories.md|data/work-stories.md|g' \
        "$agent_file" > "$temp_file"

    mv "$temp_file" "$agent_file"
    log_success "Updated jd-resume-compare.md"
}

update_tracker_paths() {
    log_step "Updating Paths in tracker.json"

    if $DRY_RUN; then
        log_info "Would update folder paths in tracker.json"
        return
    fi

    local tracker_file="$DATA_DIR/tracker.json"
    local temp_file="$DATA_DIR/tracker.json.tmp"

    sed \
        -e 's|"folder": "InProgress/|"folder": "data/InProgress/|g' \
        -e 's|"folder": "Applied/|"folder": "data/Applied/|g' \
        -e 's|"folder": "Rejected/|"folder": "data/Rejected/|g' \
        "$tracker_file" > "$temp_file"

    mv "$temp_file" "$tracker_file"
    log_success "Updated folder paths in tracker.json"
}

# ============================================
# JSON VALIDATION
# ============================================

validate_json_files() {
    log_step "Validating JSON Integrity"

    if $DRY_RUN; then
        log_info "Would validate JSON files after path updates"
        return
    fi

    local errors=()

    for file in "$DATA_DIR/tracker.json" "$DATA_DIR/network.json" "$DATA_DIR/tasks.json"; do
        local filename
        filename=$(basename "$file")
        if [[ -f "$file" ]]; then
            if node -e "JSON.parse(require('fs').readFileSync('$file'))" 2>/dev/null; then
                log_success "$filename is valid JSON"
            else
                errors+=("$filename")
                log_error "$filename has invalid JSON!"
            fi
        fi
    done

    if [[ ${#errors[@]} -gt 0 ]]; then
        echo ""
        log_error "JSON validation failed for: ${errors[*]}"
        log_error "Restore from backup: $0 --rollback $BACKUP_DIR"
        exit 1
    fi
}

# ============================================
# CREATE EXAMPLE DATA
# ============================================

create_example_data() {
    log_step "Creating data.example/ Templates"

    run_cmd "mkdir -p '$EXAMPLE_DIR'"
    run_cmd "mkdir -p '$EXAMPLE_DIR/search-results'"
    run_cmd "mkdir -p '$EXAMPLE_DIR/InProgress'"
    run_cmd "mkdir -p '$EXAMPLE_DIR/Applied'"
    run_cmd "mkdir -p '$EXAMPLE_DIR/Rejected'"

    if $DRY_RUN; then
        log_info "Would create anonymized sample files"
        return
    fi

    # Create anonymized tracker.json
    cat > "$EXAMPLE_DIR/tracker.json" << 'EOF'
{
  "active": [
    {
      "company": "Example Corp",
      "role": "Director of Platform Engineering",
      "stage": "Phone Screen",
      "next": "Prep behavioral stories",
      "url": "https://example.com/careers/123",
      "added": "2026-01-20",
      "updated": "2026-01-24",
      "folder": "data/InProgress/Example Corp - Director of Platform Engineering"
    },
    {
      "company": "Sample Inc",
      "role": "Senior Engineering Manager",
      "stage": "Sourced",
      "next": "Compare JD and resume",
      "url": "https://sample.com/jobs/456",
      "added": "2026-01-25",
      "updated": "2026-01-25",
      "folder": "data/InProgress/Sample Inc - Senior Engineering Manager"
    }
  ],
  "skipped": [
    {
      "company": "Other Co",
      "role": "Staff Engineer",
      "reason": "IC role, seeking management",
      "url": "https://other.com/jobs/789",
      "added": "2026-01-22"
    }
  ],
  "closed": [
    {
      "company": "Past Company",
      "role": "Engineering Director",
      "outcome": "Rejected",
      "stage": "Onsite",
      "url": "https://past.com/jobs/012",
      "added": "2026-01-05",
      "closed": "2026-01-21",
      "folder": "data/Rejected/Past Company - Engineering Director"
    }
  ]
}
EOF

    # Create anonymized network.json
    cat > "$EXAMPLE_DIR/network.json" << 'EOF'
{
  "contacts": [
    {
      "id": "contact-1",
      "name": "First Contact",
      "company": "Example Corp",
      "title": "Engineering Manager",
      "email": null,
      "linkedin": null,
      "source": "Former coworker",
      "introducedBy": null,
      "added": "2026-01-26",
      "interactions": [
        {
          "date": "2026-01-26",
          "type": "email",
          "summary": "Sent resume for Director role",
          "linkedJobs": ["Example Corp - Director of Platform Engineering"]
        }
      ]
    }
  ]
}
EOF

    # Create anonymized tasks.json
    cat > "$EXAMPLE_DIR/tasks.json" << 'EOF'
{
  "tasks": [
    {
      "id": "task-001",
      "task": "Follow up with First Contact on referral status",
      "due": "2026-01-28",
      "linkedContacts": ["contact-1"],
      "linkedJobs": ["Example Corp - Director of Platform Engineering"],
      "status": "pending",
      "created": "2026-01-26"
    }
  ]
}
EOF

    # Create template resume-content.md
    cat > "$EXAMPLE_DIR/resume-content.md" << 'EOF'
# YOUR NAME

your.email@example.com | 555-123-4567

---

## SUMMARY

Technology executive specializing in [your domain]. Led multi-team organizations delivering [your key outcomes]. Known for [your differentiators].

---

## EXPERIENCE

### Most Recent Company

**Your Title (Start Date - End Date)**

Set the strategic direction for [domain/area].

- Key accomplishment with metrics
- Another accomplishment highlighting scope
- Technical or leadership achievement

---

### Previous Company, Start Year - End Year

**Your Title**

Led teams owning [area of responsibility].

- Accomplishment with scale
- Platform or infrastructure achievement
EOF

    # Create template work-stories.md
    cat > "$EXAMPLE_DIR/work-stories.md" << 'EOF'
# Work Stories

Interview-ready stories indexed by theme/keyword.

## Leadership Stories

### [Story Name]: Team Building
**Context:** Describe the situation
**Action:** What you did
**Result:** Quantified outcome
**Keywords:** team building, hiring, culture

## Technical Stories

### [Story Name]: Platform Migration
**Context:** Describe the situation
**Action:** What you did
**Result:** Quantified outcome
**Keywords:** migration, platform, scale
EOF

    # Create template search-criteria.md
    cat > "$EXAMPLE_DIR/search-criteria.md" << 'EOF'
# Job Search Criteria

## Target Roles
- Director of Platform Engineering
- Senior Engineering Manager

## Location
- Remote (US)

## Compensation
- Base: $XXX-$XXX
- Total: $XXX-$XXX

## Must-Haves
- People management
- Platform/infrastructure focus
EOF

    # Create sample search results
    cat > "$EXAMPLE_DIR/search-results/gemini-results.md" << 'EOF'
# Job Search Results

Generated: 2026-01-27

| # | Company | Role | Location | Est. TC |
|---|---------|------|----------|---------|
| 1 | Example Corp | Director of Platform | Remote | $450-550k |

## Summary
- 1 role found
EOF

    # Create sample role folder
    mkdir -p "$EXAMPLE_DIR/InProgress/Example Corp - Director of Platform Engineering"
    cp "$ROOT_DIR/notes-template.md" "$EXAMPLE_DIR/InProgress/Example Corp - Director of Platform Engineering/notes.md" 2>/dev/null || true

    cat > "$EXAMPLE_DIR/InProgress/Example Corp - Director of Platform Engineering/JD.md" << 'EOF'
# Director of Platform Engineering

Example Corp is seeking a Director of Platform Engineering.

## Responsibilities
- Set technical vision for platform engineering
- Lead and develop engineering managers
- Drive platform adoption

## Requirements
- 10+ years software engineering experience
- 5+ years engineering management
- Platform or infrastructure background
EOF

    log_success "Created data.example/ with anonymized templates"
}

# ============================================
# CREATE SUPPORT FILES
# ============================================

create_gitignore() {
    log_step "Creating .gitignore"

    if $DRY_RUN; then
        log_info "Would create .gitignore"
        return
    fi

    cat > "$ROOT_DIR/.gitignore" << 'EOF'
# ===========================================
# Ariadne Job Search Tool - .gitignore
# ===========================================

# User data directory (contains all PII)
# This is the PRIMARY protection
data/

# Keep the example data for onboarding
!data.example/

# Build artifacts
status-page/dist/
status-page/.wrangler/

# macOS system files
.DS_Store
**/.DS_Store

# Editor/IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# Backup files from migration
.migration-backup-*/

# Temporary files
*.tmp
*.temp

# Node modules
node_modules/

# Log files
*.log
EOF

    log_success "Created .gitignore"
}

create_init_script() {
    log_step "Creating init.sh"

    if $DRY_RUN; then
        log_info "Would create init.sh"
        return
    fi

    cat > "$ROOT_DIR/init.sh" << 'EOF'
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
echo "1. Edit data/resume-content.md with your resume"
echo "2. Edit data/work-stories.md with your interview stories"
echo "3. Edit data/search-criteria.md with your preferences"
echo ""
echo "Your data/ directory is git-ignored."
echo ""
EOF

    chmod +x "$ROOT_DIR/init.sh"
    log_success "Created init.sh"
}

# ============================================
# PATH AUDIT
# ============================================

audit_remaining_paths() {
    log_step "Auditing for Remaining Absolute Paths"

    if $DRY_RUN; then
        log_info "Would scan for remaining /Users/davideagle paths"
        return
    fi

    echo ""
    log_info "Scanning for remaining absolute paths..."

    local found
    found=$(grep -r "/Users/davideagle" "$ROOT_DIR" \
        --include="*.md" --include="*.json" --include="*.js" \
        2>/dev/null | grep -v ".git" | grep -v "data/" | grep -v ".migration-backup" || true)

    if [[ -n "$found" ]]; then
        log_warn "Found remaining absolute paths:"
        echo ""
        echo "$found" | head -20
        echo ""
        if [[ $(echo "$found" | wc -l) -gt 20 ]]; then
            log_warn "... and more (showing first 20)"
        fi
        log_warn "These may need manual review."
    else
        log_success "No remaining absolute paths found"
    fi

    # Also check for any InProgress/Applied/Rejected without data/ prefix
    log_info "Checking for non-prefixed role paths..."
    local role_paths
    role_paths=$(grep -rE '"folder":\s*"(InProgress|Applied|Rejected)/' "$ROOT_DIR" \
        --include="*.json" --include="*.md" \
        2>/dev/null | grep -v "data/" | grep -v ".migration-backup" | grep -v "data.example" || true)

    if [[ -n "$role_paths" ]]; then
        log_warn "Found folder paths without data/ prefix:"
        echo "$role_paths"
    fi
}

# ============================================
# FINAL VALIDATION
# ============================================

final_validation() {
    log_step "Final Validation"

    if $DRY_RUN; then
        log_info "Would run final validation checks"
        return
    fi

    local errors=()

    # Check data/ structure
    local required_data=("tracker.json" "network.json" "tasks.json")
    for file in "${required_data[@]}"; do
        if [[ ! -f "$DATA_DIR/$file" ]]; then
            errors+=("Missing: data/$file")
        fi
    done

    # Check old files are gone
    local should_be_gone=("tracker.json" "network.json" "tasks.json" "resume-content.md")
    for file in "${should_be_gone[@]}"; do
        if [[ -f "$ROOT_DIR/$file" ]]; then
            errors+=("Still at root: $file (should be in data/)")
        fi
    done

    # Check .gitignore exists
    if [[ ! -f "$ROOT_DIR/.gitignore" ]]; then
        errors+=("Missing: .gitignore")
    fi

    # Check data.example exists
    if [[ ! -d "$EXAMPLE_DIR" ]]; then
        errors+=("Missing: data.example/")
    fi

    if [[ ${#errors[@]} -gt 0 ]]; then
        log_error "Validation found issues:"
        for err in "${errors[@]}"; do
            echo -e "  ${RED}✗${NC} $err"
        done
        return 1
    fi

    log_success "All validation checks passed"
}

# ============================================
# MAIN
# ============================================

main() {
    echo ""
    echo -e "${BOLD}=============================================="
    echo "  Ariadne Migration: Data Directory Pattern  "
    echo "==============================================${NC}"
    echo ""

    if $DRY_RUN; then
        echo -e "${YELLOW}${BOLD}=== DRY RUN MODE ===${NC}"
        echo "No changes will be made."
        echo ""
    fi

    echo "Root directory: $ROOT_DIR"
    echo ""

    # Run all steps
    preflight_checks
    create_backup
    create_data_structure
    move_pii_files
    update_tracker_paths
    update_claude_md
    update_build_js
    update_agent_config
    validate_json_files
    create_example_data
    create_gitignore
    create_init_script
    audit_remaining_paths
    final_validation

    echo ""
    echo -e "${GREEN}${BOLD}=============================================="
    echo "  Migration Complete!                        "
    echo "==============================================${NC}"
    echo ""
    echo "Summary:"
    echo "  ✓ data/ contains your personal data (git-ignored)"
    echo "  ✓ data.example/ contains anonymized templates"
    echo "  ✓ .gitignore protects data/ from commits"
    echo "  ✓ init.sh helps new users set up"
    echo ""
    echo "Backup: $BACKUP_DIR"
    echo ""
    echo -e "${CYAN}Post-migration checklist:${NC}"
    echo "  □ Restart Claude Code (to clear cached paths)"
    echo "  □ Test: Run 'Status' command"
    echo "  □ Test: Run 'cd status-page && node build.js'"
    echo "  □ Test: Run 'Compare JD and resume' for any role"
    echo ""
    echo -e "${CYAN}Rollback command:${NC}"
    echo "  $0 --rollback $BACKUP_DIR"
    echo ""

    if $DRY_RUN; then
        echo -e "${YELLOW}This was a dry run. Run without --dry-run to execute.${NC}"
    fi
}

main "$@"
