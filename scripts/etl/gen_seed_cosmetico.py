#!/usr/bin/env python3
"""
Gera o seed SQL do piloto COSMÉTICO (Sprint 0) a partir dos CSVs de origem.

Fontes (em data/sources/):
  - cosmetico_tributos.csv   -> ncm + ncm_tributo (II/IPI/PIS/COFINS reais)
  - mapa_orgaos_anuentes.csv -> ncm_anuencia (ANVISA + RDCs)

Saída: seeds/0002_cosmetico.sql (idempotente via ON CONFLICT DO NOTHING).

Uso:  python scripts/etl/gen_seed_cosmetico.py
Reprodutível: lê os CSVs versionados no repo, não depende de caminho externo.
"""
from __future__ import annotations
import csv
import io
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "data", "sources")
OUT = os.path.join(ROOT, "seeds", "0002_cosmetico.sql")


def sql_str(v: str | None) -> str:
    """Escapa uma string para literal SQL, ou NULL."""
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def sql_num(v: str | None) -> str:
    if v is None or str(v).strip() == "":
        return "NULL"
    try:
        return str(float(str(v).replace(",", ".")))
    except ValueError:
        return "NULL"


def nivel_de(codigo: str) -> int:
    return len(re.sub(r"[^0-9]", "", codigo))


def main() -> None:
    tributos_path = os.path.join(SRC, "cosmetico_tributos.csv")
    anuencia_path = os.path.join(SRC, "mapa_orgaos_anuentes.csv")

    ncm_rows: dict[str, dict] = {}
    with io.open(tributos_path, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            cod = (r.get("NCM") or "").strip()
            if not cod:
                continue
            ncm_rows[cod] = {
                "descricao": (r.get("Descrição") or "").strip(),
                "ii": r.get("II_%"),
                "ipi": r.get("IPI_%"),
                "pis": r.get("PIS_%"),
                "cofins": r.get("COFINS_%"),
            }

    anuencias: dict[str, dict] = {}
    with io.open(anuencia_path, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if (r.get("Segmento") or "").strip() != "Cosmético":
                continue
            cod = (r.get("NCM") or "").strip()
            if not cod:
                continue
            anuencias[cod] = {
                "orgao": (r.get("Órgão anuente") or "").strip(),
                "trat": (r.get("Tratamento administrativo") or "").strip(),
                "regra": (r.get("Regra operacional") or "").strip(),
            }

    out: list[str] = []
    out.append("-- ============================================================")
    out.append("-- Seed do piloto COSMÉTICO (gerado por scripts/etl/gen_seed_cosmetico.py)")
    out.append(f"-- {len(ncm_rows)} NCMs · fonte: data/sources/*.csv · NÃO editar à mão")
    out.append("-- ============================================================")
    out.append("set search_path to mcat, public;\n")

    # 1) NCM
    out.append("-- NCM (cap. 33)")
    for cod, d in ncm_rows.items():
        out.append(
            "insert into ncm (codigo, descricao, nivel, vigencia_inicio) values "
            f"({sql_str(cod)}, {sql_str(d['descricao'])}, {nivel_de(cod)}, date '2022-04-01') "
            "on conflict (codigo) do nothing;"
        )

    # 2) Tributos federais
    out.append("\n-- Tributos federais por NCM (vigência baseline 2026-01-01)")
    for cod, d in ncm_rows.items():
        out.append(
            "insert into ncm_tributo (ncm_codigo, vigencia_inicio, ii_pct, ipi_pct, pis_pct, cofins_pct) values "
            f"({sql_str(cod)}, date '2026-01-01', {sql_num(d['ii'])}, {sql_num(d['ipi'])}, "
            f"{sql_num(d['pis'])}, {sql_num(d['cofins'])}) "
            "on conflict (ncm_codigo, vigencia_inicio) do nothing;"
        )

    # 3) Anuência (ANVISA) — resolve orgao_id por subselect
    out.append("\n-- Anuência ANVISA por NCM (base legal = RDCs)")
    for cod, a in anuencias.items():
        exig = a["regra"] or "Regularização/anuência sanitária; validar modalidade no LPCO"
        base = a["trat"] or "ANVISA"
        out.append(
            "insert into ncm_anuencia (ncm_codigo, orgao_id, exigencia, base_legal) "
            f"select {sql_str(cod)}, id, {sql_str(exig)}, {sql_str(base)} "
            f"from orgao_anuente where nome = {sql_str(a['orgao'])} "
            "on conflict (ncm_codigo, orgao_id) do nothing;"
        )

    with io.open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")

    print(f"OK: {OUT}  ({len(ncm_rows)} NCMs, {len(anuencias)} anuências)")


if __name__ == "__main__":
    main()
