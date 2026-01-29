// STAGE_ORDER is injected by build.js via template — single source of truth (Item #1)

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;

    const tabId = btn.dataset.tab;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');
  });
});

// Collapsible sections
document.querySelectorAll('.collapsible-header').forEach(header => {
  header.addEventListener('click', () => {
    const expanded = header.getAttribute('aria-expanded') === 'true';
    const content = document.getElementById(header.getAttribute('aria-controls'));

    header.setAttribute('aria-expanded', !expanded);
    header.querySelector('.collapse-icon').textContent = expanded ? '+' : '-';
    content.hidden = expanded;
  });
});

// Pipeline filtering (active roles only)
let currentFilter = null;
const clearBtn = document.getElementById('clearFilter');

document.querySelectorAll('.pipeline-stage').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;

    const stage = btn.dataset.stage;

    // Toggle filter
    if (currentFilter === stage) {
      clearFilter();
      return;
    }

    currentFilter = stage;

    // Update pipeline buttons
    document.querySelectorAll('.pipeline-stage').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Filter table rows
    document.querySelectorAll('#activeTable tbody tr').forEach(row => {
      row.classList.toggle('hidden', row.dataset.stage !== stage);
    });

    clearBtn.style.display = 'inline-block';
  });
});

function clearFilter() {
  currentFilter = null;
  document.querySelectorAll('.pipeline-stage').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#activeTable tbody tr').forEach(row => row.classList.remove('hidden'));
  clearBtn.style.display = 'none';
}

clearBtn.addEventListener('click', clearFilter);

// Table sorting
let sortColumn = null;
let sortDirection = 'asc';

document.querySelectorAll('.roles-table th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const column = th.dataset.sort;
    const table = th.closest('table');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    // Toggle direction
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }

    // Update header classes
    table.querySelectorAll('th').forEach(h => {
      h.classList.remove('sort-asc', 'sort-desc');
    });
    th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');

    // Sort rows
    rows.sort((a, b) => {
      let aVal, bVal;

      if (column === 'company') {
        aVal = a.querySelector('.col-company').textContent.toLowerCase();
        bVal = b.querySelector('.col-company').textContent.toLowerCase();
      } else if (column === 'fit') {
        aVal = a.dataset.fit ? parseInt(a.dataset.fit) : -1;
        bVal = b.dataset.fit ? parseInt(b.dataset.fit) : -1;
      } else if (column === 'stage') {
        aVal = stageOrder.indexOf(a.dataset.stage);
        bVal = stageOrder.indexOf(b.dataset.stage);
      } else if (column === 'updated') {
        // Item #8 — use data-updated attribute (ISO string) instead of parsing display text
        aVal = a.dataset.updated || '';
        bVal = b.dataset.updated || '';
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Re-append rows
    rows.forEach(row => tbody.appendChild(row));
  });
});
