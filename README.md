# Bolão Copa 2026 — Tracker Pessoal

Tracker pessoal do Guto para o VII Bolão da Copa 2026, com:
- Cálculo automático de pontuação em tempo real
- Ranking comparativo entre os 89 participantes
- Variação diária de posição (delta vs dia anterior)
- Atualização automática via API football-data.org (em construção)

🔗 **Live**: https://gutosaraiva.github.io/bolaocopa2026/

## Estrutura

- `/index.html`, `/style.css`, `/app.js` — Interface web (Etapa 6, concluída)
- `/data/` — JSONs com palpites e estado atual
  - `palpite_guto.json` — Meu palpite completo (104 jogos + 5 bônus)
  - `palpites_todos.json` — Palpites dos 89 participantes
  - `gabarito_atual.json` — Resultados reais até a última sincronização
  - `ranking_calculado.json` — Output do engine (consumido pela UI)
  - `historico/` — Snapshots diários para cálculo do delta
- `/engine/` — Engine de pontuação (Etapa 5, concluída)
  - `scoring.py` — Regras de pontuação
  - `run_ranking.py` — Runner que gera o ranking + snapshot diário
- `/.github/workflows/` — GitHub Action (Etapa 7, em construção)

## Engine de pontuação

Implementa as regras oficiais do bolão e foi validado 100% contra a planilha do
organizador (89/89 participantes com pontuação E posição idênticas).

**Como rodar localmente:**

```bash
python engine/run_ranking.py
```

## Interface web

Design dashboard-style inspirado em terminais financeiros (Bloomberg/Reuters).
A primeira coluna da tabela mostra a variação diária de posição:

- `▲N` = subiu N posições vs ontem
- `▼N` = caiu N posições vs ontem
- `–` = manteve a posição (ou primeiro dia)

Filtros disponíveis: todos, top 10, vizinhos do Guto, busca por nome.
Botão "↓ guto" leva direto para a linha destacada no ranking.

## Próximas etapas

- [x] Etapa 1: Extrair palpite do Guto
- [x] Etapa 2: Extrair todos os 89 participantes
- [x] Etapa 3: Conta no football-data.org
- [x] Etapa 4: Criar repositório
- [x] Etapa 5: Engine de pontuação + delta diário (89/89 validado)
- [x] Etapa 6: Interface web (responsiva, dark dashboard)
- [ ] Etapa 7: GitHub Action (puxa API + roda engine a cada 30 min)
- [ ] Deploy + testes
