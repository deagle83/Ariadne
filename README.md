# Ariadne

A Claude Code-powered job search assistant. Find opportunities, tailor resumes, track applications, and manage your network — conversationally.

**Named after the Greek mythological figure who gave Theseus a thread to navigate the labyrinth**, Ariadne helps you find your way through the maze of modern job searching.

---

## Quick Start

```bash
git clone https://github.com/yourname/ariadne.git
cd ariadne
claude
```

Then say hello:

```
> Good morning

Good morning! I see this is your first time here. Let's get you set up...
```

Ariadne detects first run and walks you through setup. You'll be tracking jobs in under 5 minutes.

---

## What to Have Ready

| Item | Required? | Notes |
|------|-----------|-------|
| Your resume | Recommended | Text, PDF, or markdown. Ariadne analyzes it to pre-fill your profile. |
| Target companies | Optional | Have a mental list — add more later. |
| Target roles/levels | Optional | e.g., "Staff Engineer", "Engineering Manager", "Director" |
| Job search API key | Optional | JobBot or Gemini CLI. Not needed if adding jobs manually. |

Missing something? Setup lets you skip and configure later.

---

## The Job Search Pipeline

### 1. Finding Opportunities

**Automated search:**
```
"Run job search"
```

Ariadne searches your criteria, returning fresh results and filtering out roles you've seen.

**Manual addition:**

