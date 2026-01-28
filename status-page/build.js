#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(__dirname, 'dist');

// Read source files
const tracker = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tracker.json'), 'utf8'));
const network = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'network.json'), 'utf8'));
const tasks = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tasks.json'), 'utf8'));
const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

// Stage order for sorting and progression
const STAGE_ORDER = ['Sourced', 'Applied', 'Phone Screen', 'Technical', 'Onsite', 'Offer', 'Negotiating'];

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

  // Updated this week: roles with activity in last 7 days
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const updatedThisWeek = active.filter(r => new Date(r.updated) >= oneWeekAgo).length;

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

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}

// Generate KPI cards HTML (current state only)
function generateKpiCards(currentMetrics) {
  return `
    <div class="kpi-card">
      <div class="kpi-value">${currentMetrics.activeCount}</div>
      <div class="kpi-label">Active Roles</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${currentMetrics.appliedCount}</div>
      <div class="kpi-label">Applied</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${currentMetrics.updatedThisWeek}</div>
      <div class="kpi-label">Updated This Week</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${currentMetrics.interviewingCount}</div>
      <div class="kpi-label">Interviewing</div>
    </div>
  `;
}

// Generate CURRENT pipeline HTML (active roles only, exact counts)
function generateCurrentPipeline(currentMetrics) {
  return STAGE_ORDER.map(stage => {
    const count = currentMetrics.currentPipeline[stage] || 0;
    const stageClass = stage.toLowerCase().replace(/\s+/g, '-');
    return `<button class="pipeline-stage ${stageClass}" data-stage="${stage}" ${count === 0 ? 'disabled' : ''}>
      <span class="stage-name">${stage}</span>
      <span class="stage-count">${count}</span>
    </button>`;
  }).join('<span class="pipeline-arrow">→</span>');
}

