"""
Busca resultados da Copa 2026 na API football-data.org e atualiza
data/gabarito_atual.json com os jogos da fase de grupos que já terminaram.

Uso (local):
  FOOTBALL_DATA_API_KEY=xxxxx python engine/fetch_results.py

No GitHub Action, a chave vem do secret FOOTBALL_DATA_API_KEY.

A API retorna nomes de seleções em inglês; este script traduz para os
nomes em português usados no gabarito. Qualquer nome não reconhecido é
logado (mas não quebra a execução) para correção posterior.
"""
import json
import os
import sys
import urllib.request
import urllib.error

API_BASE = "https://api.football-data.org/v4"
COMPETITION = "WC"  # FIFA World Cup

# ============= MAPA DE NOMES: inglês (API) → português (gabarito) =============
# Cobre as 48 seleções da Copa 2026. Inclui variações comuns que a API
# pode retornar (nome curto vs longo).
NOME_PT = {
    "Germany": "Alemanha",
    "Argentina": "Argentina",
    "Algeria": "Argélia",
    "Saudi Arabia": "Arábia Saudita",
    "Australia": "Austrália",
    "Brazil": "Brasil",
    "Belgium": "Bélgica",
    "Bosnia and Herzegovina": "Bósnia",
    "Bosnia-Herzegovina": "Bósnia",
    "Cape Verde": "Cabo Verde",
    "Cabo Verde": "Cabo Verde",
    "Canada": "Canadá",
    "Qatar": "Catar",
    "Colombia": "Colômbia",
    "South Korea": "Coreia do Sul",
    "Korea Republic": "Coreia do Sul",
    "Republic of Korea": "Coreia do Sul",
    "Ivory Coast": "Costa do Marfim",
    "Côte d'Ivoire": "Costa do Marfim",
    "Cote d'Ivoire": "Costa do Marfim",
    "Croatia": "Croácia",
    "Curaçao": "Curaçao",
    "Curacao": "Curaçao",
    "United States": "EUA",
    "USA": "EUA",
    "United States of America": "EUA",
    "Egypt": "Egito",
    "Ecuador": "Equador",
    "Scotland": "Escócia",
    "Spain": "Espanha",
    "France": "França",
    "Ghana": "Gana",
    "Haiti": "Haiti",
    "Netherlands": "Holanda",
    "England": "Inglaterra",
    "Iraq": "Iraque",
    "Iran": "Irã",
    "IR Iran": "Irã",
    "Japan": "Japão",
    "Jordan": "Jordânia",
    "Morocco": "Marrocos",
    "Mexico": "México",
    "Norway": "Noruega",
    "New Zealand": "Nova Zelândia",
    "Panama": "Panamá",
    "Paraguay": "Paraguai",
    "Portugal": "Portugal",
    "DR Congo": "RD Congo",
    "Congo DR": "RD Congo",
    "Democratic Republic of the Congo": "RD Congo",
    "Senegal": "Senegal",
    "Sweden": "Suécia",
    "Switzerland": "Suíça",
    "Czech Republic": "Tchéquia",
    "Czechia": "Tchéquia",
    "Tunisia": "Tunísia",
    "Turkey": "Turquia",
    "Türkiye": "Turquia",
    "Uruguay": "Uruguai",
    "Uzbekistan": "Uzbequistão",
    "South Africa": "África do Sul",
    "Austria": "Áustria",
}


def traduzir(nome_en, nao_reconhecidos):
    """Traduz nome inglês → português. Loga se não reconhecer."""
    pt = NOME_PT.get(nome_en)
    if pt is None:
        nao_reconhecidos.add(nome_en)
        return nome_en  # devolve original pra não quebrar matching
    return pt


def fetch_matches(api_key):
    """Busca todos os jogos da Copa na API."""
    url = f"{API_BASE}/competitions/{COMPETITION}/matches"
    req = urllib.request.Request(url, headers={"X-Auth-Token": api_key})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"❌ Erro HTTP {e.code}: {e.reason}")
        if e.code == 403:
            print("   → Verifique se a Copa está disponível no seu plano.")
        elif e.code == 429:
            print("   → Rate limit atingido (10/min). Tente novamente em 1 min.")
        raise
    except urllib.error.URLError as e:
        print(f"❌ Erro de conexão: {e.reason}")
        raise


def main():
    api_key = os.environ.get("FOOTBALL_DATA_API_KEY")
    if not api_key:
        print("❌ FOOTBALL_DATA_API_KEY não definida no ambiente.")
        sys.exit(1)

    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    gabarito_path = os.path.join(base, "data", "gabarito_atual.json")

    with open(gabarito_path) as f:
        gabarito = json.load(f)

    print("📡 Buscando resultados na football-data.org...")
    data = fetch_matches(api_key)
    matches = data.get("matches", [])
    print(f"   {len(matches)} jogos retornados pela API")

    # Index dos resultados FINISHED da fase de grupos, por par de times (PT)
    nao_reconhecidos = set()
    resultados_api = {}  # (time1_pt, time2_pt) → (gols1, gols2)
    for m in matches:
        stage = m.get("stage", "")
        if stage != "GROUP_STAGE":
            continue
        if m.get("status") != "FINISHED":
            continue
        home_en = m["homeTeam"]["name"]
        away_en = m["awayTeam"]["name"]
        home_pt = traduzir(home_en, nao_reconhecidos)
        away_pt = traduzir(away_en, nao_reconhecidos)
        ft = m["score"]["fullTime"]
        g1, g2 = ft.get("home"), ft.get("away")
        if g1 is None or g2 is None:
            continue
        resultados_api[(home_pt, away_pt)] = (g1, g2)

    print(f"   {len(resultados_api)} jogos FINISHED na fase de grupos")
    if nao_reconhecidos:
        print(f"⚠️  Nomes não reconhecidos (corrigir NOME_PT): {sorted(nao_reconhecidos)}")

    # Atualizar gabarito: marcar disputado e preencher gols
    atualizados = 0
    for j in gabarito["jogos_grupos"]:
        key = (j["time1"], j["time2"])
        if key in resultados_api:
            g1, g2 = resultados_api[key]
            if not j["disputado"] or j.get("gols1") != g1 or j.get("gols2") != g2:
                j["gols1"], j["gols2"] = g1, g2
                j["disputado"] = True
                atualizados += 1

    gabarito["disputados"] = sum(1 for j in gabarito["jogos_grupos"] if j["disputado"])

    with open(gabarito_path, "w", encoding="utf-8") as f:
        json.dump(gabarito, f, ensure_ascii=False, indent=1)

    print(f"✅ {atualizados} jogos atualizados no gabarito")
    print(f"   Total disputados: {gabarito['disputados']}/72 (fase de grupos)")


if __name__ == "__main__":
    main()
