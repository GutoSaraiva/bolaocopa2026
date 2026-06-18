// =========== Bolão Copa 2026 — Tracker UI ===========

const GUTO = 'Guto';
let DATA_RANKING = null;
let DATA_GABARITO = null;
let DATA_PALPITES = null;
let DATA_PALPITE_GUTO = null;
let currentFilter = 'all';
let currentView = 'ranking';
let selectedPalpite = null;

// ============= UTILS =============
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

function emptyOr(v, cls='bd-empty') {
  if (v === null || v === undefined || v === 0 || v === '') return `<span class="${cls}">·</span>`;
  return v;
}

// ============= TABS / VIEWS =============
function showView(view) {
  currentView = view;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.hidden = v.dataset.view !== view);

  // Lazy load
  if (view === 'gabarito' && !DATA_GABARITO) loadGabarito();
  else if (view === 'gabarito') renderGabarito();
  if (view === 'palpites' && !DATA_PALPITES) loadPalpites();
}

// ============= RENDER: TOPBAR + RANKING =============
function renderTopbar() {
  document.getElementById('meta-jogos').textContent = `${DATA_RANKING.jogos_disputados}/104`;
  document.getElementById('meta-part').textContent = DATA_RANKING.total_participantes;
  document.getElementById('meta-data').textContent = formatDate(DATA_RANKING.data_atualizacao);
}

function renderHero() {
  const ranking = DATA_RANKING.ranking;
  const guto = ranking.find(r => r.jogador === GUTO);
  if (!guto) return;

  document.getElementById('hero-name').textContent = guto.jogador;
  document.getElementById('hero-pos').textContent = guto.pos;
  document.getElementById('hero-of').textContent = ranking.length;
  document.getElementById('hero-pts').textContent = guto.total;

  const deltaEl = document.getElementById('hero-delta');
  const delta = guto.delta;
  if (delta === null || delta === undefined || delta === 0) {
    deltaEl.textContent = '–';
    deltaEl.className = 'hero-delta-num';
  } else {
    deltaEl.textContent = `${delta > 0 ? '▲' : '▼'}${Math.abs(delta)}`;
    deltaEl.className = 'hero-delta-num ' + (delta > 0 ? 'up' : 'down');
  }

  const leader = ranking[0];
  document.getElementById('stat-leader').textContent = leader.jogador.split(' ')[0];
  document.getElementById('stat-leader-gap').textContent =
    guto.pos === 1 ? '· liderança' : `${guto.total - leader.total} pts (${leader.total} líder)`;

  const top3 = ranking[2] || ranking[ranking.length - 1];
  document.getElementById('stat-top3').textContent = `${top3.total} pts`;
  document.getElementById('stat-top3-gap').textContent =
    guto.pos <= 3 ? '· você está no top 3' : `${guto.total - top3.total} pts até o pódio`;

  const median = ranking[Math.floor(ranking.length / 2)];
  document.getElementById('stat-median').textContent = `${median.total} pts`;
  document.getElementById('stat-median-gap').textContent =
    guto.total > median.total ? `+${guto.total - median.total} pts acima`
    : guto.total < median.total ? `${guto.total - median.total} pts abaixo`
    : 'na mediana';
}

function getFiltered() {
  const all = DATA_RANKING.ranking;
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
  const leaderTotal = DATA_RANKING.ranking[0].total;
  const body = document.getElementById('ranking-body');
  body.innerHTML = filtered.map(r => {
    const isGuto = r.jogador === GUTO;
    const gap = leaderTotal - r.total;
    const gapCell = gap === 0 ? '<span class="col-gap zero">·</span>' : `-${gap}`;
    const bd = r.breakdown;
    const grupos = bd.fase_grupos_jogos + bd.fase_grupos_classificacao;
    return `
      <tr class="${isGuto ? 'is-guto' : ''}">
        <td class="col-delta">${deltaCell(r.delta)}</td>
        <td class="col-pos">${r.pos_label}</td>
        <td class="col-name">${r.jogador}</td>
        <td class="col-num col-total">${r.total}</td>
        <td class="col-num col-breakdown col-hide-mobile">${emptyOr(grupos)}</td>
        <td class="col-num col-breakdown col-hide-mobile">${emptyOr(bd.mata_mata)}</td>
        <td class="col-num col-breakdown col-hide-mobile">${emptyOr(bd.bonus)}</td>
        <td class="col-num col-gap">${gapCell}</td>
      </tr>
    `;
  }).join('');
}

