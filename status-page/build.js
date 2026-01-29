#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(__dirname, 'dist');

// ============================================================
// Section 1: Data Loading (with error handling — Item #2)
// ============================================================

function loadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn(`Warning: Error reading ${path.basename(filePath)}: ${err.message}`);
    return fallback;
  }
}

const tracker = loadJson(path.join(ROOT, 'data', 'tracker.json'), { active: [], skipped: [], closed: [] });
const network = loadJson(path.join(ROOT, 'data', 'network.json'), { contacts: [] });
const tasks = loadJson(path.join(ROOT, 'data', 'tasks.json'), { tasks: [] });

let template, styles, script;
try {
  template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
  styles = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
  script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
} catch (err) {
  console.error(`Fatal: Cannot read template files: ${err.message}`);
  process.exit(1);
}

// Stage order for sorting and progression (single source of truth — Item #1)
const STAGE_ORDER = ['Sourced', 'Applied', 'Phone Screen', 'Technical', 'Onsite', 'Offer', 'Negotiating'];

// Valid outcomes for closed roles
const VALID_OUTCOMES = ['Rejected', 'Withdrew', 'Accepted', 'Expired'];

// ============================================================
// Section 2: Utility Functions (Items #4, #5, #6)
// ============================================================

// Escape HTML (Item #5 — added single-quote escaping)
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
}

// Convert stage name to CSS class (Item #6 — single helper)
function stageToClass(stage) {
  return stage.toLowerCase().replace(/\s+/g, '-');
}

