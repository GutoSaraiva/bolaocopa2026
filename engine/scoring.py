"""
Engine de pontuação do Bolão Copa 2026.

Funções principais:
  - compute_score(palpite, gabarito): pontuação de um participante
  - compute_ranking(palpites, gabarito): ranking completo + delta diário
  - save_snapshot(ranking, data): salva snapshot para delta futuro
"""
import json
import os
from datetime import date, timedelta
from typing import Optional


# ============= REGRAS DE PONTUAÇÃO =============
PTS_GRUPO_RESULTADO = 7
PTS_GRUPO_GOLS_VENC = 9
PTS_GRUPO_PLACAR_EXATO = 12

# (pts_avanço_por_seleção, pts_extra_se_placar_exato)
PTS_MATAMATA = {
    'fase_32':    (10, 12),
    'oitavas':    (15, 14),
    'quartas':    (20, 16),
    'semifinais': (25, 18),
    'terceiro':   (20, 18),
    'final':      (35, 20),
}
PTS_VICE = 25
PTS_CAMPEAO = 50

PTS_BONUS = {
    'artilheiro': 40,
    'gols_artilheiro': 15,
    'melhor_ataque': 35,
    'melhor_defesa': 35,
    'total_gols': 60,
}


# ============= SCORING DE JOGO INDIVIDUAL (FASE DE GRUPOS) =============
def score_match_grupo(p_g1, p_g2, r_g1, r_g2):
    """Pontua um jogo da fase de grupos. Retorna 0/7/9/12."""
    if r_g1 is None or r_g2 is None: return 0
    if p_g1 is None or p_g2 is None: return 0
    res = lambda g1, g2: 'E' if g1 == g2 else ('V1' if g1 > g2 else 'V2')
    if res(p_g1, p_g2) != res(r_g1, r_g2): return 0
    if p_g1 == r_g1 and p_g2 == r_g2: return PTS_GRUPO_PLACAR_EXATO
    if p_g1 == p_g2: return PTS_GRUPO_RESULTADO
    return PTS_GRUPO_GOLS_VENC if max(p_g1, p_g2) == max(r_g1, r_g2) else PTS_GRUPO_RESULTADO


# ============= STANDINGS DE UM GRUPO =============
def calc_standings(gabarito_grupo):
    """Calcula classificação atual de um grupo baseado em jogos disputados."""
    times = {}
    for jogo in gabarito_grupo:
        if not jogo['disputado']: continue
        t1, g1, t2, g2 = jogo['time1'], jogo['gols1'], jogo['time2'], jogo['gols2']
        for t in (t1, t2):
            if t not in times: times[t] = {'pts': 0, 'gp': 0, 'gc': 0, 'jogos': 0}
        times[t1]['gp'] += g1; times[t1]['gc'] += g2; times[t1]['jogos'] += 1
        times[t2]['gp'] += g2; times[t2]['gc'] += g1; times[t2]['jogos'] += 1
        if g1 > g2: times[t1]['pts'] += 3
        elif g2 > g1: times[t2]['pts'] += 3
        else: times[t1]['pts'] += 1; times[t2]['pts'] += 1
    ranking = sorted(times.items(),
                     key=lambda x: (-x[1]['pts'], -(x[1]['gp']-x[1]['gc']), -x[1]['gp']))
    return [(t, s) for t, s in ranking]


def score_classificacao_grupo(palpite_class, ranking, grupo_completo):
    """Pontua a classificação de um grupo. Só credita se completo."""
    if not grupo_completo: return {'1': 0, '2': 0, '3': 0}
    pos_real = {t: i+1 for i, (t, _) in enumerate(ranking)}
    scores = {'1': 0, '2': 0, '3': 0}
    for pos_pred in ['1', '2', '3']:
        team = palpite_class.get(pos_pred) if isinstance(palpite_class, dict) else None
        if team is None: continue
        cur_pos = pos_real.get(team)
        if cur_pos is None: continue
        if cur_pos == int(pos_pred): scores[pos_pred] = 10
        elif cur_pos in [1, 2, 3]: scores[pos_pred] = 5
    return scores


