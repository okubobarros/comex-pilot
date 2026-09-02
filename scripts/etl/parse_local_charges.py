# -*- coding: utf-8 -*-
"""
ETL das taxas locais de destino.

Entrada:  TAXASLOCAISPORARMADOR_UNITIZADO_MOEDA.xlsx
Saidas:   seeds/freight/0005_local_charges.sql   (Postgres/Supabase)
          src/data/localCharges.json             (embarcado)

Os DOIS artefatos saem da mesma leitura, como ja acontece com o frete
internacional (parse_rate_sheet.py). O motivo e pratico: o servico de frete le
a base embarcada por padrao e so vai ao Postgres com FREIGHT_SOURCE=db. Se as
taxas locais existissem so no banco, o custo total ficaria zerado na
configuracao padrao — sem erro nenhum aparecer, que e o pior tipo de falha.

A planilha ja vem normalizada — uma taxa por linha, 7 colunas — entao aqui nao
ha desagrupamento como no parse_rate_sheet.py. O trabalho e outro:

  1. Resolver a sigla local de 3 letras para UN/LOCODE, que e a chave de junçao
     com o frete internacional. Para os 12 portos do arquivo a regra e
     LOCODE = 'BR' || sigla, conferida uma a uma na tabela PORTOS abaixo.

  2. Separar armador de agente de carga (entity_type).

  3. REGISTRAR as divergencias em vez de corrigi-las. A ONE aparece com THC por
     BL e BL FEE por conteiner nos 12 portos — o inverso dos outros 12
     armadores. Pode ser troca de coluna na origem, pode ser pratica real
     daquele armador. Quem decide isso e quem opera, com a fatura na mao; o ETL
     so garante que a divergencia nao passe despercebida.

Uso: python scripts/etl/parse_local_charges.py <caminho do xlsx>
"""
import json
import sys
import unicodedata
from pathlib import Path
from collections import Counter, defaultdict

import openpyxl

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "seeds" / "freight" / "0005_local_charges.sql"
SAIDA_JSON = RAIZ / "src" / "data" / "localCharges.json"

# Sigla local -> (UN/LOCODE, nome canonico). Conferido porto a porto: para
# estes 12 o LOCODE e sempre 'BR' + sigla, mas a tabela fica explicita porque
# essa coincidencia nao vale para o resto do mundo (nem para todo porto do BR).
PORTOS = {
    "MAO": ("BRMAO", "Manaus"),
    "PEC": ("BRPEC", "Pecem"),
    "SUA": ("BRSUA", "Suape"),
    "SSA": ("BRSSA", "Salvador"),
    "VIX": ("BRVIX", "Vitoria"),
    "RIO": ("BRRIO", "Rio de Janeiro"),
    "SSZ": ("BRSSZ", "Santos"),
    "PNG": ("BRPNG", "Paranagua"),
    "IOA": ("BRIOA", "Itapoa"),
    "ITJ": ("BRITJ", "Itajai"),
    "NVT": ("BRNVT", "Navegantes"),
    "RIG": ("BRRIG", "Rio Grande"),
}

# Entidades que sao agente de carga, nao armador.
AGENTES = {"AGENTE DE CARGA"}

# Como o armador aparece na planilha -> codigo canonico ja usado em `carriers`.
# Os 12 codigos a direita sao os que o seed do frete internacional carregou
# (seeds/freight/0004_freight_a_stage.sql); conferidos um a um. Sem isto,
# "HAPAG LLOYD" nas taxas e "HPL" no frete seriam duas entidades diferentes e a
# funcao de custo total devolveria taxa local zerada — sem erro nenhum.
ALIAS = {
    "MAERSK": "MSK",
    "HAPAG LLOYD": "HPL",
    "CMA CGM": "CMA",
    "YANG MING": "YML",
    "EVERGREEN": "EMC",
    "HYUNDAI": "HMM",
}

# Codigos aceitos em `carriers`. Um armador das taxas locais que nao esteja
# aqui e uma entidade que o frete internacional desconhece — vale avisar.
CARRIERS_CONHECIDOS = {
    "PIL", "CMA", "YML", "HMM", "COSCO", "ONE",
    "OOCL", "MSK", "MSC", "EMC", "CSSC", "HPL",
}


def sem_acento(txt: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", txt) if unicodedata.category(c) != "Mn"
    )