// Extract linked items for display (Item #4 — deduplicated helper)
function formatLinkedItems(task) {
  return [
    ...(task.linkedContacts || []),
    ...(task.linkedJobs || []).map(j => j.split(' - ')[0])
  ].join(', ');
}

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Get ISO date string for N days ago (Item #7 — timezone-safe comparison)
function isoDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Get today's ISO date string
function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

// Generic KPI card generator (Item #9 — single function replaces 3)
function generateKpiCardsHtml(cards) {
  return cards.map(({ value, label, warning }) =>
    `<div class="kpi-card${warning ? ' kpi-warning' : ''}">
      <div class="kpi-value">${value}</div>
      <div class="kpi-label">${label}</div>
    </div>`
  ).join('\n');
}

// ============================================================
// Section 3: Metric Computation (pure functions, no HTML)
// ============================================================

// Compute CURRENT metrics (active roles only)
function computeCurrentMetrics(data) {
  const active = data.active || [];

  // Count active roles at each stage (exact counts, not cumulative)
  const currentPipeline = {};
  STAGE_ORDER.forEach(stage => currentPipeline[stage] = 0);
  active.forEach(r => {
    if (STAGE_ORDER.includes(r.stage)) {
      currentPipeline[r.stage]++;
    }
  });

  // Applied = active roles at Applied or beyond
  const appliedStages = STAGE_ORDER.slice(STAGE_ORDER.indexOf('Applied'));
  const appliedCount = active.filter(r => appliedStages.includes(r.stage)).length;

  // Interviewing = active roles past Sourced (Phone Screen or beyond)
  const interviewingStages = STAGE_ORDER.slice(STAGE_ORDER.indexOf('Phone Screen'));
  const interviewingCount = active.filter(r => interviewingStages.includes(r.stage)).length;

  // Updated this week (Item #7 — ISO string comparison)
  const oneWeekAgoISO = isoDateDaysAgo(7);
  const updatedThisWeek = active.filter(r => r.updated >= oneWeekAgoISO).length;

  return {
    activeCount: active.length,
    appliedCount,
    interviewingCount,
    updatedThisWeek,
    currentPipeline
  };
}

// Compute HISTORICAL metrics (all roles: active + closed)
function computeHistoricalMetrics(data) {
  const active = data.active || [];
  const closed = data.closed || [];
  const skipped = data.skipped || [];

  // Days active: from earliest added date to today
  const allDates = [...active, ...closed, ...skipped]
    .map(r => r.added)
    .filter(Boolean)
    .sort();
  const earliestDate = allDates[0] ? new Date(allDates[0]) : new Date();
  const today = new Date();
  const daysActive = Math.floor((today - earliestDate) / (1000 * 60 * 60 * 24));

  // Historical pipeline: all roles that reached each stage (cumulative)
  const historicalPipeline = {};
  STAGE_ORDER.forEach(stage => historicalPipeline[stage] = 0);

  // Count active roles (they've reached at least their current stage)
  active.forEach(r => {
    const stageIndex = STAGE_ORDER.indexOf(r.stage);
    if (stageIndex >= 0) {
      for (let i = 0; i <= stageIndex; i++) {
        historicalPipeline[STAGE_ORDER[i]]++;
      }
    }
  });

  // Count closed roles that have a stage field (reached at least that stage)
  closed.forEach(r => {
    if (r.stage) {
      const stageIndex = STAGE_ORDER.indexOf(r.stage);
      if (stageIndex >= 0) {
        for (let i = 0; i <= stageIndex; i++) {
          historicalPipeline[STAGE_ORDER[i]]++;
        }
      }
    } else {
      // Closed without stage field - assume at least Applied
      historicalPipeline['Sourced']++;
      historicalPipeline['Applied']++;
    }
  });

  // Conversion rates (percentage that advanced from one stage to next)
  const conversionRates = {};
  for (let i = 1; i < STAGE_ORDER.length; i++) {
    const prevStage = STAGE_ORDER[i - 1];
    const currStage = STAGE_ORDER[i];
    const prevCount = historicalPipeline[prevStage];
    const currCount = historicalPipeline[currStage];
    conversionRates[currStage] = prevCount > 0 ? Math.round((currCount / prevCount) * 100) : 0;
  }

  // Outcome breakdown
  const outcomes = {
    rejected: closed.filter(r => r.outcome === 'Rejected').length,
    withdrew: closed.filter(r => r.outcome === 'Withdrew').length,
    accepted: closed.filter(r => r.outcome === 'Accepted').length,
    expired: closed.filter(r => r.outcome === 'Expired').length
  };

  // Average days to first response (for roles that got past Sourced)
  const responseTimes = [];
  [...active, ...closed].forEach(r => {
    const stageIndex = STAGE_ORDER.indexOf(r.stage);
    if (stageIndex > 0 && r.added && r.updated) {
      const added = new Date(r.added);
      const updated = new Date(r.updated);
      const days = Math.floor((updated - added) / (1000 * 60 * 60 * 24));
      if (days > 0) responseTimes.push(days);
    }
  });
  const avgDaysToResponse = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  // Total throughput
  const totalRoles = active.length + closed.length;

  return {
    totalRoles,
    daysActive,
    historicalPipeline,
    conversionRates,
    outcomes,
    avgDaysToResponse,
    closedCount: closed.length,
    skippedCount: skipped.length
  };
}

// Compute task metrics
function computeTaskMetrics(tasksData) {
  const allTasks = tasksData.tasks || [];
  const pending = allTasks.filter(t => t.status === 'pending');
  const completed = allTasks.filter(t => t.status === 'completed');

  // Tasks due soon (within 3 days) — Item #7: ISO string comparison
  const threeDaysFromNowISO = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  })();
  const dueSoon = pending.filter(t => t.due && t.due <= threeDaysFromNowISO);

  // Overdue tasks — Item #7: ISO string comparison
  const todayISO = isoToday();
  const overdue = pending.filter(t => t.due && t.due < todayISO);

  return {
    pendingCount: pending.length,
    completedCount: completed.length,
    dueSoonCount: dueSoon.length,
    overdueCount: overdue.length,
    pending,
    completed
  };
}

