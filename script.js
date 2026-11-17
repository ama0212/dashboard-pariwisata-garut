/* ============================================================
   script.js — Dashboard Pariwisata & Kebudayaan Garut
   Vanilla JavaScript: load data, filter, KPI, charts, table
   ============================================================ */

'use strict';

// ----------------------------------------------------------------
// 1. GLOBAL STATE
// ----------------------------------------------------------------

/** @type {Object[]} Raw dataset loaded from data.json */
let rawData = [];

/** @type {Object[]} Currently filtered dataset */
let filteredData = [];

/** Chart instances — stored so they can be destroyed on re-render */
const charts = {};

// Chart.js default font
Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
Chart.defaults.font.size   = 12;

// ----------------------------------------------------------------
// 2. COLOUR PALETTE (consistent across all charts)
// ----------------------------------------------------------------
const COLORS = {
  Alam   : { bg: 'rgba( 22,163, 74,0.75)', border: '#16a34a' },
  Buatan : { bg: 'rgba( 37, 99,235,0.75)', border: '#2563eb' },
  Budaya : { bg: 'rgba(217,119,  6,0.75)', border: '#d97706' },
};

/** Pastel palette for Top 10 bar */
const TOP10_COLORS = [
  'rgba( 37, 99,235,0.75)',
  'rgba( 22,163, 74,0.75)',
  'rgba(217,119,  6,0.75)',
  'rgba(147, 51,234,0.75)',
  'rgba(220, 38, 38,0.75)',
  'rgba( 14,165,233,0.75)',
  'rgba(236,72,153,0.75)',
  'rgba( 20,184,166,0.75)',
  'rgba(249,115, 22,0.75)',
  'rgba(100,116,139,0.75)',
];

// ----------------------------------------------------------------
// 3. UTILITY HELPERS
// ----------------------------------------------------------------

/**
 * Formats a number with thousand-separator dots (Indonesian style).
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  return new Intl.NumberFormat('id-ID').format(n);
}

/**
 * Formats a Rupiah value compactly (e.g. 1.2 M → "1,2 Jt", 2.5 B → "2,5 M")
 * @param {number} val  value in Rupiah
 * @returns {string}
 */
function formatRupiah(val) {
  if (val >= 1_000_000_000) {
    return 'Rp ' + (val / 1_000_000_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' M';
  }
  if (val >= 1_000_000) {
    return 'Rp ' + (val / 1_000_000).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' Jt';
  }
  return 'Rp ' + formatNumber(val);
}

/**
 * Destroys an existing Chart.js instance if it exists.
 * @param {string} id  key in the `charts` object
 */
function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

/**
 * Returns an array of unique values for a given key in the dataset.
 * @param {Object[]} data
 * @param {string}   key
 * @returns {string[]}
 */
function uniqueValues(data, key) {
  return [...new Set(data.map(d => d[key]))];
}

/**
 * Groups an array of objects by a key and aggregates values with a reducer.
 * @param {Object[]}  data
 * @param {string}    groupKey
 * @param {Function}  reducer  (acc, item) => acc
 * @param {*}         initial  initial accumulator value (cloned per group)
 * @returns {Object}  { groupValue: aggregated }
 */
function groupBy(data, groupKey, reducer, initial) {
  return data.reduce((result, item) => {
    const key = item[groupKey];
    if (!result[key]) result[key] = JSON.parse(JSON.stringify(initial));
    result[key] = reducer(result[key], item);
    return result;
  }, {});
}

// ----------------------------------------------------------------
// 4. LOAD DATA
// ----------------------------------------------------------------

/**
 * Fetches data.json and bootstraps the dashboard.
 */
async function loadData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    rawData = await response.json();

    // Set "last updated" badge
    const now = new Date();
    document.getElementById('lastUpdated').textContent =
      'Data diperbarui: ' + now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    // Initial render (no filter)
    filteredData = [...rawData];
    renderAll();
  } catch (err) {
    console.error('Gagal memuat data.json:', err);
    document.getElementById('lastUpdated').textContent = '⚠ Gagal memuat data';
  }
}

// ----------------------------------------------------------------
// 5. FILTER LOGIC
// ----------------------------------------------------------------

/**
 * Reads current filter values, filters rawData, and re-renders.
 */
function applyFilters() {
  const kategori = document.getElementById('filterKategori').value;
  const status   = document.getElementById('filterStatus').value;

  filteredData = rawData.filter(d => {
    const matchKategori = (kategori === 'Semua') || (d.kategori === kategori);
    const matchStatus   = (status   === 'Semua') || (d.status   === status);
    return matchKategori && matchStatus;
  });

  renderAll();
}

/**
 * Resets all filters to "Semua" and re-renders.
 */
function resetFilters() {
  document.getElementById('filterKategori').value = 'Semua';
  document.getElementById('filterStatus').value   = 'Semua';
  filteredData = [...rawData];
  renderAll();
}

// ----------------------------------------------------------------
// 6. RENDER ALL — orchestrates KPI + charts + table
// ----------------------------------------------------------------