# ============= SCORE DE UM PARTICIPANTE =============
def compute_score(palpite, gabarito):
    """
    Calcula pontuação total de um participante.
    Retorna dict com breakdown completo.
    """
    result = {
        'jogador': palpite['jogador'],
        'total': 0,
        'fase_grupos': {'jogos': 0, 'classificacao': 0},
        'mata_mata': 0,
        'bonus': 0,
        'detalhe_jogos': [],
    }

    gab_idx = {}
    for j in gabarito['jogos_grupos']:
        gab_idx[(j['grupo'], j['time1'], j['time2'])] = j

    # === FASE DE GRUPOS — jogos ===
    for grupo, info in palpite['grupos'].items():
        for jogo in info['jogos']:
            if isinstance(jogo, dict):
                t1, g1, g2, t2 = jogo['time1'], jogo['gols1'], jogo['gols2'], jogo['time2']
            else:
                t1, g1, g2, t2 = jogo[0], jogo[1], jogo[2], jogo[3]
            real = gab_idx.get((grupo, t1, t2))
            if real is None or not real['disputado']: continue
            pts = score_match_grupo(g1, g2, real['gols1'], real['gols2'])
            result['fase_grupos']['jogos'] += pts
            if pts > 0:
                result['detalhe_jogos'].append({
                    'grupo': grupo, 'jogo': f"{t1} vs {t2}",
                    'palpite': f"{g1}-{g2}",
                    'real': f"{real['gols1']}-{real['gols2']}",
                    'pts': pts
                })

    # === FASE DE GRUPOS — classificação (só grupos completos) ===
    jogos_por_grupo = {}
    for j in gabarito['jogos_grupos']:
        jogos_por_grupo.setdefault(j['grupo'], []).append(j)
    for grupo, jg in jogos_por_grupo.items():
        completo = all(j['disputado'] for j in jg)
        if not completo: continue
        ranking_g = calc_standings(jg)
        palp_grupo = palpite['grupos'][grupo]
        if 'classificacao' in palp_grupo:
            palp_class = palp_grupo['classificacao']
        else:
            cls_list = palp_grupo['class']
            palp_class = {'1': cls_list[0], '2': cls_list[1], '3': cls_list[2]}
        scores_g = score_classificacao_grupo(palp_class, ranking_g, True)
        result['fase_grupos']['classificacao'] += sum(scores_g.values())

    # === MATA-MATA: TODO (próxima etapa, quando começar)
    # === BÔNUS: TODO (calculado ao final)

    result['total'] = (result['fase_grupos']['jogos']
                       + result['fase_grupos']['classificacao']
                       + result['mata_mata']
                       + result['bonus'])
    return result


# ============= RANKING COMPLETO + DELTA DIÁRIO =============
def compute_ranking(palpites_todos, gabarito, snapshot_anterior=None):
    """
    Calcula ranking de todos os participantes.

    Args:
      palpites_todos: dict {nome: palpite}
      gabarito: gabarito atual
      snapshot_anterior: opcional, dict {nome: posicao_dia_anterior}

    Retorna:
      lista ordenada com pos, total, breakdown e delta.

    Delta:
      > 0 = subiu posições | < 0 = caiu | 0 = manteve | None = primeiro dia
    """
    resultados = []
    for nome, palpite in palpites_todos.items():
        resultados.append(compute_score(palpite, gabarito))

    # Sort key: pontos desc, depois nome alfabético ignorando acentos
    def _alfa_key(r):
        nome = r['jogador'].lower()
        for a, b in [('á','a'),('à','a'),('ã','a'),('â','a'),
                     ('é','e'),('ê','e'),
                     ('í','i'),('ï','i'),
                     ('ó','o'),('ô','o'),('õ','o'),
                     ('ú','u'),('ü','u'),('ç','c')]:
            nome = nome.replace(a, b)
        return (-r['total'], nome)
    resultados.sort(key=_alfa_key)

    # Numeração sequencial (mesmo com empate, cada um tem posição única, alfabética)
    for i, r in enumerate(resultados):
        r['pos'] = i + 1
        r['pos_label'] = f"{i+1}º"

    # Delta vs ontem
    for r in resultados:
        if snapshot_anterior and r['jogador'] in snapshot_anterior:
            r['delta'] = snapshot_anterior[r['jogador']] - r['pos']
        else:
            r['delta'] = None

    return resultados


