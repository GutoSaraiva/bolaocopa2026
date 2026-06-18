# Bolão Copa 2026 — Tracker Pessoal

Tracker pessoal do Guto para o VII Bolão da Copa 2026, com:
- Cálculo automático de pontuação em tempo real
- Ranking comparativo entre os 89 participantes
- Variação diária de posição (delta vs dia anterior)
- Atualização automática via API football-data.org

## Estrutura

- `data/` — Palpites + estado atual do bolão (JSONs)
  - `palpite_guto.json` — Meu palpite completo (104 jogos + 5 bônus)
  - `palpites_todos.json` — Palpites dos 89 participantes
  - `ranking_atual.json` — Posição/pontos no snapshot de 15/06/2026
  - `gabarito_atual.json` — Resultados reais até 15/06/2026
  - `ranking_calculado.json` — Output do engine (consumido pela UI)
  - `historico/` — Snapshots diários do ranking (gerados pelo workflow)
- `engine/` — Scripts Python de scoring e fetch da API
  - `scoring.py` — Engine de pontuação (regras do bolão)
  - `run_ranking.py` — Runner que gera ranking + snapshot diário
- `web/` — Interface HTML/JS (GitHub Pages) — em construção
- `.github/workflows/` — GitHub Action — em construção

## Engine de pontuação (Etapa 5 — concluída)

O engine implementa as regras oficiais do bolão e foi **validado 100%** contra a
planilha do organizador (89/89 participantes com pontuação E posição idênticas).

**Como rodar localmente:**

```bash
python engine/run_ranking.py
```

Lê os palpites e gabarito, computa o ranking, salva snapshot do dia atual em
`data/historico/{hoje}.json` e gera o output `data/ranking_calculado.json` que
será consumido pela página web.

**Regras implementadas:**
- Fase de grupos: 7 pts (resultado), 9 pts (resultado + gols do vencedor), 12 pts (placar exato)
- Classificação dos grupos: 10 pts por seleção classificada, 5 pts em caso de inversão
- Mata-mata: TODO (será implementado quando começar a fase eliminatória)
- Bônus: TODO (calculado ao final da Copa)

**Delta diário:** o engine compara o ranking atual com o snapshot do dia anterior
e gera o campo `delta` para cada participante:
- `▲N` = subiu N posições
- `▼N` = caiu N posições  
- `–` = manteve a posição (ou primeiro dia)

## Próximas etapas

- [x] Etapa 1: Extrair palpite do Guto
- [x] Etapa 2: Extrair todos os 89 participantes
- [x] Etapa 3: Conta no football-data.org
- [x] Etapa 4: Criar repositório
- [x] Etapa 5: Engine de pontuação + delta diário
- [ ] Etapa 6: UI (HTML/CSS/JS)
- [ ] Etapa 7: GitHub Action (puxa API + roda engine a cada 30 min)
- [ ] Deploy + testes

## Fonte de dados

- API: [football-data.org](https://www.football-data.org) — free tier
- Hospedagem: GitHub Pages
- Automação: GitHub Actions (cron 30 min)
