// =========== Engine de pontuação (porta JS do scoring.py) ===========
// Replica exatamente a lógica do engine Python para permitir simulação
// no navegador. Valida 89/89 contra o ranking_calculado.json oficial.

const PTS_GRUPO_RESULTADO = 7;
const PTS_GRUPO_GOLS_VENC = 9;
const PTS_GRUPO_PLACAR_EXATO = 12;

// ===== Pontuação de um jogo de grupo =====
function scoreMatchGrupo(pG1, pG2, rG1, rG2) {
  if (rG1 === null || rG1 === undefined || rG2 === null || rG2 === undefined) return 0;
  if (pG1 === null || pG1 === undefined || pG2 === null || pG2 === undefined) return 0;
  const res = (a, b) => a === b ? 'E' : (a > b ? 'V1' : 'V2');
  if (res(pG1, pG2) !== res(rG1, rG2)) return 0;
  if (pG1 === rG1 && pG2 === rG2) return PTS_GRUPO_PLACAR_EXATO;
  if (pG1 === pG2) return PTS_GRUPO_RESULTADO;
  return Math.max(pG1, pG2) === Math.max(rG1, rG2) ? PTS_GRUPO_GOLS_VENC : PTS_GRUPO_RESULTADO;
}

// ===== Standings de um grupo (para classificação) =====
function calcStandingsEngine(jogosGrupo) {
  const times = {};
  for (const j of jogosGrupo) {
    if (!j.disputado) continue;
    const { time1: t1, gols1: g1, time2: t2, gols2: g2 } = j;
    for (const t of [t1, t2]) {
      if (!times[t]) times[t] = { pts: 0, gp: 0, gc: 0 };
    }
    times[t1].gp += g1; times[t1].gc += g2;
    times[t2].gp += g2; times[t2].gc += g1;
    if (g1 > g2) times[t1].pts += 3;
    else if (g2 > g1) times[t2].pts += 3;
    else { times[t1].pts += 1; times[t2].pts += 1; }
  }
  return Object.entries(times).sort(([, a], [, b]) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const sa = a.gp - a.gc, sb = b.gp - b.gc;
    if (sb !== sa) return sb - sa;
    return b.gp - a.gp;
  });
}

function scoreClassificacaoGrupo(palpClass, ranking, grupoCompleto) {
  if (!grupoCompleto) return 0;
  const posReal = {};
  ranking.forEach(([t], i) => { posReal[t] = i + 1; });
  let total = 0;
  for (const posPred of ['1', '2', '3']) {
    const team = palpClass[posPred];
    if (!team) continue;
    const curPos = posReal[team];
    if (curPos === undefined) continue;
    if (curPos === parseInt(posPred)) total += 10;
    else if ([1, 2, 3].includes(curPos)) total += 5;
  }
  return total;
}

// ===== Normaliza palpite de grupos (lista compacta → objeto) =====
function palpiteGruposToCells(palpite) {
  // Retorna {grupo: {jogos: [[t1,g1,g2,t2],...], class: {1,2,3}}}
  const out = {};
  for (const [g, info] of Object.entries(palpite.grupos)) {
    let cls;
    if (info.classificacao) cls = info.classificacao;
    else if (info.class) cls = { '1': info.class[0], '2': info.class[1], '3': info.class[2] };
    else cls = {};
    out[g] = { jogos: info.jogos, class: cls };
  }
  return out;
}

// ===== Score de um participante =====
function computeScoreJS(palpite, gabarito) {
  let fgJogos = 0, fgClass = 0;

  // Index do gabarito
  const gabIdx = {};
  for (const j of gabarito.jogos_grupos) {
    gabIdx[`${j.grupo}|${j.time1}|${j.time2}`] = j;
  }

  // Jogos
  const grupos = palpiteGruposToCells(palpite);
  for (const [g, info] of Object.entries(grupos)) {
    for (const jogo of info.jogos) {
      let t1, g1, g2, t2;
      if (Array.isArray(jogo)) { [t1, g1, g2, t2] = jogo; }
      else { t1 = jogo.time1; g1 = jogo.gols1; g2 = jogo.gols2; t2 = jogo.time2; }
      const real = gabIdx[`${g}|${t1}|${t2}`];
      if (!real || !real.disputado) continue;
      fgJogos += scoreMatchGrupo(g1, g2, real.gols1, real.gols2);
    }
  }

  // Classificação (só grupos completos)
  const jogosPorGrupo = {};
  for (const j of gabarito.jogos_grupos) {
    (jogosPorGrupo[j.grupo] = jogosPorGrupo[j.grupo] || []).push(j);
  }
  for (const [g, jg] of Object.entries(jogosPorGrupo)) {
    const completo = jg.every(j => j.disputado);
    if (!completo) continue;
    const ranking = calcStandingsEngine(jg);
    fgClass += scoreClassificacaoGrupo(grupos[g].class, ranking, true);
  }

  return {
    jogador: palpite.jogador,
    total: fgJogos + fgClass,
    fase_grupos_jogos: fgJogos,
    fase_grupos_classificacao: fgClass,
    mata_mata: 0,
    bonus: 0,
  };
}

// ===== Ranking completo + delta =====
function stripAccents(s) {
  return s.toLowerCase()
    .replace(/[áàãâ]/g, 'a').replace(/[éê]/g, 'e').replace(/[íï]/g, 'i')
    .replace(/[óôõ]/g, 'o').replace(/[úü]/g, 'u').replace(/ç/g, 'c');
}

function computeRankingJS(palpitesTodos, gabarito, snapshotAnterior) {
  const resultados = Object.values(palpitesTodos).map(p => computeScoreJS(p, gabarito));

  resultados.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return stripAccents(a.jogador) < stripAccents(b.jogador) ? -1 : 1;
  });

  resultados.forEach((r, i) => {
    r.pos = i + 1;
    r.pos_label = `${i + 1}º`;
    if (snapshotAnterior && snapshotAnterior[r.jogador] !== undefined) {
      r.delta = snapshotAnterior[r.jogador] - r.pos;
    } else {
      r.delta = null;
    }
  });

  return resultados;
}