function renderAll() {
  renderKPIs();
  renderChartKategori();
  renderChartStatus();
  renderChartTop10();
  renderChartPendapatan();
  renderChartRating();
  renderChartScatter();
  renderTable();
}

// ----------------------------------------------------------------
// 7. KPI CARDS
// ----------------------------------------------------------------

function renderKPIs() {
  const data = filteredData;

  const totalDestinasi  = data.length;
  const belumDikelola   = data.filter(d => d.status === 'Belum Dikelola').length;
  const totalKunjungan  = data.reduce((s, d) => s + d.pengunjung, 0);
  const totalPendapatan = data.reduce((s, d) => s + d.estimasi_pendapatan, 0);

  document.getElementById('kpiTotalDestinasi').textContent = formatNumber(totalDestinasi);
  document.getElementById('kpiBelumDikelola').textContent  = formatNumber(belumDikelola);
  document.getElementById('kpiTotalKunjungan').textContent = formatNumber(totalKunjungan);
  document.getElementById('kpiTotalPendapatan').textContent = formatRupiah(totalPendapatan);

  // Result count in filter bar
  document.getElementById('resultCount').textContent = formatNumber(totalDestinasi);
}

// ----------------------------------------------------------------
// 8. CHART 1 — Distribusi Kategori (Doughnut)
// ----------------------------------------------------------------

function renderChartKategori() {
  destroyChart('kategori');

  const categories = ['Alam', 'Buatan', 'Budaya'];
  const counts = categories.map(k => filteredData.filter(d => d.kategori === k).length);

  const ctx = document.getElementById('chartKategori').getContext('2d');
  charts.kategori = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: counts,
        backgroundColor: categories.map(k => COLORS[k].bg),
        borderColor    : categories.map(k => COLORS[k].border),
        borderWidth    : 2,
        hoverOffset    : 10,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} destinasi`
          }
        }
      }
    }
  });
}

// ----------------------------------------------------------------
// 9. CHART 2 — Status Pengelolaan (Doughnut)
// ----------------------------------------------------------------

function renderChartStatus() {
  destroyChart('status');

  const labels  = ['Dikelola Dinas', 'Belum Dikelola'];
  const counts  = labels.map(s => filteredData.filter(d => d.status === s).length);
  const bgColors     = ['rgba(22,163,74,0.75)',  'rgba(220,38,38,0.75)'];
  const borderColors = ['#16a34a', '#dc2626'];

  const ctx = document.getElementById('chartStatus').getContext('2d');
  charts.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: bgColors,
        borderColor    : borderColors,
        borderWidth    : 2,
        hoverOffset    : 10,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} destinasi`
          }
        }
      }
    }
  });
}

// ----------------------------------------------------------------
// 10. CHART 3 — Top 10 Destinasi (Horizontal Bar)
// ----------------------------------------------------------------

function renderChartTop10() {
  destroyChart('top10');

  // Sort descending by pengunjung, take top 10
  const top10 = [...filteredData]
    .sort((a, b) => b.pengunjung - a.pengunjung)
    .slice(0, 10);

  // Reverse so highest is on top in horizontal bar
  const labels  = top10.map(d => d.nama).reverse();
  const values  = top10.map(d => d.pengunjung).reverse();
  const bgColors = [...TOP10_COLORS].reverse().slice(0, top10.length);

  const ctx = document.getElementById('chartTop10').getContext('2d');
  charts.top10 = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label   : 'Jumlah Pengunjung',
        data    : values,
        backgroundColor: bgColors,
        borderColor    : bgColors.map(c => c.replace('0.75', '1')),
        borderWidth: 1.5,
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y',          // Horizontal bar
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${formatNumber(ctx.parsed.x)} pengunjung`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: v => formatNumber(v)
          }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        }
      }
    }
  });
}

// ----------------------------------------------------------------
// 11. CHART 4 — Estimasi Pendapatan per Kategori (Bar)
// ----------------------------------------------------------------

function renderChartPendapatan() {
  destroyChart('pendapatan');

  const categories = ['Alam', 'Buatan', 'Budaya'];
  // Sum estimasi_pendapatan per category, convert to Juta (million)
  const totals = categories.map(k =>
    filteredData
      .filter(d => d.kategori === k)
      .reduce((s, d) => s + d.estimasi_pendapatan, 0) / 1_000_000
  );

  const ctx = document.getElementById('chartPendapatan').getContext('2d');
  charts.pendapatan = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [{
        label: 'Estimasi Pendapatan (Juta Rp)',
        data : totals,
        backgroundColor: categories.map(k => COLORS[k].bg),
        borderColor    : categories.map(k => COLORS[k].border),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Rp ${ctx.parsed.y.toLocaleString('id-ID', { maximumFractionDigits: 1 })} Juta`
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: v => 'Rp ' + v.toLocaleString('id-ID') + ' Jt'
          }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