def esc(v) -> str:
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def ler(caminho: Path):
    wb = openpyxl.load_workbook(caminho, data_only=True)
    ws = wb.worksheets[0]
    linhas = []
    for i, r in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
        if not any(x is not None and str(x).strip() for x in r):
            continue
        destino, abrev, entidade, taxa, moeda, valor, unidade = (
            (None if c is None else (c if isinstance(c, (int, float)) else str(c).strip()))
            for c in r[:7]
        )
        linhas.append(
            dict(
                linha=i,
                destino=sem_acento(str(destino)).title(),
                abrev=str(abrev).upper(),
                entidade=str(entidade).upper(),
                taxa=str(taxa).upper().rstrip(","),
                moeda=str(moeda).upper(),
                valor=valor,
                unidade=str(unidade).upper(),
            )
        )
    return linhas


def detectar_divergencias(linhas):
    """Taxas cuja unidade de cobranca destoa da pratica dominante do arquivo."""
    por_taxa = defaultdict(Counter)
    for l in linhas:
        por_taxa[l["taxa"]][l["unidade"]] += 1

    issues = []
    for l in linhas:
        c = por_taxa[l["taxa"]]
        if len(c) < 2:
            continue
        dominante, n_dom = c.most_common(1)[0]
        if l["unidade"] == dominante:
            continue
        issues.append(
            dict(
                port_code=l["abrev"],
                entity_name=l["entidade"],
                fee_code=l["taxa"],
                source_row=l["linha"],
                severity="aviso",
                kind="unidade_divergente",
                detail=(
                    f"{l['entidade']} cobra {l['taxa']} por {l['unidade']}, enquanto "
                    f"{n_dom} das {sum(c.values())} ocorrencias de {l['taxa']} na planilha usam "
                    f"{dominante}. Confirme na fatura antes de fechar o custeio: tratar "
                    f"{l['taxa']} por {l['unidade']} muda o total de todo embarque com mais "
                    f"de um conteiner."
                ),
            )
        )
    return issues


def gerar(linhas, issues) -> str:
    partes = [
        "-- ============================================================================",
        "-- MCAT / ComexPilot — SEED das taxas locais de destino",
        "--",
        "-- Gerado por scripts/etl/parse_local_charges.py a partir de",
        "-- TAXASLOCAISPORARMADOR_UNITIZADO_MOEDA.xlsx. NAO editar a mao: rode o ETL.",
        "--",
        f"-- {len(linhas)} taxas, {len({l['abrev'] for l in linhas})} portos, "
        f"{len({l['entidade'] for l in linhas})} entidades.",
        f"-- {len(issues)} ressalva(s) registrada(s) em charge_issues.",
        "--",
        "-- Idempotente: pode rodar de novo sem duplicar (on conflict do update).",
        "-- ============================================================================",
        "",
        "set search_path to mcat, public, extensions;",
        "",
        "-- Os portos precisam existir antes das taxas (FK em ports.unlocode).",
        "-- Idempotente e nao sobrescreve nome/pais de um porto ja carregado pelo",
        "-- seed do frete internacional.",
        "insert into ports (unlocode, name, country) values",
    ]

    portos_usados = sorted({l["abrev"] for l in linhas})
    vals = [
        f"  ({esc(PORTOS[s][0])}, {esc(PORTOS[s][1])}, 'BR')" for s in portos_usados
    ]
    partes.append(",\n".join(vals))
    partes.append("on conflict (unlocode) do nothing;")
    partes.append("")

    partes.append("insert into local_charges")
    partes.append(
        "  (port_unlocode, port_code, port_name, entity_type, entity_name,"
    )
    partes.append(
        "   fee_code, currency, amount, calculation_unit, source_file, source_row)"
    )
    partes.append("values")

    vals = []
    for l in linhas:
        locode, nome = PORTOS[l["abrev"]]
        tipo = "FREIGHT_FORWARDER" if l["entidade"] in AGENTES else "CARRIER"
        entidade = ALIAS.get(l["entidade"], l["entidade"])
        vals.append(
            f"  ({esc(locode)}, {esc(l['abrev'])}, {esc(nome)}, {esc(tipo)}, "
            f"{esc(entidade)}, {esc(l['taxa'])}, {esc(l['moeda'])}, {l['valor']}, "
            f"{esc(l['unidade'])}, 'TAXASLOCAISPORARMADOR_UNITIZADO_MOEDA.xlsx', {l['linha']})"
        )
    partes.append(",\n".join(vals))
    partes.append(
        "on conflict (port_code, entity_name, fee_code, calculation_unit, currency)\n"
        "do update set amount = excluded.amount,\n"
        "              port_unlocode = excluded.port_unlocode,\n"
        "              entity_type = excluded.entity_type,\n"
        "              source_row = excluded.source_row,\n"
        "              updated_at = now();"
    )
    partes.append("")

    if issues:
        partes.append("-- Ressalvas: a unidade de cobranca destoa da pratica dominante do arquivo.")
        partes.append("-- Ficam ao lado do dado, nao no lugar dele.")
        partes.append("delete from charge_issues where kind = 'unidade_divergente';")
        partes.append(
            "insert into charge_issues\n"
            "  (port_code, entity_name, fee_code, severity, kind, detail, source_row)\nvalues"
        )
        vals = []
        for i in issues:
            entidade = ALIAS.get(i["entity_name"], i["entity_name"])
            vals.append(
                f"  ({esc(i['port_code'])}, {esc(entidade)}, {esc(i['fee_code'])}, "
                f"{esc(i['severity'])}, {esc(i['kind'])}, {esc(i['detail'])}, {i['source_row']})"
            )
        partes.append(",\n".join(vals) + ";")
        partes.append("")

    return "\n".join(partes) + "\n"


