// =========== Bolão Copa 2026 — Tracker UI ===========

// "EU" = participante em foco. Persistido em localStorage. Default: Guto.
let EU = localStorage.getItem('bolao_eu') || 'Guto';

let DATA_RANKING = null;        // ranking oficial (do JSON)
let DATA_GABARITO = null;
let DATA_PALPITES = null;
let DATA_PALPITE_GUTO = null;
let DATA_TABELAO = null;
let currentFilter = 'all';
let currentView = 'ranking';
let selectedPalpite = null;

// Estado do simulador: {grupo|t1|t2: [g1,g2]}
let SIM_RESULTS = {};
let SIM_ACTIVE = false;

// ============= UTILS =============
function deltaCell(delta) {
  if (delta === null || delta === undefined || delta === 0) return '<span class="delta flat">–</span>';
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

// O ranking "ativo": se simulação ligada, usa o simulado; senão o oficial
function activeRanking() {
  return SIM_ACTIVE && SIM_RANKING ? SIM_RANKING : DATA_RANKING.ranking;
}

// ============= SELETOR DE PARTICIPANTE =============
function setupParticipantSelector() {
  const sel = document.getElementById('eu-select');
  if (!sel) return;
  // popula com todos os participantes em ordem alfabética
  const nomes = DATA_RANKING.ranking.map(r => r.jogador).sort((a, b) =>
    a.localeCompare(b, 'pt-BR'));
  sel.innerHTML = nomes.map(n => `<option value="${n.replace(/"/g,'&quot;')}">${n}</option>`).join('');
  sel.value = EU;
  sel.addEventListener('change', () => {
    EU = sel.value;
    localStorage.setItem('bolao_eu', EU);
    // re-render tudo que depende de EU
    renderHero();
    renderTable();
    if (DATA_TABELAO) renderTabelao();
    if (SIM_ACTIVE) renderSimulador();
  });
}

// ============= RANKING =============
function renderTopbar() {
  document.getElementById('meta-jogos').textContent = `${DATA_RANKING.jogos_disputados}/104`;
  document.getElementById('meta-part').textContent = DATA_RANKING.total_participantes;
  document.getElementById('meta-data').textContent = formatDate(DATA_RANKING.data_atualizacao);
}

function renderHero() {
  const ranking = activeRanking();
  const eu = ranking.find(r => r.jogador === EU);
  if (!eu) return;

  document.getElementById('hero-name').textContent = eu.jogador;
  document.getElementById('hero-pos').textContent = eu.pos;
  document.getElementById('hero-of').textContent = ranking.length;
  document.getElementById('hero-pts').textContent = eu.total;

  const deltaEl = document.getElementById('hero-delta');
  const deltaWrapLabel = document.querySelector('.hero-delta-label');
  if (SIM_ACTIVE) {
    // No modo simulação, o "delta" mostra a mudança vs posição oficial
    const oficial = DATA_RANKING.ranking.find(r => r.jogador === EU);
    const d = oficial ? oficial.pos - eu.pos : null;
    if (d === null || d === 0) { deltaEl.textContent = '–'; deltaEl.className = 'hero-delta-num'; }
    else { deltaEl.textContent = `${d>0?'▲':'▼'}${Math.abs(d)}`; deltaEl.className = 'hero-delta-num ' + (d>0?'up':'down'); }
    if (deltaWrapLabel) deltaWrapLabel.textContent = 'vs real (sim)';
  } else {
    const delta = eu.delta;
    if (delta === null || delta === undefined || delta === 0) { deltaEl.textContent = '–'; deltaEl.className = 'hero-delta-num'; }
    else { deltaEl.textContent = `${delta>0?'▲':'▼'}${Math.abs(delta)}`; deltaEl.className = 'hero-delta-num ' + (delta>0?'up':'down'); }
    if (deltaWrapLabel) deltaWrapLabel.textContent = 'última rodada';
  }

  const leader = ranking[0];
  document.getElementById('stat-leader').textContent = leader.jogador.split(' ')[0];
  document.getElementById('stat-leader-gap').textContent =
    eu.pos === 1 ? '· liderança' : `${eu.total - leader.total} pts (${leader.total} líder)`;

  const top3 = ranking[2] || ranking[ranking.length - 1];
  document.getElementById('stat-top3').textContent = `${top3.total} pts`;
  document.getElementById('stat-top3-gap').textContent =
    eu.pos <= 3 ? '· você está no top 3' : `${eu.total - top3.total} pts até o pódio`;

  const median = ranking[Math.floor(ranking.length / 2)];
  document.getElementById('stat-median').textContent = `${median.total} pts`;
  document.getElementById('stat-median-gap').textContent =
    eu.total > median.total ? `+${eu.total - median.total} pts acima`
    : eu.total < median.total ? `${eu.total - median.total} pts abaixo` : 'na mediana';
}

function getFiltered() {
  const all = activeRanking();
  const eu = all.find(r => r.jogador === EU);
  if (currentFilter === 'top10') return all.slice(0, 10);
  if (currentFilter === 'neighbors') {
    if (!eu) return all;
    const idx = all.indexOf(eu);
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
  const ranking = activeRanking();
  const leaderTotal = ranking[0].total;
  const oficialMap = {};
  DATA_RANKING.ranking.forEach(r => { oficialMap[r.jogador] = r.pos; });
  const body = document.getElementById('ranking-body');
  body.innerHTML = filtered.map(r => {
    const isEu = r.jogador === EU;
    const gap = leaderTotal - r.total;
    const gapCell = gap === 0 ? '<span class="col-gap zero">·</span>' : `-${gap}`;
    const bd = r.breakdown || {
      fase_grupos_jogos: r.fase_grupos_jogos, fase_grupos_classificacao: r.fase_grupos_classificacao,
      mata_mata: r.mata_mata, bonus: r.bonus };
    // Coluna delta: no modo sim, mostra mudança vs oficial; senão delta de rodada
    let deltaTd;
    if (SIM_ACTIVE) {
      const d = oficialMap[r.jogador] !== undefined ? oficialMap[r.jogador] - r.pos : null;
      deltaTd = deltaCell(d);
    } else {
      deltaTd = deltaCell(r.delta);
    }
    return `
      <tr class="${isEu ? 'is-guto' : ''}">
        <td class="col-delta">${deltaTd}</td>
        <td class="col-pos">${r.pos_label}</td>
        <td class="col-name">${r.jogador}</td>
        <td class="col-num col-total">${r.total}</td>
        <td class="col-num col-breakdown col-hide-mobile">${emptyOr(bd.fase_grupos_jogos)}</td>
        <td class="col-num col-breakdown col-hide-mobile">${emptyOr(bd.fase_grupos_classificacao)}</td>
        <td class="col-num col-breakdown col-hide-mobile">${emptyOr(bd.mata_mata)}</td>
        <td class="col-num col-breakdown col-hide-mobile">${emptyOr(bd.bonus)}</td>
        <td class="col-num col-gap">${gapCell}</td>
      </tr>`;
  }).join('');
}

// ============= TABS / VIEWS =============
function showView(view) {
  currentView = view;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.hidden = v.dataset.view !== view);
  if (view === 'gabarito' && !DATA_GABARITO) loadGabarito();
  else if (view === 'gabarito') renderGabarito();
  if (view === 'tabelao' && !DATA_TABELAO) loadTabelao();
  if (view === 'palpites' && !DATA_PALPITES) loadPalpites();
  if (view === 'simulador') loadSimulador();
}

// ============= GABARITO =============
async function loadGabarito() {
  try {
    const resp = await fetch('data/gabarito_atual.json?t=' + Date.now());
    DATA_GABARITO = await resp.json();
    renderGabarito();
  } catch (err) {
    document.getElementById('groups-grid').innerHTML = `<p style="color: var(--red);">Erro: ${err.message}</p>`;
  }
}

function calcStandings(jogos) {
  const times = {};
  jogos.forEach(j => {
    if (!j.disputado) return;
    [j.time1, j.time2].forEach(t => { if (!times[t]) times[t] = {pts:0,gp:0,gc:0,jogos:0,v:0,e:0,d:0}; });
    times[j.time1].gp += j.gols1; times[j.time1].gc += j.gols2; times[j.time1].jogos++;
    times[j.time2].gp += j.gols2; times[j.time2].gc += j.gols1; times[j.time2].jogos++;
    if (j.gols1 > j.gols2) { times[j.time1].pts += 3; times[j.time1].v++; times[j.time2].d++; }
    else if (j.gols2 > j.gols1) { times[j.time2].pts += 3; times[j.time2].v++; times[j.time1].d++; }
    else { times[j.time1].pts++; times[j.time2].pts++; times[j.time1].e++; times[j.time2].e++; }
  });
  const todosTimes = new Set();
  jogos.forEach(j => { todosTimes.add(j.time1); todosTimes.add(j.time2); });
  todosTimes.forEach(t => { if (!times[t]) times[t] = {pts:0,gp:0,gc:0,jogos:0,v:0,e:0,d:0}; });
  return Object.entries(times).sort(([,a],[,b]) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const sda=a.gp-a.gc, sdb=b.gp-b.gc;
    if (sdb !== sda) return sdb - sda;
    return b.gp - a.gp;
  });
}

