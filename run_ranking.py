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
                     format_delta)


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
