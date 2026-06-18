// =========== Bolão Copa 2026 — Tracker UI ===========

const GUTO = 'Guto';
let DATA = null;
let currentFilter = 'all';

// ============= UTILS =============
function fmtNum(n) {
  if (n === null || n === undefined) return '–';
  return String(n);
}

function fmtSigned(n) {
  if (n === null || n === undefined || n === 0) return '–';
  return n > 0 ? `+${n}` : String(n);
}

function deltaCell(delta) {
  if (delta === null || delta === undefined || delta === 0) {
    return '<span class="delta flat">–</span>';
  }
  const cls = delta > 0 ? 'up' : 'down';
  const arrow = delta > 0 ? '▲' : '▼';
  return `<span class="delta ${cls}">${arrow}${Math.abs(delta)}</span>`;
}

function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso + 'T00:00:00');
  const days = ['dom','seg','ter','qua','qui','sex','sáb'];
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

// ============= RENDER =============
function renderTopbar() {
  document.getElementById('meta-jogos').textContent = `${DATA.jogos_disputados}/104`;
  document.getElementById('meta-part').textContent = DATA.total_participantes;
  document.getElementById('meta-data').textContent = formatDate(DATA.data_atualizacao);
}

function renderHero() {
  const ranking = DATA.ranking;
  const guto = ranking.find(r => r.jogador === GUTO);
  if (!guto) return;

  document.getElementById('hero-name').textContent = guto.jogador;
  document.getElementById('hero-pos').textContent = guto.pos;
  document.getElementById('hero-of').textContent = ranking.length;
  document.getElementById('hero-pts').textContent = guto.total;

  // Delta
  const deltaEl = document.getElementById('hero-delta');
  const delta = guto.delta;
  if (delta === null || delta === undefined || delta === 0) {
    deltaEl.textContent = '–';
    deltaEl.className = 'hero-delta-num';
  } else {
    const arrow = delta > 0 ? '▲' : '▼';
    deltaEl.textContent = `${arrow}${Math.abs(delta)}`;
    deltaEl.className = 'hero-delta-num ' + (delta > 0 ? 'up' : 'down');
  }

  // Stats
  const leader = ranking[0];
  document.getElementById('stat-leader').textContent = leader.jogador.split(' ')[0]; // primeiro nome
  document.getElementById('stat-leader-gap').textContent =
    guto.pos === 1 ? '· liderança' : `${guto.total - leader.total} pts (${leader.total} líder)`;

  const top3 = ranking[2] || ranking[ranking.length - 1];
  document.getElementById('stat-top3').textContent = `${top3.total} pts`;
  document.getElementById('stat-top3-gap').textContent =
    guto.pos <= 3 ? '· você está no top 3' : `${guto.total - top3.total} pts até o pódio`;

  // Mediana = ponto médio
  const median = ranking[Math.floor(ranking.length / 2)];
  document.getElementById('stat-median').textContent = `${median.total} pts`;
  document.getElementById('stat-median-gap').textContent =
    guto.total > median.total
      ? `+${guto.total - median.total} pts acima`
      : guto.total < median.total
        ? `${guto.total - median.total} pts abaixo`
        : 'na mediana';
}

function getFiltered() {
  const all = DATA.ranking;
  const guto = all.find(r => r.jogador === GUTO);
  if (currentFilter === 'top10') return all.slice(0, 10);
  if (currentFilter === 'neighbors') {
    if (!guto) return all;
    const idx = all.indexOf(guto);
    return all.slice(Math.max(0, idx - 5), Math.min(all.length, idx + 6));
  }
  if (currentFilter === 'search') {
    const q = document.getElementById('search-input').value.toLowerCase().trim();
    if (!q) return all;
    return all.filter(r => r.jogador.toLowerCase().includes(q));
  }
  return all;
}

function renderTable() {
  const filtered = getFiltered();
  const leaderTotal = DATA.ranking[0].total;
  const body = document.getElementById('ranking-body');

  body.innerHTML = filtered.map(r => {
    const isGuto = r.jogador === GUTO;
    const gap = leaderTotal - r.total;
    const gapCell = gap === 0 ? '<span class="col-gap zero">·</span>' : `-${gap}`;
    const bd = r.breakdown;
    const grupos = bd.fase_grupos_jogos + bd.fase_grupos_classificacao;
    const formatBD = v => v === 0 ? '<span class="bd-empty">·</span>' : v;

    return `
      <tr class="${isGuto ? 'is-guto' : ''}" data-name="${r.jogador}">
        <td class="col-delta">${deltaCell(r.delta)}</td>
        <td class="col-pos">${r.pos_label}</td>
        <td class="col-name">${r.jogador}</td>
        <td class="col-num col-total">${r.total}</td>
        <td class="col-num col-breakdown col-hide-mobile">${formatBD(grupos)}</td>
        <td class="col-num col-breakdown col-hide-mobile">${formatBD(bd.mata_mata)}</td>
        <td class="col-num col-breakdown col-hide-mobile">${formatBD(bd.bonus)}</td>
        <td class="col-num col-gap">${gapCell}</td>
      </tr>
    `;
  }).join('');
}

// ============= INTERACTIONS =============
function setupFilters() {
  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;

      const searchInput = document.getElementById('search-input');
      if (currentFilter === 'search') {
        searchInput.style.display = 'inline-block';
        searchInput.focus();
      } else {
        searchInput.style.display = 'none';
        searchInput.value = '';
      }
      renderTable();
    });
  });

  document.getElementById('search-input').addEventListener('input', renderTable);

  document.getElementById('jump-guto').addEventListener('click', () => {
    // se não estiver no filtro all, volta pra all primeiro
    if (currentFilter !== 'all') {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-filter="all"]').classList.add('active');
      currentFilter = 'all';
      document.getElementById('search-input').style.display = 'none';
      renderTable();
    }
    setTimeout(() => {
      const row = document.querySelector('tr.is-guto');
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  });
}

// ============= INIT =============
async function init() {
  try {
    const resp = await fetch('data/ranking_calculado.json?t=' + Date.now());
    if (!resp.ok) throw new Error(`Erro ${resp.status}`);
    DATA = await resp.json();

    renderTopbar();
    renderHero();
    renderTable();
    setupFilters();
  } catch (err) {
    console.error(err);
    document.getElementById('ranking-body').innerHTML = `
      <tr><td colspan="8" style="padding: 40px; text-align: center; color: var(--red);">
        Não consegui carregar os dados.<br>
        <small style="color: var(--text-muted); font-family: var(--font-mono);">${err.message}</small><br>
        <small style="color: var(--text-muted); font-family: var(--font-mono); margin-top: 8px; display: inline-block;">
          Verifique se data/ranking_calculado.json existe no repositório.
        </small>
      </td></tr>
    `;
  }
}

init();