function renderGabarito() {
  if (!DATA_GABARITO) return;
  const jpg = {};
  DATA_GABARITO.jogos_grupos.forEach(j => { (jpg[j.grupo]=jpg[j.grupo]||[]).push(j); });
  const grupos = Object.keys(jpg).sort();
  document.getElementById('groups-grid').innerHTML = grupos.map(g => {
    const jogos = jpg[g];
    const disputados = jogos.filter(j=>j.disputado).length;
    const completo = disputados === jogos.length;
    const standings = calcStandings(jogos);
    const standingsHTML = standings.map(([team,s],i) => {
      const saldo = s.gp-s.gc;
      const saldoCls = saldo>0?'positive':saldo<0?'negative':'';
      const saldoStr = saldo>0?`+${saldo}`:saldo;
      return `<tr><td class="col-rank">${i+1}</td><td class="col-team">${team}</td>
        <td class="pts-val">${s.pts}</td><td>${s.jogos}</td><td>${s.v}</td><td>${s.e}</td>
        <td>${s.d}</td><td>${s.gp}</td><td>${s.gc}</td>
        <td class="col-saldo ${saldoCls}">${saldoStr}</td></tr>`;
    }).join('');
    const gamesHTML = jogos.map(j => {
      const cls = j.disputado?'':'pendente';
      const score = j.disputado ? `<span class="gg-score">${j.gols1} – ${j.gols2}</span>`
        : `<span class="gg-score pendente">— —</span>`;
      const dataStr = (j.data||'').split(' - ')[0]||'';
      return `<div class="group-game ${cls}"><span class="gg-date">${dataStr}</span>
        <span class="gg-team1">${j.time1}</span>${score}<span class="gg-team2">${j.time2}</span></div>`;
    }).join('');
    return `<article class="group-card"><div class="group-card-head"><h3>Grupo ${g}</h3>
      <span class="group-progress ${completo?'completo':''}">${disputados}/${jogos.length} jogos</span></div>
      <table class="group-standings"><thead><tr><th></th><th></th><th>pts</th><th>j</th><th>v</th>
      <th>e</th><th>d</th><th>gp</th><th>gc</th><th>sg</th></tr></thead><tbody>${standingsHTML}</tbody></table>
      <div class="group-games">${gamesHTML}</div></article>`;
  }).join('');
}

