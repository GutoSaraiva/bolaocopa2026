# Bolão Copa 2026 — Tracker Pessoal

Tracker pessoal do Guto para o VII Bolão da Copa 2026, com:
- Cálculo automático de pontuação em tempo real
- Ranking comparativo entre os 89 participantes
- Variação diária de posição (delta vs dia anterior)
- Visões completas: ranking, gabarito, palpites individuais e regras
- Atualização automática via API football-data.org (em construção)

🔗 **Live**: https://gutosaraiva.github.io/bolaocopa2026/

## Estrutura

- `/index.html`, `/style.css`, `/app.js` — Interface web (Etapa 6 — completa)
- `/data/` — JSONs com palpites, gabarito e estado atual
  - `palpite_guto.json` — Meu palpite completo
  - `palpites_todos.json` — Palpites dos 89 participantes
  - `gabarito_atual.json` — Resultados reais até a última sincronização
  - `ranking_calculado.json` — Output do engine (consumido pela UI)
  - `historico/` — Snapshots diários para cálculo do delta
- `/engine/` — Engine de pontuação (Etapa 5 — completa, validado 89/89)
- `/.github/workflows/` — GitHub Action (Etapa 7 — em construção)

## Abas da interface

1. **Ranking** — Hero com sua posição/pontos/delta + ranking completo dos 89
2. **Gabarito** — 12 grupos com classificação atualizada e resultados dos jogos
3. **Palpites** — Browser dos palpites dos 89 participantes (selecione na lista)
4. **Regras** — Pontuação de cada categoria + distribuição de prêmios

## Próximas etapas

- [x] Etapa 5: Engine de pontuação validado 89/89
- [x] Etapa 6: Interface web (4 abas completas)
- [ ] Etapa 7: GitHub Action automatizando atualizações