// ----------------------------------------------------------------
// 12. CHART 5 — Rata-rata Rating per Kategori (Bar)
// ----------------------------------------------------------------

function renderChartRating() {
  destroyChart('rating');

  const categories = ['Alam', 'Buatan', 'Budaya'];
  const avgRatings = categories.map(k => {
    const subset = filteredData.filter(d => d.kategori === k);
    if (!subset.length) return 0;
    return +(subset.reduce((s, d) => s + d.rating, 0) / subset.length).toFixed(2);
  });

  const ctx = document.getElementById('chartRating').getContext('2d');
  charts.rating = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [{
        label: 'Rata-rata Rating',
        data : avgRatings,
        backgroundColor: categories.map(k => COLORS[k].bg),
        borderColor    : categories.map(k => COLORS[k].border),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Rating: ${ctx.parsed.y.toFixed(2)} / 5.0`
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 5,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            stepSize: 1,
            callback: v => v + '.0'
          }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

// ----------------------------------------------------------------
// 13. CHART 6 — Rating vs Pengunjung (Scatter)
// ----------------------------------------------------------------

function renderChartScatter() {
  destroyChart('scatter');

  const categories = ['Alam', 'Buatan', 'Budaya'];

  // Build one dataset per category for coloured legend
  const datasets = categories.map(k => ({
    label: k,
    data : filteredData
      .filter(d => d.kategori === k)
      .map(d => ({ x: d.rating, y: d.pengunjung, nama: d.nama })),
    backgroundColor: COLORS[k].bg,
    borderColor    : COLORS[k].border,
    borderWidth    : 1.5,
    pointRadius    : 7,
    pointHoverRadius: 9,
  }));

  const ctx = document.getElementById('chartScatter').getContext('2d');
  charts.scatter = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10 }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const { nama } = ctx.raw;
              return ` ${nama}: Rating ${ctx.parsed.x} | ${formatNumber(ctx.parsed.y)} pengunjung`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Rating (1–5)', color: '#6b7280' },
          min: 3.0,
          max: 5.0,
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        y: {
          title: { display: true, text: 'Jumlah Pengunjung', color: '#6b7280' },
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { callback: v => formatNumber(v) }
        }
      }
    }
  });
}

// ----------------------------------------------------------------
// 14. DATA TABLE
// ----------------------------------------------------------------

function renderTable() {
  const tbody     = document.getElementById('tableBody');
  const tableEmpty = document.getElementById('tableEmpty');
  const tableCount = document.getElementById('tableCount');

  tbody.innerHTML = '';
  tableCount.textContent = formatNumber(filteredData.length);

  if (!filteredData.length) {
    tableEmpty.classList.remove('hidden');
    return;
  }
  tableEmpty.classList.add('hidden');

  // Sort by pengunjung desc for table display
  const sorted = [...filteredData].sort((a, b) => b.pengunjung - a.pengunjung);

  sorted.forEach((d, i) => {
    const badgeKategori = getBadgeKategori(d.kategori);
    const badgeStatus   = getBadgeStatus(d.status);
    const stars         = renderStars(d.rating);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-gray-400 font-medium">${i + 1}</td>
      <td class="font-semibold text-gray-800">${escapeHTML(d.nama)}</td>
      <td class="text-gray-500">${escapeHTML(d.kecamatan)}</td>
      <td>${badgeKategori}</td>
      <td>${badgeStatus}</td>
      <td class="text-right font-medium text-gray-700">${formatNumber(d.pengunjung)}</td>
      <td class="text-right">
        <span class="star-rating">${stars}</span>
        <span class="text-gray-500 text-xs ml-0.5">${d.rating.toFixed(1)}</span>
      </td>
      <td class="text-right font-medium text-purple-600">${formatRupiah(d.estimasi_pendapatan)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---- Helper: category badge HTML ----
function getBadgeKategori(kategori) {
  const map = {
    Alam   : 'badge-alam',
    Buatan : 'badge-buatan',
    Budaya : 'badge-budaya',
  };
  return `<span class="badge ${map[kategori] || ''}">${escapeHTML(kategori)}</span>`;
}

// ---- Helper: status badge HTML ----
function getBadgeStatus(status) {
  const cls = status === 'Dikelola Dinas' ? 'badge-dikelola' : 'badge-belum';
  return `<span class="badge ${cls}">${escapeHTML(status)}</span>`;
}

// ---- Helper: render star string (★☆) ----
function renderStars(rating) {
  const full  = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

// ---- Helper: escape HTML to prevent XSS ----
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ----------------------------------------------------------------
// 15. EVENT LISTENERS
// ----------------------------------------------------------------

document.getElementById('filterKategori').addEventListener('change', applyFilters);
document.getElementById('filterStatus').addEventListener('change', applyFilters);
document.getElementById('btnReset').addEventListener('click', resetFilters);

// ----------------------------------------------------------------
// 16. BOOTSTRAP
// ----------------------------------------------------------------

// Start by loading data once DOM is ready
document.addEventListener('DOMContentLoaded', loadData);
