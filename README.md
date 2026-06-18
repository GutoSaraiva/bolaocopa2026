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
  - `historico/` — Snapshots diários do ranking (gerados pelo workflow)
- `engine/` — Scripts Python de scoring e fetch da API
- `web/` — Interface HTML/JS (GitHub Pages)
- `.github/workflows/` — GitHub Action que atualiza resultados a cada 30 min

## Como usar

(Em construção — vou completar conforme avançamos)

## Fonte de dados

- API: [football-data.org](https://www.football-data.org) — free tier
- Hospedagem: GitHub Pages
- Automação: GitHub Actions (cron 30 min)

## Regras do bolão

Resumidas em `data/regras.md`. Detalhes completos no email original do organizador.