// Compute network metrics
function computeNetworkMetrics(networkData) {
  const contacts = networkData.contacts || [];

  // Total interactions
  const totalInteractions = contacts.reduce((sum, c) => sum + (c.interactions?.length || 0), 0);

  // Recent interactions (last 7 days) — Item #7: ISO string comparison
  const oneWeekAgoISO = isoDateDaysAgo(7);
  const recentInteractions = contacts.flatMap(c =>
    (c.interactions || [])
      .filter(i => i.date >= oneWeekAgoISO)
      .map(i => ({ ...i, contactName: c.name, contactId: c.id }))
  ).sort((a, b) => b.date.localeCompare(a.date));

  // Contacts with linked jobs
  const contactsWithJobs = contacts.filter(c =>
    (c.interactions || []).some(i => i.linkedJobs?.length > 0)
  );

  return {
    contactCount: contacts.length,
    totalInteractions,
    recentInteractionCount: recentInteractions.length,
    contactsWithJobsCount: contactsWithJobs.length,
    contacts,
    recentInteractions
  };
}

// Extract fit score from comparison-analysis.md in a role's folder
function getFitScore(role) {
  if (!role.folder) return null;
  const analysisPath = path.join(ROOT, role.folder, 'comparison-analysis.md');
  try {
    if (!fs.existsSync(analysisPath)) {
      // Item #17 — warn when folder exists but analysis file doesn't
      const folderPath = path.join(ROOT, role.folder);
      if (role.folder && !fs.existsSync(folderPath)) {
        console.warn(`Warning: Folder not found for ${role.company} - ${role.role}: ${analysisPath}`);
      }
      return null;
    }
    const content = fs.readFileSync(analysisPath, 'utf8');
    const match = content.match(/Overall Fit(?:\s*Score)?:.*?(\d+)\s*\/\s*100/i);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

// Validate tracker data (Item #12)
function validateTracker(data) {
  const warnings = [];
  const requiredFields = ['company', 'role', 'url', 'added'];

  (data.active || []).forEach((entry, i) => {
    requiredFields.forEach(field => {
      if (!entry[field]) warnings.push(`active[${i}] missing required field: ${field}`);
    });
    if (entry.stage && !STAGE_ORDER.includes(entry.stage)) {
      warnings.push(`active[${i}] invalid stage: "${entry.stage}"`);
    }
  });

  (data.closed || []).forEach((entry, i) => {
    requiredFields.forEach(field => {
      if (!entry[field]) warnings.push(`closed[${i}] missing required field: ${field}`);
    });
    if (entry.outcome && !VALID_OUTCOMES.includes(entry.outcome)) {
      warnings.push(`closed[${i}] invalid outcome: "${entry.outcome}"`);
    }
  });

  warnings.forEach(w => console.warn(`Validation: ${w}`));
  return warnings;
}

// ============================================================
// Section 4: HTML Rendering Functions
// ============================================================

// Format fit score with color coding
function formatFitScore(score) {
  if (score === null) return '<span class="fit-score fit-none">—</span>';
  let fitClass;
  if (score >= 90) fitClass = 'fit-exceptional';
  else if (score >= 85) fitClass = 'fit-strong';
  else if (score >= 78) fitClass = 'fit-good';
  else if (score >= 70) fitClass = 'fit-risk';
  else if (score >= 60) fitClass = 'fit-stretch';
  else fitClass = 'fit-weak';
  return `<span class="fit-score ${fitClass}">${score}</span>`;
}

// Generate KPI cards HTML (current state only) — Item #9
function generateKpiCards(currentMetrics) {
  return generateKpiCardsHtml([
    { value: currentMetrics.activeCount, label: 'Active Roles' },
    { value: currentMetrics.appliedCount, label: 'Applied' },
    { value: currentMetrics.updatedThisWeek, label: 'Updated This Week' },
    { value: currentMetrics.interviewingCount, label: 'Interviewing' }
  ]);
}

// Generate CURRENT pipeline HTML (active roles only, exact counts)
function generateCurrentPipeline(currentMetrics) {
  return STAGE_ORDER.map(stage => {
    const count = currentMetrics.currentPipeline[stage] || 0;
    return `<button class="pipeline-stage ${stageToClass(stage)}" data-stage="${stage}" ${count === 0 ? 'disabled' : ''}>
      <span class="stage-name">${stage}</span>
      <span class="stage-count">${count}</span>
    </button>`;
  }).join('<span class="pipeline-arrow">→</span>');
}

// Generate HISTORICAL pipeline HTML (all-time cumulative)
function generateHistoricalPipeline(historicalMetrics) {
  return STAGE_ORDER.map((stage, index) => {
    const count = historicalMetrics.historicalPipeline[stage] || 0;
    const rate = index > 0 ? historicalMetrics.conversionRates[stage] : null;
    const rateHtml = rate !== null ? `<span class="conversion-rate">${rate}%</span>` : '';
    return `<div class="historical-stage ${stageToClass(stage)}">
      <span class="stage-name">${stage}</span>
      <span class="stage-count">${count}</span>
      ${rateHtml}
    </div>`;
  }).join('<span class="pipeline-arrow">→</span>');
}

// Generate historical stats HTML
function generateHistoricalStats(historicalMetrics) {
  const { outcomes, daysActive, avgDaysToResponse, totalRoles } = historicalMetrics;

  return `
    <div class="historical-grid">
      <div class="historical-funnel">
        <h4>All-Time Pipeline</h4>
        <div class="historical-pipeline">
          ${generateHistoricalPipeline(historicalMetrics)}
        </div>
      </div>
      <div class="historical-metrics">
        <div class="metrics-column">
          <h4>Conversion Rates</h4>
          <ul class="conversion-list">
            ${STAGE_ORDER.slice(1).map(stage => {
              const rate = historicalMetrics.conversionRates[stage] || 0;
              return `<li><span class="metric-label">${stage}:</span> <span class="metric-value">${rate}%</span></li>`;
            }).join('')}
          </ul>
        </div>
        <div class="metrics-column">
          <h4>Outcomes</h4>
          <ul class="outcome-list">
            <li><span class="badge badge-rejected">Rejected</span> <span class="metric-value">${outcomes.rejected}</span></li>
            <li><span class="badge badge-withdrew">Withdrew</span> <span class="metric-value">${outcomes.withdrew}</span></li>
            <li><span class="badge badge-accepted">Accepted</span> <span class="metric-value">${outcomes.accepted}</span></li>
            <li><span class="badge badge-expired">Expired</span> <span class="metric-value">${outcomes.expired}</span></li>
          </ul>
        </div>
        <div class="metrics-column">
          <h4>Timeline</h4>
          <ul class="timeline-list">
            <li><span class="metric-label">Days active:</span> <span class="metric-value">${daysActive}</span></li>
            <li><span class="metric-label">Total roles:</span> <span class="metric-value">${totalRoles}</span></li>
            <li><span class="metric-label">Avg response:</span> <span class="metric-value">${avgDaysToResponse} days</span></li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

// Generate active roles table HTML (Item #8 — adds data-updated attribute)
function generateActiveTable(roles) {
  const sortedRoles = [...roles].sort((a, b) => {
    const stageA = STAGE_ORDER.indexOf(a.stage);
    const stageB = STAGE_ORDER.indexOf(b.stage);
    if (stageB !== stageA) return stageB - stageA; // Higher stage first
    return (b.updated || '').localeCompare(a.updated || ''); // More recent first
  });

  const rows = sortedRoles.map(role => {
    const companyLink = role.url ?
      `<a href="${escapeHtml(role.url)}" target="_blank" rel="noopener">${escapeHtml(role.company)}</a>` :
      escapeHtml(role.company);
    const fitScore = getFitScore(role);

    return `<tr data-stage="${role.stage}" data-fit="${fitScore !== null ? fitScore : ''}" data-updated="${role.updated || ''}">
      <td class="col-company">${companyLink}</td>
      <td class="col-role">${escapeHtml(role.role)}</td>
      <td class="col-fit">${formatFitScore(fitScore)}</td>
      <td class="col-stage"><span class="badge badge-${stageToClass(role.stage)}">${escapeHtml(role.stage)}</span></td>
      <td class="col-next" title="${escapeHtml(role.next)}">${escapeHtml(role.next)}</td>
      <td class="col-updated">${formatDate(role.updated)}</td>
    </tr>`;
  }).join('\n');

  return rows;
}

// Generate closed roles table HTML
function generateClosedTable(roles) {
  const sortedRoles = [...roles].sort((a, b) => (b.closed || '').localeCompare(a.closed || ''));

  return sortedRoles.map(role => {
    const outcomeClass = role.outcome.toLowerCase();
    const companyLink = role.url ?
      `<a href="${escapeHtml(role.url)}" target="_blank" rel="noopener">${escapeHtml(role.company)}</a>` :
      escapeHtml(role.company);
    const stageDisplay = role.stage || '-';
    const stageCls = role.stage ? stageToClass(role.stage) : '';

    return `<tr>
      <td>${companyLink}</td>
      <td>${escapeHtml(role.role)}</td>
      <td>${stageCls ? `<span class="badge badge-${stageCls}">${escapeHtml(stageDisplay)}</span>` : stageDisplay}</td>
      <td><span class="badge badge-${outcomeClass}">${escapeHtml(role.outcome)}</span></td>
      <td>${formatDate(role.closed)}</td>
    </tr>`;
  }).join('\n');
}

// Generate skipped roles table HTML
function generateSkippedTable(roles) {
  const sortedRoles = [...roles].sort((a, b) => (b.added || '').localeCompare(a.added || ''));

  return sortedRoles.map(role => {
    const companyLink = role.url ?
      `<a href="${escapeHtml(role.url)}" target="_blank" rel="noopener">${escapeHtml(role.company)}</a>` :
      escapeHtml(role.company);

    return `<tr>
      <td>${companyLink}</td>
      <td>${escapeHtml(role.role)}</td>
      <td>${escapeHtml(role.reason)}</td>
      <td>${formatDate(role.added)}</td>
    </tr>`;
  }).join('\n');
}

// Generate tasks KPI cards — Item #9
function generateTaskKpiCards(taskMetrics) {
  return generateKpiCardsHtml([
    { value: taskMetrics.pendingCount, label: 'Pending Tasks' },
    { value: taskMetrics.overdueCount, label: 'Overdue', warning: taskMetrics.overdueCount > 0 },
    { value: taskMetrics.dueSoonCount, label: 'Due Soon' },
    { value: taskMetrics.completedCount, label: 'Completed' }
  ]);
}

// Generate pending tasks table (Item #4 — uses formatLinkedItems helper)
function generatePendingTasksTable(taskMetrics) {
  const todayISO = isoToday();

  const sortedTasks = [...taskMetrics.pending].sort((a, b) => {
    // Overdue first, then by due date, then by created date
    const aOverdue = a.due && a.due < todayISO;
    const bOverdue = b.due && b.due < todayISO;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    return (b.created || '').localeCompare(a.created || '');
  });

  if (sortedTasks.length === 0) {
    return '<tr><td colspan="4" class="empty-state">No pending tasks</td></tr>';
  }

  return sortedTasks.map(task => {
    const isOverdue = task.due && task.due < todayISO;
    const linkedItems = formatLinkedItems(task);

    return `<tr class="${isOverdue ? 'overdue' : ''}">
      <td class="col-task">${escapeHtml(task.task)}</td>
      <td class="col-due">${task.due ? formatDate(task.due) : '—'}</td>
      <td class="col-linked" title="${escapeHtml(linkedItems)}">${escapeHtml(linkedItems) || '—'}</td>
      <td class="col-created">${formatDate(task.created)}</td>
    </tr>`;
  }).join('\n');
}

// Generate completed tasks table (Item #4, #16 — sort by completed date)
function generateCompletedTasksTable(taskMetrics) {
  const sortedTasks = [...taskMetrics.completed]
    .sort((a, b) => (b.completed || b.created || '').localeCompare(a.completed || a.created || ''))
    .slice(0, 10); // Show last 10

  if (sortedTasks.length === 0) {
    return '<tr><td colspan="3" class="empty-state">No completed tasks</td></tr>';
  }

  return sortedTasks.map(task => {
    const linkedItems = formatLinkedItems(task);
    const completedDate = task.completed || task.created;

    return `<tr>
      <td class="col-task">${escapeHtml(task.task)}</td>
      <td class="col-linked">${escapeHtml(linkedItems) || '—'}</td>
      <td class="col-created">${formatDate(completedDate)}</td>
    </tr>`;
  }).join('\n');
}

// Generate network KPI cards — Item #9
function generateNetworkKpiCards(networkMetrics) {
  return generateKpiCardsHtml([
    { value: networkMetrics.contactCount, label: 'Contacts' },
    { value: networkMetrics.totalInteractions, label: 'Total Interactions' },
    { value: networkMetrics.recentInteractionCount, label: 'This Week' },
    { value: networkMetrics.contactsWithJobsCount, label: 'Linked to Jobs' }
  ]);
}

// Generate contacts table
function generateContactsTable(networkMetrics) {
  const sortedContacts = [...networkMetrics.contacts].sort((a, b) => {
    const aLast = a.interactions?.length ? a.interactions[a.interactions.length - 1].date : a.added;
    const bLast = b.interactions?.length ? b.interactions[b.interactions.length - 1].date : b.added;
    return (bLast || '').localeCompare(aLast || '');
  });

  if (sortedContacts.length === 0) {
    return '<tr><td colspan="5" class="empty-state">No contacts yet</td></tr>';
  }

  return sortedContacts.map(contact => {
    const lastInteraction = contact.interactions?.length
      ? contact.interactions[contact.interactions.length - 1]
      : null;
    const lastContactStr = lastInteraction
      ? `${formatDate(lastInteraction.date)} (${lastInteraction.type})`
      : '—';

    const linkedJobsCount = contact.interactions?.reduce((count, i) =>
      count + (i.linkedJobs?.length || 0), 0) || 0;

    const linkedUrl = contact.linkedin
      ? `<a href="${escapeHtml(contact.linkedin)}" target="_blank" rel="noopener">${escapeHtml(contact.name)}</a>`
      : escapeHtml(contact.name);

    return `<tr>
      <td class="col-name">${linkedUrl}</td>
      <td class="col-company">${escapeHtml(contact.company || '—')}</td>
      <td class="col-title">${escapeHtml(contact.title || '—')}</td>
      <td class="col-last-contact">${lastContactStr}</td>
      <td class="col-linked-jobs">${linkedJobsCount > 0 ? linkedJobsCount + ' roles' : '—'}</td>
    </tr>`;
  }).join('\n');
}

// Generate recent interactions table
function generateRecentInteractionsTable(networkMetrics) {
  if (networkMetrics.recentInteractions.length === 0) {
    return '<tr><td colspan="4" class="empty-state">No interactions this week</td></tr>';
  }

  return networkMetrics.recentInteractions.slice(0, 10).map(interaction => {
    const linkedJobs = (interaction.linkedJobs || []).map(j => j.split(' - ')[0]).join(', ');

    return `<tr>
      <td class="col-date">${formatDate(interaction.date)}</td>
      <td class="col-contact">${escapeHtml(interaction.contactName)}</td>
      <td class="col-type"><span class="badge badge-${interaction.type}">${escapeHtml(interaction.type)}</span></td>
      <td class="col-summary" title="${escapeHtml(interaction.summary)}">${escapeHtml(interaction.summary)}</td>
    </tr>`;
  }).join('\n');
}

// ============================================================
// Section 5: Build Orchestration
// ============================================================

function build() {
  // Validate tracker data (Item #12)
  validateTracker(tracker);

  const currentMetrics = computeCurrentMetrics(tracker);
  const historicalMetrics = computeHistoricalMetrics(tracker);
  const taskMetrics = computeTaskMetrics(tasks);
  const networkMetrics = computeNetworkMetrics(network);
  const now = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });

  // Strip folder paths from data for JSON embed (privacy)
  const sanitizedTracker = {
    active: tracker.active.map(({folder, ...rest}) => rest),
    closed: tracker.closed.map(({folder, ...rest}) => rest),
    skipped: tracker.skipped
  };

  // Item #13 — prevent </script> breakout in JSON embed
  const safeTrackerJson = JSON.stringify(sanitizedTracker).replace(/</g, '\\u003c');
  const safeStageOrderJson = JSON.stringify(STAGE_ORDER).replace(/</g, '\\u003c');

  // Item #3 — single-pass template replacement
  const replacements = new Map([
    ['STYLES', styles],
    ['SCRIPT', script],
    ['LAST_UPDATED', now],
    ['KPI_CARDS', generateKpiCards(currentMetrics)],
    ['CURRENT_PIPELINE', generateCurrentPipeline(currentMetrics)],
    ['HISTORICAL_STATS', generateHistoricalStats(historicalMetrics)],
    ['ACTIVE_ROWS', generateActiveTable(tracker.active)],
    ['CLOSED_ROWS', generateClosedTable(tracker.closed)],
    ['SKIPPED_ROWS', generateSkippedTable(tracker.skipped)],
    ['CLOSED_COUNT', String(historicalMetrics.closedCount)],
    ['SKIPPED_COUNT', String(historicalMetrics.skippedCount)],
    ['TRACKER_JSON', safeTrackerJson],
    ['STAGE_ORDER_JSON', safeStageOrderJson],
    // Task tab
    ['TASK_KPI_CARDS', generateTaskKpiCards(taskMetrics)],
    ['PENDING_TASKS_ROWS', generatePendingTasksTable(taskMetrics)],
    ['COMPLETED_TASKS_ROWS', generateCompletedTasksTable(taskMetrics)],
    ['PENDING_COUNT', String(taskMetrics.pendingCount)],
    ['COMPLETED_COUNT', String(taskMetrics.completedCount)],
    // Network tab
    ['NETWORK_KPI_CARDS', generateNetworkKpiCards(networkMetrics)],
    ['CONTACTS_ROWS', generateContactsTable(networkMetrics)],
    ['RECENT_INTERACTIONS_ROWS', generateRecentInteractionsTable(networkMetrics)],
    ['CONTACTS_COUNT', String(networkMetrics.contactCount)],
    ['INTERACTIONS_COUNT', String(networkMetrics.recentInteractions.length)]
  ]);

  let html = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (replacements.has(key)) return replacements.get(key);
    console.warn(`Warning: Unreplaced placeholder found: {{${key}}}`);
    return match;
  });

  // Ensure dist directory exists
  if (!fs.existsSync(DIST)) {
    fs.mkdirSync(DIST, { recursive: true });
  }

  fs.writeFileSync(path.join(DIST, 'index.html'), html);
  console.log(`Built status page: ${path.join(DIST, 'index.html')}`);
  console.log(`Active: ${currentMetrics.activeCount} | Applied: ${currentMetrics.appliedCount} | Tasks: ${taskMetrics.pendingCount} | Contacts: ${networkMetrics.contactCount}`);
}

build();
