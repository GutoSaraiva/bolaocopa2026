"""
Runner: computa o ranking atual e gera o output JSON que a página web vai consumir.

Uso:
  python engine/run_ranking.py

Lê:
  data/palpites_todos.json
  data/gabarito_atual.json
  data/historico/{ontem}.json  (se existir)

Escreve:
  data/ranking_calculado.json  ← consumido pela página web
  data/historico/{hoje}.json   ← snapshot para delta de amanhã
"""
import json
import os
import sys
from datetime import date, timedelta

# Adiciona engine/ ao path para importar scoring
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scoring import (compute_ranking, save_snapshot, load_snapshot_anterior,
                     format_delta, score_match_grupo)


def gerar_tabelao(palpites, gabarito, ranking, data_dir):
    """
    Gera a matriz apostadores × jogos de grupos.
    Cada célula: {p: [g1,g2] palpite, pts: pontos ou None se futuro/sem palpite}.
    Linhas ordenadas pela posição no ranking; colunas na ordem do gabarito.
    """
    jogos_grupos = gabarito['jogos_grupos']
    colunas = [{
        'grupo': j['grupo'], 'time1': j['time1'], 'time2': j['time2'],
        'real': [j['gols1'], j['gols2']] if j['disputado'] else None,
        'disputado': j['disputado'], 'data': j.get('data', '')
    } for j in jogos_grupos]

    gab_idx = {(j['grupo'], j['time1'], j['time2']): j for j in jogos_grupos}

    def palpite_cells(nome):
        p = palpites.get(nome)
        if not p:
            k = next((k for k in palpites
                      if k.lower().replace(' ', '') == nome.lower().replace(' ', '')), None)
            if k: p = palpites[k]
        if not p: return {}
        cells = {}
        for g, info in p['grupos'].items():
            for jogo in info['jogos']:
                if isinstance(jogo, dict):
                    t1, g1, g2, t2 = jogo['time1'], jogo['gols1'], jogo['gols2'], jogo['time2']
                else:
                    t1, g1, g2, t2 = jogo[0], jogo[1], jogo[2], jogo[3]
                cells[(g, t1, t2)] = [g1, g2]
        return cells

    linhas = []
    for r in ranking:
        nome = r['jogador']
        cells_palpite = palpite_cells(nome)
        row_cells = []
        for col in colunas:
            key = (col['grupo'], col['time1'], col['time2'])
            palp = cells_palpite.get(key)
            if palp is None:
                row_cells.append({'p': None, 'pts': None})
            elif col['disputado']:
                real = gab_idx[key]
                pts = score_match_grupo(palp[0], palp[1], real['gols1'], real['gols2'])
                row_cells.append({'p': palp, 'pts': pts})
            else:
                row_cells.append({'p': palp, 'pts': None})
        linhas.append({
            'jogador': nome, 'pos': r['pos_label'],
            'total': r['total'], 'cells': row_cells
        })

    matriz = {
        'colunas': colunas, 'linhas': linhas,
        'jogos_disputados': sum(1 for c in colunas if c['disputado']),
    }
    with open(os.path.join(data_dir, 'tabelao.json'), 'w', encoding='utf-8') as f:
        json.dump(matriz, f, ensure_ascii=False, separators=(',', ':'))


def main():
    # Caminhos relativos à raiz do repo
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base, 'data')
    historico_dir = os.path.join(data_dir, 'historico')

    # Carrega palpites e gabarito
    with open(os.path.join(data_dir, 'palpites_todos.json')) as f:
        palpites = json.load(f)
    with open(os.path.join(data_dir, 'gabarito_atual.json')) as f:
        gabarito = json.load(f)

    # Snapshot anterior (busca até 7 dias atrás)
    hoje = date.today().isoformat()
    snap_anterior, data_snap = load_snapshot_anterior(hoje, historico_dir)
    if snap_anterior:
        print(f"📅 Snapshot anterior encontrado: {data_snap}")
    else:
        print(f"📅 Sem snapshot anterior (primeiro dia)")

    # Computa ranking
    ranking = compute_ranking(palpites, gabarito, snap_anterior)
    print(f"✅ Ranking calculado: {len(ranking)} participantes")

    # Salva snapshot de hoje (para delta de amanhã)
    save_snapshot(ranking, hoje, dir_historico=historico_dir)
    print(f"💾 Snapshot de hoje salvo: data/historico/{hoje}.json")

    # Output para a página web
    output = {
        'data_atualizacao': hoje,
        'snapshot_anterior_data': data_snap,
        'jogos_disputados': sum(1 for j in gabarito['jogos_grupos'] if j['disputado']),
        'total_participantes': len(ranking),
        'ranking': [
            {
                'pos': r['pos'],
                'pos_label': r['pos_label'],
                'jogador': r['jogador'],
                'total': r['total'],
                'delta': r.get('delta'),
                'delta_label': format_delta(r.get('delta')),
                'breakdown': {
                    'fase_grupos_jogos': r['fase_grupos']['jogos'],
                    'fase_grupos_classificacao': r['fase_grupos']['classificacao'],
                    'mata_mata': r['mata_mata'],
                    'bonus': r['bonus'],
                }
            }
            for r in ranking
        ]
    }

    out_path = os.path.join(data_dir, 'ranking_calculado.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=1)
    print(f"💾 Output da UI salvo: data/ranking_calculado.json")

    # === TABELÃO: matriz apostadores × jogos de grupos ===
    gerar_tabelao(palpites, gabarito, ranking, data_dir)
    print(f"💾 Tabelão salvo: data/tabelao.json")

    # Imprime top 10 + Guto
    print(f"\n=== TOP 10 ===")
    print(f"{'Δ':<5} {'Pos':<5} {'Jogador':<35} {'Total':>6}")
    print("-" * 60)
    for r in ranking[:10]:
        print(f"{format_delta(r.get('delta')):<5} {r['pos_label']:<5} "
              f"{r['jogador']:<35} {r['total']:>6}")

    guto = next((r for r in ranking if r['jogador'] == 'Guto'), None)
    if guto:
        print(f"\n🎯 Guto: {guto['pos_label']} | {guto['total']} pts | "
              f"Δ {format_delta(guto.get('delta'))}")


if __name__ == '__main__':
    main()