// ============= RENDER: GABARITO =============
async function loadGabarito() {
  try {
    const resp = await fetch('data/gabarito_atual.json?t=' + Date.now());
    DATA_GABARITO = await resp.json();
    renderGabarito();
  } catch (err) {
    console.error(err);
    document.getElementById('groups-grid').innerHTML = `<p style="color: var(--red);">Erro carregando gabarito: ${err.message}</p>`;
  }
}

function calcStandings(jogos) {
  const times = {};
  jogos.forEach(j => {
    if (!j.disputado) return;
    [j.time1, j.time2].forEach(t => {
      if (!times[t]) times[t] = { pts: 0, gp: 0, gc: 0, jogos: 0, v: 0, e: 0, d: 0 };
    });
    times[j.time1].gp += j.gols1; times[j.time1].gc += j.gols2; times[j.time1].jogos++;
    times[j.time2].gp += j.gols2; times[j.time2].gc += j.gols1; times[j.time2].jogos++;
    if (j.gols1 > j.gols2) { times[j.time1].pts += 3; times[j.time1].v++; times[j.time2].d++; }
    else if (j.gols2 > j.gols1) { times[j.time2].pts += 3; times[j.time2].v++; times[j.time1].d++; }
    else { times[j.time1].pts++; times[j.time2].pts++; times[j.time1].e++; times[j.time2].e++; }
  });
  // Adiciona times ainda sem jogos
  const todosTimes = new Set();
  jogos.forEach(j => { todosTimes.add(j.time1); todosTimes.add(j.time2); });
  todosTimes.forEach(t => {
    if (!times[t]) times[t] = { pts: 0, gp: 0, gc: 0, jogos: 0, v: 0, e: 0, d: 0 };
  });
  return Object.entries(times).sort(([a, sa], [b, sb]) => {
    if (sb.pts !== sa.pts) return sb.pts - sa.pts;
    const sda = sa.gp - sa.gc, sdb = sb.gp - sb.gc;
    if (sdb !== sda) return sdb - sda;
    return sb.gp - sa.gp;
  });
}

function renderGabarito() {
  if (!DATA_GABARITO) return;
  const jogosPorGrupo = {};
  DATA_GABARITO.jogos_grupos.forEach(j => {
    (jogosPorGrupo[j.grupo] = jogosPorGrupo[j.grupo] || []).push(j);
  });

  const grupos = Object.keys(jogosPorGrupo).sort();
  document.getElementById('groups-grid').innerHTML = grupos.map(g => {
    const jogos = jogosPorGrupo[g];
    const disputados = jogos.filter(j => j.disputado).length;
    const completo = disputados === jogos.length;
    const standings = calcStandings(jogos);

    const standingsHTML = standings.map(([team, s], i) => {
      const saldo = s.gp - s.gc;
      const saldoCls = saldo > 0 ? 'positive' : saldo < 0 ? 'negative' : '';
      const saldoStr = saldo > 0 ? `+${saldo}` : saldo;
      return `
        <tr>
          <td class="col-rank">${i+1}</td>
          <td class="col-team">${team}</td>
          <td class="pts-val">${s.pts}</td>
          <td>${s.jogos}</td>
          <td>${s.v}</td>
          <td>${s.e}</td>
          <td>${s.d}</td>
          <td>${s.gp}</td>
          <td>${s.gc}</td>
          <td class="col-saldo ${saldoCls}">${saldoStr}</td>
        </tr>
      `;
    }).join('');

    const gamesHTML = jogos.map(j => {
      const cls = j.disputado ? '' : 'pendente';
      const score = j.disputado
        ? `<span class="gg-score">${j.gols1} – ${j.gols2}</span>`
        : `<span class="gg-score pendente">— —</span>`;
      const dataStr = (j.data || '').split(' - ')[0] || '';
      return `
        <div class="group-game ${cls}">
          <span class="gg-date">${dataStr}</span>
          <span class="gg-team1">${j.time1}</span>
          ${score}
          <span class="gg-team2">${j.time2}</span>
        </div>
      `;
    }).join('');

    return `
      <article class="group-card">
        <div class="group-card-head">
          <h3>Grupo ${g}</h3>
          <span class="group-progress ${completo ? 'completo' : ''}">${disputados}/${jogos.length} jogos</span>
        </div>
        <table class="group-standings">
          <thead>
            <tr><th></th><th></th><th>pts</th><th>j</th><th>v</th><th>e</th><th>d</th><th>gp</th><th>gc</th><th>sg</th></tr>
          </thead>
          <tbody>${standingsHTML}</tbody>
        </table>
        <div class="group-games">${gamesHTML}</div>
      </article>
    `;
  }).join('');
}