Found a job on LinkedIn or through a referral? Use `"Setup Stripe - Platform Lead"` — see [Setting Up a Role](#2-setting-up-a-role).

### 2. Setting Up a Role

```
"Setup Stripe - Platform Lead"
```

Ariadne will:
1. Check for duplicates
2. Grab the job description from your browser or ask for the URL
3. Create a folder with tracking notes
4. Add it to your pipeline as "Sourced"

Each role gets its own folder containing the JD, tailored resume, and interview notes.

**Browser integration:** With Claude-in-Chrome or Firecrawl configured, Ariadne extracts job descriptions from open tabs automatically. Otherwise, paste the URL or JD text. See [Optional Integrations](#optional-integrations).

### 3. Work Stories

Populate `data/work-stories.md` with interview-ready stories from your career:

- Accomplishments indexed by theme (leadership, technical, conflict resolution)
- Quantified impact and context
- Keywords for matching stories to job requirements

The comparison and research agents cross-reference this file. More detail → better output.

### 4. Research Packets

```
"Research packet for Stripe"
```

Ariadne's research agent:
- Profiles the hiring manager (career, management style, public talks)
- Investigates company engineering org, culture, and recent events
- Maps their tech stack to your experience
- Predicts interview questions from the JD
- Links your work stories to likely questions
- Curates a reading list
- Drafts questions to ask

Output: `research-packet.md` with a printable quick reference card.

### 5. Tailoring Your Resume

```
"Compare JD and resume for Stripe"
```

Ariadne's comparison agent:
- Analyzes JD requirements
- Cross-references your resume and work stories
- Evaluates fit across dimensions (strategic, technical, leadership)
- Produces a tailored resume with bullets reordered by relevance
- Flags uncertainty with `[REVIEW]` — never fabricates

Output:
- `resume-draft.md` — Customized resume
- `comparison-analysis.md` — Fit scores, reasoning, interview risks

### 6. Generating Your PDF

```
"Generate PDF for Stripe"
```

Converts markdown to PDF using your stylesheet. Requires pandoc and weasyprint — see [Requirements](#requirements).

### 7. Tracking Progress

```
"Move Stripe to Applied"
"Move Stripe to Phone Screen"
"Move Stripe to Onsite"
```

Stages: `Sourced` → `Applied` → `Phone Screen` → `Technical` → `Onsite` → `Offer` → `Negotiating`

Closing a process:
```
"Move Stripe to Rejected"    # They passed
"Move Stripe to Withdrew"    # You passed
"Move Stripe to Accepted"    # 🎉
```

### 8. Staying Organized

```
"Status"
```

Active roles by stage, recent closures, stale application alerts.

```
"Reconcile"
```

Compares tracker against folders — finds orphans, missing entries, mismatches.

---

## Networking & Tasks

### Contacts

```
"Add contact Sarah Chen at Stripe"
"Log interaction with Sarah"
"Contacts"
```

Track who you know, how you met, and every interaction. Link contacts to job opportunities.

### Tasks

```
"Add task Follow up with Sarah about referral"
"Tasks"
"Complete task #1"
```

Tasks link to jobs and contacts. Never forget a follow-up.

---

## Status Dashboard

```
"Open dashboard"
```

Builds and opens a local HTML dashboard with pipeline funnel, active roles, tasks, and networking.

```
"Deploy dashboard"
```

Deploys to Cloudflare Pages for remote access. Requires wrangler CLI.

---

## Search Backends

| Backend | What it is | Cost | Setup |
|---------|-----------|------|-------|
| **JobBot** | Scrapes real ATS systems (Greenhouse, Lever, Ashby, Workday) | Paid | Add credentials to `data/config.json` |
| **Gemini CLI** | Google AI searches web for postings | Free (limits) | `npm install -g @google/gemini-cli` |
| **Manual** | Add jobs yourself with `Setup` | Free | None |

JobBot is most reliable — real ATS data, guaranteed valid URLs. Gemini may return stale listings.

No search backend? Many users find jobs through LinkedIn or referrals and add them manually.

Config:
```json
{
  "searchBackend": "jobbot",
  "jobbot": { "endpoint": "https://...", "apiKey": "your-key" }
}
```

---

## Optional Integrations

### Chrome Extension (Claude-in-Chrome)

Reads job descriptions from open browser tabs. Say `"Setup Stripe - DevEx Lead"` and Ariadne grabs the JD automatically.

**Setup:** Install Claude-in-Chrome extension, configure MCP server in Claude Code.

### Firecrawl MCP

Alternative to Chrome extension — fetches and parses job posting URLs.

**Setup:** Configure Firecrawl MCP server in Claude Code settings.

### Notion Sync

```
"Sync to Notion"
```

Bidirectional incremental sync. Content hashing skips unchanged items. Local wins on conflicts.

**Auto-sync on session start:**
```json
{
  "notion": {
    "apiKey": "ntn_...",
    "databases": { "jobs": "...", "contacts": "...", "tasks": "..." },
    "autoSync": true
  }
}
```

See [docs/notion-sync.md](docs/notion-sync.md) for full setup.

### Cloudflare Pages

Deploy dashboard for remote access.

**Setup:** `npm install -g wrangler && wrangler login`

---

## Requirements

**Required:**
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

**Optional:**

| Tool | For | Install |
|------|-----|---------|
| pandoc + weasyprint | PDF generation | `brew install pandoc weasyprint` |
| Node.js | Dashboard build | [nodejs.org](https://nodejs.org) |
| wrangler | Dashboard deploy | `npm install -g wrangler` |
| Gemini CLI | Free job search | `npm install -g @google/gemini-cli` |

---

## Example Data

### tracker.json

```json
{
  "active": [{
    "company": "Stripe",
    "role": "Staff Engineer, Platform",
    "stage": "Phone Screen",
    "next": "Technical screen Thursday",
    "url": "https://stripe.com/jobs/123",
    "added": "2026-01-15",
    "updated": "2026-01-28"
  }],
  "skipped": [{
    "company": "Meta",
    "role": "IC6 Infrastructure",
    "reason": "IC role, looking for management"
  }],
  "closed": [{
    "company": "Airbnb",
    "role": "Engineering Manager",
    "outcome": "Rejected",
    "stage": "Onsite"
  }]
}
```

### profile.md

```markdown
# Profile

**Name:** Alex Chen
**Resume filename:** Alex Chen Resume.pdf

## Background

Staff engineer, 8 years experience, transitioning to management.
Led platform team at Datadog building observability infrastructure.

## Target Roles

- Engineering Manager
- Senior Engineering Manager
- Director of Engineering (Platform/Infrastructure)
```

### work-stories.md

```markdown
# Work Stories

## Leadership

### Built Platform Team from Scratch (Datadog, 2024)
- **Situation:** Company needed dedicated platform team
- **Action:** Proposed charter, hired 4 engineers, established roadmap
- **Result:** 70% faster deployments, highest team satisfaction
- **Keywords:** team building, hiring, platform

## Technical

### Migrated Monolith to Microservices (2022)
- **Situation:** Monolith couldn't scale past 10k RPS
- **Action:** Designed service boundaries, led 6-month migration
- **Result:** 50k RPS, 99.99% uptime
- **Keywords:** architecture, migration, scale
```

---

## Command Reference

| Command | What it does |
|---------|--------------|
| `"Run job search"` | Search criteria, return fresh results |
| `"Setup #N"` / `"Setup [Company - Role]"` | Track a role from any source |
| `"Skip #N"` | Filter from future searches |
| `"Research packet for [Company]"` | Interview research packet |
| `"Compare JD and resume for [Company]"` | Tailored resume + fit analysis |
| `"Generate PDF for [Company]"` | Submission-ready PDF |
| `"Move [Company] to [Stage]"` | Update pipeline status |
| `"Status"` | Pipeline overview, stale alerts |
| `"Reconcile"` | Sync tracker with folders |
| `"Add contact [Name] at [Company]"` | Add to network |
| `"Log interaction with [Name]"` | Record touchpoint |
| `"Contacts"` | Network with recent interactions |
| `"Add task [description]"` | Create linked to-do |
| `"Tasks"` | Pending tasks with due dates |
| `"Complete task #N"` | Mark done |
| `"Open dashboard"` | Local HTML dashboard |
| `"Deploy dashboard"` | Deploy to Cloudflare Pages |
| `"Sync to Notion"` | Bidirectional Notion sync |

---

## Troubleshooting

### Commands not working

- Ensure `CLAUDE.md` exists in project root
- Run Claude Code from the project directory
- Try `"Status"` to verify Ariadne responds

### PDF generation fails

```bash
brew install pandoc weasyprint  # macOS
```

### Search returns nothing

- Check `data/search-criteria.md` has target companies
- Verify `data/config.json` has valid credentials
- Add jobs manually: `"Setup Company - Role"`

### Notion sync fails

- API key must start with `ntn_` or `secret_`
- Database IDs: 32 characters from Notion URL
- Integration must be connected to each database
- Debug: `node scripts/notion-sync.js --dry-run`

### Dashboard won't deploy

- Install wrangler: `npm install -g wrangler`
- Authenticate: `wrangler login`
- Check `data/config.json` has `dashboard.projectName`

### Files out of sync

```
"Reconcile"
```

---

## Project Structure

```
ariadne/
├── CLAUDE.md                 # Instructions (the brain)
├── data/                     # Personal data (gitignored)
│   ├── profile.md            # Name, background
│   ├── resume-content.md     # Master resume
│   ├── work-stories.md       # Interview stories
│   ├── search-criteria.md    # Target companies, roles
│   ├── tracker.json          # Pipeline state
│   ├── network.json          # Contacts
│   ├── tasks.json            # To-dos
│   ├── config.json           # API keys (gitignored)
│   ├── InProgress/           # Evaluating
│   ├── Applied/              # Submitted
│   └── Rejected/             # Closed
├── data.example/             # Templates
├── scripts/notion-sync.js    # Notion sync
├── docs/notion-sync.md       # Notion setup guide
├── prompts/                  # Search prompts
├── status-page/              # Dashboard generator
├── resume.css                # PDF stylesheet
├── notes-template.md         # Per-role template
└── init.sh                   # Non-interactive setup
```

---

## How It Works

Ariadne uses Claude Code's ability to read project context and execute workflows. `CLAUDE.md` contains instructions for every command — schemas, validation, error handling.

When you say "Compare JD and resume for Stripe":
1. Reads instruction from CLAUDE.md
2. Finds role in tracker.json
3. Loads JD, resume, work stories
4. Spawns comparison agent
5. Writes tailored resume and analysis

You stay in control — Ariadne asks before destructive actions and flags uncertainty for review.

---

## Contributing

Fork → branch → pull request.

The `data/` structure is portable — use your own content with the framework.

---

## License

MIT. Use it, modify it, make it yours.

---

*Finding your way through the labyrinth, one application at a time.*