def gerar_json(linhas, issues) -> dict:
    """Mesmo conteudo do seed, no formato que o motor embarcado consome."""
    return {
        "source_file": "TAXASLOCAISPORARMADOR_UNITIZADO_MOEDA.xlsx",
        "charges": [
            {
                "port_unlocode": PORTOS[l["abrev"]][0],
                "port_code": l["abrev"],
                "port_name": PORTOS[l["abrev"]][1],
                "entity_type": "FREIGHT_FORWARDER" if l["entidade"] in AGENTES else "CARRIER",
                "entity_name": ALIAS.get(l["entidade"], l["entidade"]),
                "fee_code": l["taxa"],
                "currency": l["moeda"],
                "amount": l["valor"],
                "calculation_unit": l["unidade"],
                "source_row": l["linha"],
            }
            for l in linhas
        ],
        "issues": [
            {
                "port_code": i["port_code"],
                "entity_name": ALIAS.get(i["entity_name"], i["entity_name"]),
                "fee_code": i["fee_code"],
                "severity": i["severity"],
                "kind": i["kind"],
                "detail": i["detail"],
                "source_row": i["source_row"],
            }
            for i in issues
        ],
    }


def main():
    if len(sys.argv) < 2:
        print("uso: python scripts/etl/parse_local_charges.py <xlsx>")
        return 1
    caminho = Path(sys.argv[1])
    linhas = ler(caminho)

    desconhecidos = {l["abrev"] for l in linhas} - set(PORTOS)
    if desconhecidos:
        print(f"ERRO: sigla de porto sem UN/LOCODE mapeado: {sorted(desconhecidos)}")
        print("Acrescente em PORTOS antes de gerar o seed — sem LOCODE a taxa nao")
        print("encontra o frete internacional e o custo local volta zerado.")
        return 1

    # Um armador nas taxas locais que o frete internacional nao conhece nunca
    # sera encontrado pela funcao de custo total. Melhor descobrir aqui.
    orfaos = {
        ALIAS.get(l["entidade"], l["entidade"])
        for l in linhas
        if l["entidade"] not in AGENTES
    } - CARRIERS_CONHECIDOS
    if orfaos:
        print(f"AVISO: armador sem correspondencia em `carriers`: {sorted(orfaos)}")
        print("A funcao de custo total nao vai achar taxa local para eles.")

    issues = detectar_divergencias(linhas)

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(gerar(linhas, issues), encoding="utf-8")

    SAIDA_JSON.parent.mkdir(parents=True, exist_ok=True)
    SAIDA_JSON.write_text(
        json.dumps(gerar_json(linhas, issues), ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    print(f"{len(linhas)} taxas -> {SAIDA.relative_to(RAIZ)}")
    print(f"{len(linhas)} taxas -> {SAIDA_JSON.relative_to(RAIZ)}")
    print(f"{len({l['abrev'] for l in linhas})} portos, {len({l['entidade'] for l in linhas})} entidades")
    if issues:
        print(f"\n{len(issues)} RESSALVA(S) — unidade de cobranca divergente:")
        resumo = Counter((i["entity_name"], i["fee_code"], i["severity"]) for i in issues)
        for (ent, fee, _), n in resumo.most_common():
            print(f"  {n:>3}x  {ent} / {fee}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