// ============= RENDER: PALPITES =============
async function loadPalpites() {
  try {
    const [t, g] = await Promise.all([
      fetch('data/palpites_todos.json?t=' + Date.now()).then(r => r.json()),
      fetch('data/palpite_guto.json?t=' + Date.now()).then(r => r.json()),
    ]);
    DATA_PALPITES = t;
    DATA_PALPITE_GUTO = g;
    renderPalpitesList();
  } catch (err) {
    console.error(err);
    document.getElementById('palpites-list').innerHTML = `<p style="color: var(--red); padding: 14px;">Erro: ${err.message}</p>`;
  }
}

function renderPalpitesList() {
  const ranking = DATA_RANKING.ranking;
  const q = document.getElementById('palpites-search').value.toLowerCase().trim();

  const filtrados = ranking.filter(r => !q || r.jogador.toLowerCase().includes(q));
  document.getElementById('palpites-list').innerHTML = filtrados.map(r => `
    <button class="palpite-item ${r.jogador === GUTO ? 'is-guto' : ''} ${selectedPalpite === r.jogador ? 'active' : ''}"
            data-name="${r.jogador.replace(/"/g, '&quot;')}">
      <span class="palpite-item-name">${r.jogador}</span>
      <span class="palpite-item-pos">${r.pos_label} · ${r.total} pts</span>
    </button>
  `).join('');

  document.querySelectorAll('.palpite-item').forEach(btn => {
    btn.addEventListener('click', () => selectPalpite(btn.dataset.name));
  });
}

function selectPalpite(nome) {
  selectedPalpite = nome;
  renderPalpitesList();

  // Encontrar palpite: pode ser pela aba (DATA_PALPITES) ou o JSON especial do Guto
  let palpite = DATA_PALPITES[nome];
  if (!palpite && nome === GUTO) palpite = DATA_PALPITE_GUTO;
  if (!palpite) {
    // tentar fuzzy
    const key = Object.keys(DATA_PALPITES).find(k => k.toLowerCase().includes(nome.toLowerCase()));
    if (key) palpite = DATA_PALPITES[key];
  }
  if (!palpite) {
    document.getElementById('palpites-content').innerHTML = `<p style="color: var(--text-muted);">Palpite não encontrado.</p>`;
    return;
  }

  renderPalpiteDetalhe(nome, palpite);
}

function renderPalpiteDetalhe(nome, p) {
  const r = DATA_RANKING.ranking.find(x => x.jogador === nome);
  const posTotal = r ? `${r.pos_label} · ${r.total} pts` : '';

  // Grupos
  const gruposLetras = Object.keys(p.grupos).sort();
  const gruposHTML = gruposLetras.map(g => {
    const info = p.grupos[g];
    const cls = info.classificacao || (info.class ? { '1': info.class[0], '2': info.class[1], '3': info.class[2] } : {});
    const jogosHTML = (info.jogos || []).map(j => {
      let t1, g1, g2, t2;
      if (Array.isArray(j)) { [t1, g1, g2, t2] = j; }
      else { t1 = j.time1; g1 = j.gols1; g2 = j.gols2; t2 = j.time2; }
      return `
        <div class="group-game">
          <span class="gg-date">·</span>
          <span class="gg-team1">${t1}</span>
          <span class="gg-score">${g1 ?? '—'} – ${g2 ?? '—'}</span>
          <span class="gg-team2">${t2}</span>
        </div>
      `;
    }).join('');
    return `
      <article class="group-card" style="margin-bottom: 16px;">
        <div class="group-card-head">
          <h3>Grupo ${g}</h3>
          <span class="group-progress">1º ${cls['1'] || '?'} · 2º ${cls['2'] || '?'} · 3º ${cls['3'] || '?'}</span>
        </div>
        <div class="group-games">${jogosHTML}</div>
      </article>
    `;
  }).join('');

  // Mata-mata
  const matamataHTML = renderMataMataPalpite(p);

  // Bônus
  const bonus = p.bonus || {};
  const bonusHTML = `
    <div class="bonus-grid">
      <div class="bonus-card">
        <div class="bonus-card-label">artilheiro</div>
        <div class="bonus-card-val ${bonus.artilheiro ? '' : 'empty'}">${bonus.artilheiro || '—'}</div>
      </div>
      <div class="bonus-card">
        <div class="bonus-card-label">gols do artilheiro</div>
        <div class="bonus-card-val ${bonus.gols_artilheiro ? '' : 'empty'}">${bonus.gols_artilheiro || '—'}</div>
      </div>
      <div class="bonus-card">
        <div class="bonus-card-label">melhor ataque</div>
        <div class="bonus-card-val ${bonus.melhor_ataque ? '' : 'empty'}">${bonus.melhor_ataque || '—'}</div>
      </div>
      <div class="bonus-card">
        <div class="bonus-card-label">melhor defesa</div>
        <div class="bonus-card-val ${bonus.melhor_defesa ? '' : 'empty'}">${bonus.melhor_defesa || '—'}</div>
      </div>
      <div class="bonus-card">
        <div class="bonus-card-label">total de gols</div>
        <div class="bonus-card-val ${bonus.total_gols ? '' : 'empty'}">${bonus.total_gols || '—'}</div>
      </div>
    </div>
  `;

  // Campeão / Vice
  const finalHTML = `
    <div class="palpite-final">
      <div class="palpite-final-item">
        <div class="palpite-final-label">campeão</div>
        <div class="palpite-final-team">${p.campeao || '—'}</div>
      </div>
      <div class="palpite-final-item">
        <div class="palpite-final-label">vice</div>
        <div class="palpite-final-team">${p.vice || '—'}</div>
      </div>
    </div>
  `;

  document.getElementById('palpites-content').innerHTML = `
    <div class="palpite-head">
      <div>
        <div class="palpite-head-name">${nome}</div>
        <div class="view-sub" style="margin-top: 4px;">${posTotal}</div>
      </div>
    </div>
    ${finalHTML}
    <div class="palpite-section">
      <h3 class="palpite-section-title">bônus</h3>
      ${bonusHTML}
    </div>
    <div class="palpite-section">
      <h3 class="palpite-section-title">mata-mata</h3>
      ${matamataHTML}
    </div>
    <div class="palpite-section">
      <h3 class="palpite-section-title">fase de grupos</h3>
      ${gruposHTML}
    </div>
  `;
}