def format_delta(delta):
    """Formata delta para exibição."""
    if delta is None or delta == 0: return '–'
    return f"▲{delta}" if delta > 0 else f"▼{abs(delta)}"


# ============= SNAPSHOTS DIÁRIOS =============
def save_snapshot(ranking, data_str, dir_historico='data/historico'):
    """Salva snapshot do ranking de um dia."""
    os.makedirs(dir_historico, exist_ok=True)
    snapshot = {r['jogador']: r['pos'] for r in ranking}
    path = os.path.join(dir_historico, f"{data_str}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({
            'data': data_str,
            'posicoes': snapshot,
            'total_participantes': len(ranking)
        }, f, ensure_ascii=False, indent=1)
    return path


def load_snapshot(data_str, dir_historico='data/historico'):
    """Carrega snapshot de um dia. Retorna dict {nome: pos} ou None."""
    path = os.path.join(dir_historico, f"{data_str}.json")
    if not os.path.exists(path): return None
    with open(path) as f:
        return json.load(f)['posicoes']


def load_snapshot_anterior(data_atual_str, dir_historico='data/historico'):
    """Procura snapshot do dia anterior (até 7 dias pra trás)."""
    data_atual = date.fromisoformat(data_atual_str)
    for dias_atras in range(1, 8):
        d = (data_atual - timedelta(days=dias_atras)).isoformat()
        snap = load_snapshot(d, dir_historico)
        if snap is not None: return snap, d
    return None, None


# ============= CLI =============
if __name__ == '__main__':
    import sys
    palpite_path = sys.argv[1] if len(sys.argv) > 1 else 'data/palpite_guto.json'
    todos_path = sys.argv[2] if len(sys.argv) > 2 else 'data/palpites_todos.json'
    gabarito_path = sys.argv[3] if len(sys.argv) > 3 else 'data/gabarito_atual.json'

    with open(palpite_path) as f: palpite = json.load(f)
    with open(todos_path) as f: todos = json.load(f)
    with open(gabarito_path) as f: gabarito = json.load(f)

    ontem = (date.today() - timedelta(days=1)).isoformat()
    snap_ontem = load_snapshot(ontem)

    ranking = compute_ranking(todos, gabarito, snap_ontem)

    print(f"=== RANKING ATUAL — {len(ranking)} participantes ===\n")
    print(f"{'Δ':<5} {'Pos':<5} {'Jogador':<35} {'Total':>6} {'Grupos':>7}")
    print("-" * 65)
    for r in ranking[:15]:
        delta = format_delta(r.get('delta'))
        print(f"{delta:<5} {r['pos_label']:<5} {r['jogador']:<35} "
              f"{r['total']:>6} {r['fase_grupos']['jogos']:>7}")

    guto = next((r for r in ranking if r['jogador'] == 'Guto'), None)
    if guto:
        print(f"\n🎯 Guto: {guto['pos_label']} com {guto['total']} pts "
              f"(Δ {format_delta(guto.get('delta'))})")

    hoje = date.today().isoformat()
    path = save_snapshot(ranking, hoje, dir_historico='data/historico')
    print(f"\n💾 Snapshot salvo: {path}")