// Generate HISTORICAL pipeline HTML (all-time cumulative)
function generateHistoricalPipeline(historicalMetrics) {
  return STAGE_ORDER.map((stage, index) => {
    const count = historicalMetrics.historicalPipeline[stage] || 0;
    const stageClass = stage.toLowerCase().replace(/\s+/g, '-');
    const rate = index > 0 ? historicalMetrics.conversionRates[stage] : null;
    const rateHtml = rate !== null ? `<span class="conversion-rate">${rate}%</span>` : '';
    return `<div class="historical-stage ${stageClass}">
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

// Generate active roles table HTML
function generateActiveTable(roles) {
  const sortedRoles = [...roles].sort((a, b) => {
    const stageA = STAGE_ORDER.indexOf(a.stage);
    const stageB = STAGE_ORDER.indexOf(b.stage);
    if (stageB !== stageA) return stageB - stageA; // Higher stage first
    return new Date(b.updated) - new Date(a.updated); // More recent first
  });

  const rows = sortedRoles.map(role => {
    const stageClass = role.stage.toLowerCase().replace(/\s+/g, '-');
    const companyLink = role.url ?
      `<a href="${escapeHtml(role.url)}" target="_blank" rel="noopener">${escapeHtml(role.company)}</a>` :
      escapeHtml(role.company);

    return `<tr data-stage="${role.stage}">
      <td class="col-company">${companyLink}</td>
      <td class="col-role">${escapeHtml(role.role)}</td>
      <td class="col-stage"><span class="badge badge-${stageClass}">${escapeHtml(role.stage)}</span></td>
      <td class="col-next" title="${escapeHtml(role.next)}">${escapeHtml(role.next)}</td>
      <td class="col-updated">${formatDate(role.updated)}</td>
    </tr>`;
  }).join('\n');

  return rows;
}

// Generate closed roles table HTML
function generateClosedTable(roles) {
  const sortedRoles = [...roles].sort((a, b) => new Date(b.closed) - new Date(a.closed));

  return sortedRoles.map(role => {
    const outcomeClass = role.outcome.toLowerCase();
    const companyLink = role.url ?
      `<a href="${escapeHtml(role.url)}" target="_blank" rel="noopener">${escapeHtml(role.company)}</a>` :
      escapeHtml(role.company);
    const stageDisplay = role.stage || '-';
    const stageClass = role.stage ? role.stage.toLowerCase().replace(/\s+/g, '-') : '';

    return `<tr>
      <td>${companyLink}</td>
      <td>${escapeHtml(role.role)}</td>
      <td>${stageClass ? `<span class="badge badge-${stageClass}">${escapeHtml(stageDisplay)}</span>` : stageDisplay}</td>
      <td><span class="badge badge-${outcomeClass}">${escapeHtml(role.outcome)}</span></td>
      <td>${formatDate(role.closed)}</td>
    </tr>`;
  }).join('\n');
}

// Generate skipped roles table HTML
function generateSkippedTable(roles) {
  const sortedRoles = [...roles].sort((a, b) => new Date(b.added) - new Date(a.added));

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

// Compute task metrics
function computeTaskMetrics(tasksData) {
  const allTasks = tasksData.tasks || [];
  const pending = allTasks.filter(t => t.status === 'pending');
  const completed = allTasks.filter(t => t.status === 'completed');

  // Tasks due soon (within 3 days)
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const dueSoon = pending.filter(t => t.due && new Date(t.due) <= threeDaysFromNow);

  // Overdue tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = pending.filter(t => t.due && new Date(t.due) < today);

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

  // Recent interactions (last 7 days)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recentInteractions = contacts.flatMap(c =>
    (c.interactions || [])
      .filter(i => new Date(i.date) >= oneWeekAgo)
      .map(i => ({ ...i, contactName: c.name, contactId: c.id }))
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

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

// Generate tasks KPI cards
function generateTaskKpiCards(taskMetrics) {
  return `
    <div class="kpi-card">
      <div class="kpi-value">${taskMetrics.pendingCount}</div>
      <div class="kpi-label">Pending Tasks</div>
    </div>
    <div class="kpi-card ${taskMetrics.overdueCount > 0 ? 'kpi-warning' : ''}">
      <div class="kpi-value">${taskMetrics.overdueCount}</div>
      <div class="kpi-label">Overdue</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${taskMetrics.dueSoonCount}</div>
      <div class="kpi-label">Due Soon</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${taskMetrics.completedCount}</div>
      <div class="kpi-label">Completed</div>
    </div>
  `;
}

// Generate pending tasks table
function generatePendingTasksTable(taskMetrics) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sortedTasks = [...taskMetrics.pending].sort((a, b) => {
    // Overdue first, then by due date, then by created date
    const aOverdue = a.due && new Date(a.due) < today;
    const bOverdue = b.due && new Date(b.due) < today;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (a.due && b.due) return new Date(a.due) - new Date(b.due);
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    return new Date(b.created) - new Date(a.created);
  });

  if (sortedTasks.length === 0) {
    return '<tr><td colspan="4" class="empty-state">No pending tasks</td></tr>';
  }

  return sortedTasks.map(task => {
    const isOverdue = task.due && new Date(task.due) < today;
    const linkedItems = [
      ...(task.linkedContacts || []),
      ...(task.linkedJobs || []).map(j => j.split(' - ')[0])
    ].join(', ');

    return `<tr class="${isOverdue ? 'overdue' : ''}">
      <td class="col-task">${escapeHtml(task.task)}</td>
      <td class="col-due">${task.due ? formatDate(task.due) : '—'}</td>
      <td class="col-linked" title="${escapeHtml(linkedItems)}">${escapeHtml(linkedItems) || '—'}</td>
      <td class="col-created">${formatDate(task.created)}</td>
    </tr>`;
  }).join('\n');
}

// Generate completed tasks table
function generateCompletedTasksTable(taskMetrics) {
  const sortedTasks = [...taskMetrics.completed]
    .sort((a, b) => new Date(b.created) - new Date(a.created))
    .slice(0, 10); // Show last 10

  if (sortedTasks.length === 0) {
    return '<tr><td colspan="3" class="empty-state">No completed tasks</td></tr>';
  }

  return sortedTasks.map(task => {
    const linkedItems = [
      ...(task.linkedContacts || []),
      ...(task.linkedJobs || []).map(j => j.split(' - ')[0])
    ].join(', ');

    return `<tr>
      <td class="col-task">${escapeHtml(task.task)}</td>
      <td class="col-linked">${escapeHtml(linkedItems) || '—'}</td>
      <td class="col-created">${formatDate(task.created)}</td>
    </tr>`;
  }).join('\n');
}

// Generate network KPI cards
function generateNetworkKpiCards(networkMetrics) {
  return `
    <div class="kpi-card">
      <div class="kpi-value">${networkMetrics.contactCount}</div>
      <div class="kpi-label">Contacts</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${networkMetrics.totalInteractions}</div>
      <div class="kpi-label">Total Interactions</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${networkMetrics.recentInteractionCount}</div>
      <div class="kpi-label">This Week</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${networkMetrics.contactsWithJobsCount}</div>
      <div class="kpi-label">Linked to Jobs</div>
    </div>
  `;
}

// Generate contacts table
function generateContactsTable(networkMetrics) {
  const sortedContacts = [...networkMetrics.contacts].sort((a, b) => {
    // Sort by most recent interaction
    const aLast = a.interactions?.length ? new Date(a.interactions[a.interactions.length - 1].date) : new Date(a.added);
    const bLast = b.interactions?.length ? new Date(b.interactions[b.interactions.length - 1].date) : new Date(b.added);
    return bLast - aLast;
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

// Build the page
function build() {
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

  let html = template
    .replace('{{STYLES}}', styles)
    .replace('{{SCRIPT}}', script)
    .replace('{{LAST_UPDATED}}', now)
    .replace('{{KPI_CARDS}}', generateKpiCards(currentMetrics))
    .replace('{{CURRENT_PIPELINE}}', generateCurrentPipeline(currentMetrics))
    .replace('{{HISTORICAL_STATS}}', generateHistoricalStats(historicalMetrics))
    .replace('{{ACTIVE_ROWS}}', generateActiveTable(tracker.active))
    .replace('{{CLOSED_ROWS}}', generateClosedTable(tracker.closed))
    .replace('{{SKIPPED_ROWS}}', generateSkippedTable(tracker.skipped))
    .replace('{{CLOSED_COUNT}}', historicalMetrics.closedCount)
    .replace('{{SKIPPED_COUNT}}', historicalMetrics.skippedCount)
    .replace('{{TRACKER_JSON}}', JSON.stringify(sanitizedTracker))
    // Task tab replacements
    .replace('{{TASK_KPI_CARDS}}', generateTaskKpiCards(taskMetrics))
    .replace('{{PENDING_TASKS_ROWS}}', generatePendingTasksTable(taskMetrics))
    .replace('{{COMPLETED_TASKS_ROWS}}', generateCompletedTasksTable(taskMetrics))
    .replace('{{PENDING_COUNT}}', taskMetrics.pendingCount)
    .replace('{{COMPLETED_COUNT}}', taskMetrics.completedCount)
    // Network tab replacements
    .replace('{{NETWORK_KPI_CARDS}}', generateNetworkKpiCards(networkMetrics))
    .replace('{{CONTACTS_ROWS}}', generateContactsTable(networkMetrics))
    .replace('{{RECENT_INTERACTIONS_ROWS}}', generateRecentInteractionsTable(networkMetrics))
    .replace('{{CONTACTS_COUNT}}', networkMetrics.contactCount)
    .replace('{{INTERACTIONS_COUNT}}', networkMetrics.recentInteractions.length);

  // Ensure dist directory exists
  if (!fs.existsSync(DIST)) {
    fs.mkdirSync(DIST, { recursive: true });
  }

  fs.writeFileSync(path.join(DIST, 'index.html'), html);
  console.log(`Built status page: ${path.join(DIST, 'index.html')}`);
  console.log(`Active: ${currentMetrics.activeCount} | Applied: ${currentMetrics.appliedCount} | Tasks: ${taskMetrics.pendingCount} | Contacts: ${networkMetrics.contactCount}`);
}

build();