function renderMataMataPalpite(p) {
  const sections = [
    ['fase de 32', p.fase_32],
    ['oitavas', p.oitavas],
    ['quartas', p.quartas],
    ['semifinais', p.semifinais],
    ['3º lugar', p.terceiro_lugar ? [p.terceiro_lugar] : []],
    ['final', p.final ? [p.final] : []],
  ];
  return sections.map(([label, jogos]) => {
    if (!jogos || !jogos.length) return '';
    const rows = jogos.map(j => {
      const t1 = j.time1, t2 = j.time2;
      const g1 = (j.g90 && j.g90[0]) ?? (j.gols90 && j.gols90[0]);
      const g2 = (j.g90 && j.g90[1]) ?? (j.gols90 && j.gols90[1]);
      const pen1 = (j.pen && j.pen[0]) ?? (j.penaltis && j.penaltis[0]);
      const pen2 = (j.pen && j.pen[1]) ?? (j.penaltis && j.penaltis[1]);
      const penStr = (pen1 != null && pen2 != null) ? `<span class="bracket-pen">(${pen1}-${pen2})</span>` : '';
      return `
        <div class="bracket-row">
          <span class="bracket-phase">${label}</span>
          <span class="bracket-team1">${t1 || '—'}</span>
          <span class="bracket-score">${g1 ?? '—'} – ${g2 ?? '—'}${penStr}</span>
          <span class="bracket-team2">${t2 || '—'}</span>
        </div>
      `;
    }).join('');
    return `<div style="border:1px solid var(--border-dim); margin-bottom: 8px;">${rows}</div>`;
  }).join('');
}

// ============= INTERACTIONS =============
function setupTabs() {
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => showView(t.dataset.view));
  });
}

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

  // Palpites search
  const psearch = document.getElementById('palpites-search');
  if (psearch) psearch.addEventListener('input', renderPalpitesList);
}

// ============= INIT =============
async function init() {
  try {
    const resp = await fetch('data/ranking_calculado.json?t=' + Date.now());
    if (!resp.ok) throw new Error(`Erro ${resp.status}`);
    DATA_RANKING = await resp.json();
    renderTopbar();
    renderHero();
    renderTable();
    setupTabs();
    setupFilters();
  } catch (err) {
    console.error(err);
    document.getElementById('ranking-body').innerHTML = `
      <tr><td colspan="8" style="padding: 40px; text-align: center; color: var(--red);">
        Não consegui carregar os dados.<br>
        <small style="color: var(--text-muted); font-family: var(--font-mono);">${err.message}</small>
      </td></tr>
    `;
  }
}

init();