// ============= TABELÃO =============
async function loadTabelao() {
  try {
    const resp = await fetch('data/tabelao.json?t=' + Date.now());
    if (!resp.ok) throw new Error(`Erro ${resp.status}`);
    DATA_TABELAO = await resp.json();
    renderTabelao();
  } catch (err) {
    document.getElementById('tabelao-wrap').innerHTML =
      `<div class="tabelao-loading" style="color: var(--red);">Erro: ${err.message}</div>`;
  }
}

function ptsClass(pts) {
  if (pts === null || pts === undefined) return 'pts-fut';
  if (pts === 12) return 'pts-12';
  if (pts === 9) return 'pts-9';
  if (pts === 7) return 'pts-7';
  return 'pts-0';
}

function renderTabelao() {
  if (!DATA_TABELAO) return;
  const { colunas, linhas } = DATA_TABELAO;
  const grupoStart = colunas.map((c,i) => i===0 || c.grupo !== colunas[i-1].grupo);
  const headCells = colunas.map((c,i) => {
    const cls = `th-game ${c.disputado?'disputado':''} ${grupoStart[i]?'grupo-start':''}`;
    const realStr = c.disputado ? `<span class="th-game-real">${c.real[0]}-${c.real[1]}</span>`
      : `<span class="th-game-real pendente">·</span>`;
    return `<th class="${cls}"><div class="th-game-inner">
      <span class="th-game-teams">${c.time1.slice(0,3).toUpperCase()} × ${c.time2.slice(0,3).toUpperCase()}</span>
      <span class="th-game-grupo">${c.grupo}</span>${realStr}</div></th>`;
  }).join('');
  const bodyRows = linhas.map(l => {
    const isEu = l.jogador === EU;
    const cells = l.cells.map((cell,i) => {
      const gs = grupoStart[i]?'grupo-start':'';
      if (cell.p === null) return `<td class="td-cell empty ${gs}">·</td>`;
      const cls = ptsClass(cell.pts);
      return `<td class="td-cell ${cls} ${gs}" title="${l.jogador}: ${cell.p[0]}-${cell.p[1]}${cell.pts!==null?' ('+cell.pts+'pts)':''}">${cell.p[0]}-${cell.p[1]}</td>`;
    }).join('');
    return `<tr class="${isEu?'is-guto':''}" data-name="${l.jogador.replace(/"/g,'&quot;')}">
      <td class="td-name"><span class="td-name-pos">${l.pos}</span>${l.jogador}</td>${cells}</tr>`;
  }).join('');
  document.getElementById('tabelao-wrap').innerHTML = `<table class="tabelao-table"><thead><tr>
    <th class="th-name"><div class="th-name-inner"><span class="th-name-label">apostador</span></div></th>
    ${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function filterTabelao() {
  const q = document.getElementById('tabelao-search').value.toLowerCase().trim();
  document.querySelectorAll('.tabelao-table tbody tr').forEach(tr => {
    tr.style.display = (!q || tr.dataset.name.toLowerCase().includes(q)) ? '' : 'none';
  });
}

// ============= PALPITES =============
async function loadPalpites() {
  try {
    const [t, g] = await Promise.all([
      fetch('data/palpites_todos.json?t=' + Date.now()).then(r => r.json()),
      fetch('data/palpite_guto.json?t=' + Date.now()).then(r => r.json()),
    ]);
    DATA_PALPITES = t;
    DATA_PALPITE_GUTO = g;
    if (!selectedPalpite) selectedPalpite = EU;
    renderPalpitesList();
    selectPalpite(selectedPalpite);
  } catch (err) {
    document.getElementById('palpites-list').innerHTML = `<p style="color: var(--red); padding: 14px;">Erro: ${err.message}</p>`;
  }
}

function renderPalpitesList() {
  const ranking = DATA_RANKING.ranking;
  const q = document.getElementById('palpites-search').value.toLowerCase().trim();
  const filtrados = ranking.filter(r => !q || r.jogador.toLowerCase().includes(q));
  document.getElementById('palpites-list').innerHTML = filtrados.map(r => `
    <button class="palpite-item ${r.jogador===EU?'is-guto':''} ${selectedPalpite===r.jogador?'active':''}"
            data-name="${r.jogador.replace(/"/g,'&quot;')}">
      <span class="palpite-item-name">${r.jogador}</span>
      <span class="palpite-item-pos">${r.pos_label} · ${r.total} pts</span>
    </button>`).join('');
  document.querySelectorAll('.palpite-item').forEach(btn => {
    btn.addEventListener('click', () => selectPalpite(btn.dataset.name));
  });
}

function findPalpite(nome) {
  let palpite = DATA_PALPITES[nome];
  if (!palpite && nome === 'Guto') palpite = DATA_PALPITE_GUTO;
  if (!palpite) {
    const key = Object.keys(DATA_PALPITES).find(k => k.toLowerCase() === nome.toLowerCase());
    if (key) palpite = DATA_PALPITES[key];
  }
  return palpite;
}

function selectPalpite(nome) {
  selectedPalpite = nome;
  renderPalpitesList();
  const palpite = findPalpite(nome);
  if (!palpite) {
    document.getElementById('palpites-content').innerHTML = `<p style="color: var(--text-muted);">Palpite não encontrado.</p>`;
    return;
  }
  renderPalpiteDetalhe(nome, palpite);
}

function renderPalpiteDetalhe(nome, p) {
  const r = DATA_RANKING.ranking.find(x => x.jogador === nome);
  const posTotal = r ? `${r.pos_label} · ${r.total} pts` : '';
  const gruposLetras = Object.keys(p.grupos).sort();
  const gruposHTML = gruposLetras.map(g => {
    const info = p.grupos[g];
    const cls = info.classificacao || (info.class ? {'1':info.class[0],'2':info.class[1],'3':info.class[2]} : {});
    const jogosHTML = (info.jogos||[]).map(j => {
      let t1,g1,g2,t2;
      if (Array.isArray(j)) { [t1,g1,g2,t2]=j; } else { t1=j.time1;g1=j.gols1;g2=j.gols2;t2=j.time2; }
      return `<div class="group-game"><span class="gg-date">·</span><span class="gg-team1">${t1}</span>
        <span class="gg-score">${g1??'—'} – ${g2??'—'}</span><span class="gg-team2">${t2}</span></div>`;
    }).join('');
    return `<article class="group-card" style="margin-bottom:16px;"><div class="group-card-head">
      <h3>Grupo ${g}</h3><span class="group-progress">1º ${cls['1']||'?'} · 2º ${cls['2']||'?'} · 3º ${cls['3']||'?'}</span>
      </div><div class="group-games">${jogosHTML}</div></article>`;
  }).join('');
  const matamataHTML = renderMataMataPalpite(p);
  const bonus = p.bonus || {};
  const bcard = (label, val) => `<div class="bonus-card"><div class="bonus-card-label">${label}</div>
    <div class="bonus-card-val ${val?'':'empty'}">${val||'—'}</div></div>`;
  const bonusHTML = `<div class="bonus-grid">
    ${bcard('artilheiro', bonus.artilheiro)}${bcard('gols do artilheiro', bonus.gols_artilheiro)}
    ${bcard('melhor ataque', bonus.melhor_ataque)}${bcard('melhor defesa', bonus.melhor_defesa)}
    ${bcard('total de gols', bonus.total_gols)}</div>`;
  const finalHTML = `<div class="palpite-final">
    <div class="palpite-final-item"><div class="palpite-final-label">campeão</div>
    <div class="palpite-final-team">${p.campeao||'—'}</div></div>
    <div class="palpite-final-item"><div class="palpite-final-label">vice</div>
    <div class="palpite-final-team">${p.vice||'—'}</div></div></div>`;
  document.getElementById('palpites-content').innerHTML = `
    <div class="palpite-head"><div><div class="palpite-head-name">${nome}</div>
    <div class="view-sub" style="margin-top:4px;">${posTotal}</div></div></div>
    ${finalHTML}
    <div class="palpite-section"><h3 class="palpite-section-title">bônus</h3>${bonusHTML}</div>
    <div class="palpite-section"><h3 class="palpite-section-title">mata-mata</h3>${matamataHTML}</div>
    <div class="palpite-section"><h3 class="palpite-section-title">fase de grupos</h3>${gruposHTML}</div>`;
}

function renderMataMataPalpite(p) {
  const sections = [
    ['fase de 32', p.fase_32],['oitavas', p.oitavas],['quartas', p.quartas],
    ['semifinais', p.semifinais],['3º lugar', p.terceiro_lugar?[p.terceiro_lugar]:[]],
    ['final', p.final?[p.final]:[]],
  ];
  return sections.map(([label, jogos]) => {
    if (!jogos || !jogos.length) return '';
    const rows = jogos.map(j => {
      const t1=j.time1, t2=j.time2;
      const g1=(j.g90&&j.g90[0])??(j.gols90&&j.gols90[0]);
      const g2=(j.g90&&j.g90[1])??(j.gols90&&j.gols90[1]);
      const pen1=(j.pen&&j.pen[0])??(j.penaltis&&j.penaltis[0]);
      const pen2=(j.pen&&j.pen[1])??(j.penaltis&&j.penaltis[1]);
      const penStr=(pen1!=null&&pen2!=null)?`<span class="bracket-pen">(${pen1}-${pen2})</span>`:'';
      return `<div class="bracket-row"><span class="bracket-phase">${label}</span>
        <span class="bracket-team1">${t1||'—'}</span>
        <span class="bracket-score">${g1??'—'} – ${g2??'—'}${penStr}</span>
        <span class="bracket-team2">${t2||'—'}</span></div>`;
    }).join('');
    return `<div style="border:1px solid var(--border-dim);margin-bottom:8px;">${rows}</div>`;
  }).join('');
}

// ============= SIMULADOR =============
let SIM_RANKING = null;

async function loadSimulador() {
  // precisa de palpites_todos + gabarito carregados
  if (!DATA_PALPITES) {
    try {
      DATA_PALPITES = await fetch('data/palpites_todos.json?t='+Date.now()).then(r=>r.json());
      DATA_PALPITE_GUTO = await fetch('data/palpite_guto.json?t='+Date.now()).then(r=>r.json());
    } catch(e) {}
  }
  if (!DATA_GABARITO) {
    try { DATA_GABARITO = await fetch('data/gabarito_atual.json?t='+Date.now()).then(r=>r.json()); } catch(e) {}
  }
  renderSimulador();
}

// Constrói um gabarito hipotético aplicando SIM_RESULTS sobre o real
function buildGabaritoSimulado() {
  const sim = JSON.parse(JSON.stringify(DATA_GABARITO));
  for (const j of sim.jogos_grupos) {
    const key = `${j.grupo}|${j.time1}|${j.time2}`;
    if (SIM_RESULTS[key]) {
      j.gols1 = SIM_RESULTS[key][0];
      j.gols2 = SIM_RESULTS[key][1];
      j.disputado = true;
    }
  }
  return sim;
}

function recalcSimulacao() {
  const palpitesParaUsar = {};
  // injeta o palpite do Guto (vem de arquivo separado) no conjunto se necessário
  Object.assign(palpitesParaUsar, DATA_PALPITES);
  if (DATA_PALPITE_GUTO && !palpitesParaUsar['Guto']) palpitesParaUsar['Guto'] = DATA_PALPITE_GUTO;

  const gabSim = buildGabaritoSimulado();
  SIM_RANKING = computeRankingJS(palpitesParaUsar, gabSim, null);
  SIM_ACTIVE = Object.keys(SIM_RESULTS).length > 0;
}

function renderSimulador() {
  if (!DATA_GABARITO || !DATA_PALPITES) {
    document.getElementById('sim-content').innerHTML = '<p class="tabelao-loading">carregando dados...</p>';
    return;
  }
  recalcSimulacao();

  // Jogos pendentes (não disputados no gabarito REAL)
  const pendentes = DATA_GABARITO.jogos_grupos.filter(j => !j.disputado);
  const jpg = {};
  pendentes.forEach(j => { (jpg[j.grupo]=jpg[j.grupo]||[]).push(j); });
  const grupos = Object.keys(jpg).sort();

  const jogosHTML = grupos.map(g => {
    const linhasJogos = jpg[g].map(j => {
      const key = `${j.grupo}|${j.time1}|${j.time2}`;
      const sim = SIM_RESULTS[key];
      const v1 = sim ? sim[0] : '';
      const v2 = sim ? sim[1] : '';
      const dataStr = (j.data||'').split(' - ')[0]||'';
      return `<div class="sim-game">
        <span class="sim-date">${dataStr}</span>
        <span class="sim-team sim-team1">${j.time1}</span>
        <input type="number" min="0" max="20" class="sim-input" data-key="${key}" data-side="0" value="${v1}" placeholder="–">
        <span class="sim-x">×</span>
        <input type="number" min="0" max="20" class="sim-input" data-key="${key}" data-side="1" value="${v2}" placeholder="–">
        <span class="sim-team sim-team2">${j.time2}</span>
      </div>`;
    }).join('');
    return `<div class="sim-group"><div class="sim-group-head">Grupo ${g}</div>${linhasJogos}</div>`;
  }).join('');

  const preenchidos = Object.keys(SIM_RESULTS).length;
  document.getElementById('sim-jogos').innerHTML = `
    <div class="sim-jogos-head">
      <span>${pendentes.length} jogos pendentes · ${preenchidos} preenchidos</span>
      <button class="filter-action" id="sim-clear">limpar tudo</button>
    </div>
    ${jogosHTML || '<p class="tabelao-loading">Todos os jogos de grupos já foram disputados.</p>'}`;

  // Painel de impacto
  renderSimImpacto();

  // Re-wire inputs
  document.querySelectorAll('.sim-input').forEach(inp => {
    inp.addEventListener('input', onSimInput);
  });
  const clearBtn = document.getElementById('sim-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    SIM_RESULTS = {}; renderSimulador(); renderHero(); renderTable();
  });
}

function onSimInput(e) {
  const key = e.target.dataset.key;
  const side = parseInt(e.target.dataset.side);
  const val = e.target.value === '' ? null : parseInt(e.target.value);
  // pega o par atual
  const cur = SIM_RESULTS[key] || [null, null];
  cur[side] = val;
  // só registra o jogo se AMBOS os lados estiverem preenchidos
  if (cur[0] === null && cur[1] === null) {
    delete SIM_RESULTS[key];
  } else {
    SIM_RESULTS[key] = cur;
  }
  // recalcula só o impacto e o ranking, sem re-renderizar os inputs (não perde foco)
  recalcSimulacao();
  renderSimImpacto();
  renderHero();
  renderTable();
  // atualiza contador
  const head = document.querySelector('.sim-jogos-head span');
  if (head) {
    const pend = DATA_GABARITO.jogos_grupos.filter(j=>!j.disputado).length;
    const cheios = Object.values(SIM_RESULTS).filter(v => v[0]!==null && v[1]!==null).length;
    head.textContent = `${pend} jogos pendentes · ${cheios} preenchidos`;
  }
}

function renderSimImpacto() {
  // Considera apenas jogos com AMBOS placares preenchidos
  const validos = Object.entries(SIM_RESULTS).filter(([,v]) => v[0]!==null && v[1]!==null);
  const euOficial = DATA_RANKING.ranking.find(r => r.jogador === EU);
  const euSim = SIM_RANKING ? SIM_RANKING.find(r => r.jogador === EU) : null;

  renderSimRanking();

  if (validos.length === 0 || !euSim) {
    document.getElementById('sim-impacto').innerHTML = `
      <div class="sim-impacto-empty">
        <p>Preencha os placares dos jogos ao lado para ver o impacto no seu desempenho.</p>
        <p class="view-sub" style="margin-top:8px;">Foco atual: <strong>${EU}</strong> · ${euOficial?euOficial.pos_label:'–'} · ${euOficial?euOficial.total:'–'} pts</p>
      </div>`;
    return;
  }

  const dPos = euOficial.pos - euSim.pos;   // + = subiu
  const dPts = euSim.total - euOficial.total;
  const posArrow = dPos>0?'▲':dPos<0?'▼':'–';
  const posCls = dPos>0?'up':dPos<0?'down':'flat';

  document.getElementById('sim-impacto').innerHTML = `
    <div class="sim-impacto-card">
      <div class="sim-impacto-title">impacto em ${EU}</div>
      <div class="sim-impacto-grid">
        <div class="sim-metric">
          <span class="sim-metric-label">posição</span>
          <span class="sim-metric-now">${euOficial.pos_label} → ${euSim.pos_label}</span>
          <span class="sim-metric-delta ${posCls}">${posArrow} ${Math.abs(dPos)||'0'}</span>
        </div>
        <div class="sim-metric">
          <span class="sim-metric-label">pontos</span>
          <span class="sim-metric-now">${euOficial.total} → ${euSim.total}</span>
          <span class="sim-metric-delta ${dPts>0?'up':dPts<0?'down':'flat'}">+${dPts}</span>
        </div>
      </div>
      <div class="view-sub" style="margin-top:14px;">${validos.length} jogo(s) simulado(s) · o ranking ao lado reflete os resultados hipotéticos</div>
    </div>`;
}

function renderSimRanking() {
  if (!SIM_RANKING) return;
  const ranking = SIM_ACTIVE ? SIM_RANKING : DATA_RANKING.ranking;
  const leaderTotal = ranking[0].total;
  const oficialMap = {};
  DATA_RANKING.ranking.forEach(r => { oficialMap[r.jogador] = r.pos; });
  const body = document.getElementById('sim-ranking-body');
  if (!body) return;
  body.innerHTML = ranking.map(r => {
    const isEu = r.jogador === EU;
    const gap = leaderTotal - r.total;
    const gapCell = gap === 0 ? '<span class="col-gap zero">·</span>' : `-${gap}`;
    // delta = mudança vs posição oficial
    const d = oficialMap[r.jogador] !== undefined ? oficialMap[r.jogador] - r.pos : null;
    return `
      <tr class="${isEu ? 'is-guto' : ''}">
        <td class="col-delta">${deltaCell(SIM_ACTIVE ? d : null)}</td>
        <td class="col-pos">${r.pos_label}</td>
        <td class="col-name">${r.jogador}</td>
        <td class="col-num col-total">${r.total}</td>
        <td class="col-num col-gap">${gapCell}</td>
      </tr>`;
  }).join('');
}

// ============= INTERACTIONS =============
function setupTabs() {
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
}

function setupFilters() {
  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      const si = document.getElementById('search-input');
      if (currentFilter === 'search') { si.style.display='inline-block'; si.focus(); }
      else { si.style.display='none'; si.value=''; }
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
  const psearch = document.getElementById('palpites-search');
  if (psearch) psearch.addEventListener('input', renderPalpitesList);
  const tsearch = document.getElementById('tabelao-search');
  if (tsearch) tsearch.addEventListener('input', filterTabelao);
  const tjump = document.getElementById('tabelao-jump-guto');
  if (tjump) tjump.addEventListener('click', () => {
    const row = document.querySelector('.tabelao-table tr.is-guto');
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

// ============= INIT =============
async function init() {
  try {
    const resp = await fetch('data/ranking_calculado.json?t=' + Date.now());
    if (!resp.ok) throw new Error(`Erro ${resp.status}`);
    DATA_RANKING = await resp.json();
    // valida que EU existe; se não, cai pro líder
    if (!DATA_RANKING.ranking.find(r => r.jogador === EU)) {
      EU = DATA_RANKING.ranking[0].jogador;
      localStorage.setItem('bolao_eu', EU);
    }
    renderTopbar();
    setupParticipantSelector();
    renderHero();
    renderTable();
    setupTabs();
    setupFilters();
  } catch (err) {
    console.error(err);
    document.getElementById('ranking-body').innerHTML = `
      <tr><td colspan="9" style="padding:40px;text-align:center;color:var(--red);">
      Não consegui carregar os dados.<br>
      <small style="color:var(--text-muted);font-family:var(--font-mono);">${err.message}</small></td></tr>`;
  }
}

init();
