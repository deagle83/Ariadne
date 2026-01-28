# Changelog

## [2.0.0] - 2026-01-28

### Major Release: Data-Driven Architecture

This release fundamentally restructures Ariadne from a filesystem-based tool to a data-driven job search platform with networking, task management, and a deployable dashboard.

---

### Breaking Changes

- **Directory structure reorganized**: All personal data now lives in `data/` (gitignored)
- **Source of truth changed**: `tracker.json` replaces filesystem scanning for status
- **File locations moved**:
  - `resume-content.md` → `data/resume-content.md`
  - `work-stories.md` → `data/work-stories.md`
  - `search-results/` → `data/search-results/`
  - `InProgress/`, `Applied/`, `Rejected/` → `data/InProgress/`, etc.
- **Skipped roles**: Now stored in `tracker.json` skipped array (not `skipped-roles.md`)

### New Features

#### Data Architecture
- **`tracker.json`** — Single source of truth for all role status with full schema:
  - `active[]` — Roles in progress with stage, next action, dates
  - `skipped[]` — Filtered roles with reason
  - `closed[]` — Completed roles with outcome
- **`network.json`** — Contact management with interaction history
- **`tasks.json`** — Task tracking linked to jobs and contacts
- **`profile.md`** — User identity and preferences (enables public repo)

#### New Commands
| Command | Description |
|---------|-------------|
| `"Move [Company] to [Stage]"` | Update role status (Applied, Phone Screen, Rejected, etc.) |
| `"Reconcile"` | Sync tracker.json with folder structure, fix drift |
| `"Add contact [Name] at [Company]"` | Create contact in network |
| `"Log interaction with [Name]"` | Record email, call, meeting with optional job links |
| `"Contacts"` | Display network with recent interactions |
| `"Add task [description]"` | Create task with optional due date and links |
| `"Tasks"` | Display pending and completed tasks |
| `"Complete task #N"` | Mark task done |
| `"Deploy dashboard"` | Build and deploy status page to Cloudflare Pages |

#### Status Dashboard
- Pipeline funnel visualization
- KPI cards (active roles, applied, days active)
- Sortable tables with stage filters
- Tasks and networking tabs
- Cloudflare Pages deployment with `wrangler`

#### Developer Experience
- **`init.sh`** — One-command setup for new users
- **`data.example/`** — Template data for onboarding
- **`profile.md`** — Separates personal info from framework (public repo safe)
- **Migration scripts** in `scripts/` for existing users

### Improved

#### CLAUDE.md Enhancements
- Full JSON schemas for tracker, network, and tasks
- Detailed field definitions with required/optional flags
- Valid stages and outcomes enumerated
- Company alias handling (Meta/Facebook, Google/Alphabet, etc.)
- JSON safety rules (read-before-write, validate before save)
- Folder name sanitization rules
- Prerequisite checks before spawning agents
- Error handling and recovery procedures

#### Status Command
- Now reads `tracker.json` (fast, consistent)
- Groups by stage with next actions
- Shows recently closed roles
- Flags stale entries (30+ days without update)

#### Setup Command
- Duplicate detection across all tracker arrays
- Fuzzy matching for company/role
- Chrome plugin + Firecrawl fallback for JD capture
- Automatic tracker.json entry creation

### Technical Changes

- **`.gitignore` updated**:
  - `data/` excluded (all personal info)
  - `!data.example/` included (templates)
  - `.claude/settings.local.json` excluded
  - Build artifacts, backups, temp files excluded
- **Resume filename**: Now configured in `profile.md` instead of hardcoded
- **Folder paths**: Relative to `data/` directory

### Migration Guide

For existing Ariadne v1.x users:

1. Run `./scripts/migrate-to-data-dir.sh` to move files to new structure
2. Edit `data/profile.md` with your name and background
3. Manually convert `skipped-roles.md` entries to `tracker.json` skipped array
4. Run `"Reconcile"` to sync tracker with existing folders

---

## [1.0.0] - 2026-01-20

### Initial Release

- Job search via Gemini CLI
- Role setup with JD capture from Chrome
- Resume tailoring with jd-resume-compare agent
- PDF generation via pandoc + weasyprint
- Filesystem-based status tracking
- Basic skip list filtering
