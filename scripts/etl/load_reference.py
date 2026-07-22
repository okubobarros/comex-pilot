#!/usr/bin/env python3
"""
ETL das tabelas de REFERÊNCIA para o schema `mcat` (Sprint 1).

Carrega, de forma idempotente (upsert), a partir de data/sources/*.xlsx:
  - ncm            (base NCM completa — Tabela_NCM_Vigente)
  - ncm_tributo    (II/IPI/PIS/COFINS + flags — aba `tax` do tax_calc; a `Ctax` está vazia)
  - icms_uf        (aba icms; normaliza vírgula decimal; AFRMM federal fica em afrmm_aliquota)
  - siscomex_taxa  (aba siscomex)
  - cambio_ptax    (aba exchange_rate — bootstrap; produção via API BCB)

Uso:
  export DATABASE_URL="postgres://...supabase...:5432/postgres"   # ligação DIRETA (session mode)
  python scripts/etl/load_reference.py

Requisitos: psycopg[binary], openpyxl. Não toca em segredos: lê DATABASE_URL do ambiente.
"""
from __future__ import annotations
import datetime as dt
import os
import re
import sys
from itertools import islice

import openpyxl
import psycopg

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "data", "sources")
NCM_XLSX = os.path.join(SRC, "ncm_vigente.xlsx")
TAX_XLSX = os.path.join(SRC, "tax_calc.xlsx")
SENTINEL_FIM = dt.date(9999, 12, 31)


def num(v) -> float | None:
    if v is None or str(v).strip() == "":
        return None
    try:
        return float(str(v).replace(",", ".").strip())
    except ValueError:
        return None


def to_bool(v) -> bool:
    return str(v).strip().lower() in ("sim", "true", "1", "s")


def to_date(v) -> dt.date | None:
    if v is None or str(v).strip() == "":
        return None
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    s = str(v).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return dt.datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def nivel_de(codigo: str) -> int:
    return len(re.sub(r"[^0-9]", "", codigo))


def sheet(path: str, name: str):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[name]
    for row in ws.iter_rows(values_only=True):
        yield row
    wb.close()


# ---------- parsing das planilhas ----------

def parse_ncm() -> list[tuple]:
    rows, out = list(sheet(NCM_XLSX, "Tabela NCM")), []
    for r in rows[5:]:  # header na linha 5 (índice 4); dados a partir da 6
        cod = (str(r[0]).strip() if r and r[0] is not None else "")
        if not cod or cod.lower().startswith("código"):
            continue
        desc = (str(r[1]).strip() if len(r) > 1 and r[1] is not None else "")
        vi = to_date(r[2]) if len(r) > 2 else None
        vf = to_date(r[3]) if len(r) > 3 else None
        ato = " ".join(str(x).strip() for x in (r[4:7] if len(r) > 4 else []) if x is not None)
        out.append((cod, desc, nivel_de(cod), vi or dt.date(2022, 4, 1), vf or SENTINEL_FIM, ato or None))
    return out


def parse_tributos(ncm_codes: set[str]) -> list[tuple]:
    # Aba "tax" (não "Ctax"): 10.519 linhas, 100% com II. Colunas:
    # 0 Código | 1 Código2 | 2 Desc.Concat | 3 Descrição | 4 II | 5 IPI | 6 PIS | 7 COFINS
    # | 8 CIDE | 9 Antidumping | 10 Medidas Comp | 11 Tratamentos Adm
    out = []
    for i, r in enumerate(sheet(TAX_XLSX, "tax")):
        if i == 0:
            continue  # header
        cod = (str(r[0]).strip() if r and r[0] is not None else "")
        if not cod or cod not in ncm_codes:
            continue  # respeita a FK: só tributo de NCM existente
        out.append((
            cod, dt.date(2026, 1, 1), num(r[4]), num(r[5]), num(r[6]), num(r[7]),
            to_bool(r[8]) if len(r) > 8 else False,
            to_bool(r[9]) if len(r) > 9 else False,
            to_bool(r[10]) if len(r) > 10 else False,
            (str(r[11]).strip() if len(r) > 11 and r[11] is not None else None),
        ))
    return out


def parse_icms() -> list[tuple]:
    out = []
    for i, r in enumerate(sheet(TAX_XLSX, "icms")):
        if i == 0 or not r or r[0] is None:
            continue
        out.append((str(r[0]).strip(), str(r[1]).strip(), num(r[2]), num(r[4]) if len(r) > 4 else None))
    return out


def parse_siscomex() -> list[tuple]:
    out = []
    for i, r in enumerate(sheet(TAX_XLSX, "siscomex")):
        if i == 0 or not r or r[0] is None:
            continue
        q = num(r[0])
        if q is None:
            continue
        out.append((int(q), num(r[1]), num(r[2])))
    return out


def parse_cambio() -> list[tuple]:
    out = []
    for i, r in enumerate(sheet(TAX_XLSX, "exchange_rate")):
        if i == 0 or not r or r[0] is None:
            continue
        d, usd = to_date(r[0]), num(r[1]) if len(r) > 1 else None
        if d is None or usd is None:
            continue  # dias sem PTAX
        out.append((d, usd, num(r[2]) if len(r) > 2 else None))
    return out


# ---------- carga ----------

def load(cur, sql: str, rows: list[tuple], label: str) -> None:
    if not rows:
        print(f"  {label}: 0 (vazio)")
        return
    cur.executemany(sql, rows)
    print(f"  {label}: {len(rows)} linhas")


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("ERRO: defina DATABASE_URL (ligação direta do Postgres/Supabase).")

    print("Lendo planilhas...")
    ncm = parse_ncm()
    ncm_codes = {r[0] for r in ncm}
    tributos = parse_tributos(ncm_codes)
    icms, siscomex, cambio = parse_icms(), parse_siscomex(), parse_cambio()
    print(f"  ncm={len(ncm)} tributos={len(tributos)} icms={len(icms)} siscomex={len(siscomex)} cambio={len(cambio)}")

    print("Carregando no banco (schema mcat)...")
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute("set search_path to mcat, public")
            load(cur, """
                insert into ncm (codigo, descricao, nivel, vigencia_inicio, vigencia_fim, ato_legal)
                values (%s,%s,%s,%s,%s,%s) on conflict (codigo) do nothing
            """, ncm, "ncm")
            load(cur, """
                insert into ncm_tributo
                  (ncm_codigo, vigencia_inicio, ii_pct, ipi_pct, pis_pct, cofins_pct,
                   cide, antidumping, medidas_comp, tratamentos_adm)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                on conflict (ncm_codigo, vigencia_inicio) do nothing
            """, tributos, "ncm_tributo")
            load(cur, """
                insert into icms_uf (uf, estado, icms_pct, taxa_utilizacao_mm)
                values (%s,%s,%s,%s) on conflict (uf) do nothing
            """, icms, "icms_uf")
            load(cur, """
                insert into siscomex_taxa (qtde_adicoes, valor_por_adicao, valor_total)
                values (%s,%s,%s) on conflict (qtde_adicoes) do nothing
            """, siscomex, "siscomex_taxa")
            load(cur, """
                insert into cambio_ptax (data, usd_brl, eur_brl)
                values (%s,%s,%s) on conflict (data) do nothing
            """, cambio, "cambio_ptax")
        conn.commit()
    print("Concluído.")


if __name__ == "__main__":
    main()
