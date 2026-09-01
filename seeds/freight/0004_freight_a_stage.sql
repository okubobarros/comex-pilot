-- GERADO POR scripts/etl/parse_rate_sheet.py — NÃO EDITAR À MÃO.
-- Fonte: rate sheet 0901.xlsx | importado em 2026-09-01T15:48:25

-- ============================================================================
-- PARTE A — tabelas de staging
-- Rode esta parte PRIMEIRO. Ela só cria estruturas de apoio; nenhuma tabela
-- definitiva é tocada. Sem tipos nem constraints: staging deve ser tolerante,
-- a validação acontece na parte C.
-- ============================================================================
set search_path to mcat, public;

create table if not exists mcat._stage_route (
  route_key int, carrier text, pol text, pod text, trade_lane text,
  service_type text, service_name text, validity_start text, validity_end text,
  validity_raw text, vessel_ref text, space_status text, sheet text,
  source_row int, carrier_scope text, free_days_pol int, free_days_pod int,
  free_time_raw text
);
create table if not exists mcat._stage_rate (
  route_key int, equipment_type text, also_valid_for text, base_rate numeric,
  currency text, unit text, adjusted_rate numeric, weight_operator text,
  weight_limit_ton numeric, weight_basis text, cargo_type text,
  rate_source text, raw_cell text
);
create table if not exists mcat._stage_surcharge (
  route_key int, fee_code text, fee_label text, amount numeric, currency text,
  charge_basis text, equipment_type text, min_weight_ton numeric,
  condition_raw text, source_column text
);
create table if not exists mcat._stage_issue (
  sheet text, source_row int, severity text, kind text, detail text
);
create table if not exists mcat._stage_map (route_key int, route_id uuid);

truncate mcat._stage_route, mcat._stage_rate, mcat._stage_surcharge,
         mcat._stage_issue, mcat._stage_map;


-- Dimensões (idempotentes)
insert into mcat.ports (unlocode, name, country) values
('ARBUE','Buenos Aires','AR'),
('BRIOA','Itapoá','BR'),
('BRITJ','Itajaí','BR'),
('BRMAO','Manaus','BR'),
('BRNVT','Navegantes','BR'),
('BRPEC','Pecém','BR'),
('BRPNG','Paranaguá','BR'),
('BRRIG','Rio Grande','BR'),
('BRRIO','Rio de Janeiro','BR'),
('BRSSA','Salvador','BR'),
('BRSSZ','Santos','BR'),
('BRSUA','Suape','BR'),
('BRVIX','Vitória','BR'),
('BRVLC','Vila do Conde','BR'),
('CNAQG','Anqing','CN'),
('CNCKG','Chongqing','CN'),
('CNCNG','Changshu','CN'),
('CNCZX','Changzhou','CN'),
('CNDLC','Dalian','CN'),
('CNFOC','Fuzhou','CN'),
('CNFOS','Foshan','CN'),
('CNGMI','Gaoming','CN'),
('CNHUA','Huangpu','CN'),
('CNJIA','Jiangyin','CN'),
('CNJIU','Jiujiang','CN'),
('CNJMN','Jiangmen','CN'),
('CNLYG','Lianyungang','CN'),
('CNNCH','Nanchang','CN'),
('CNNGB','Ningbo','CN'),
('CNNKG','Nanjing','CN'),
('CNNSA','Nansha','CN'),
('CNNTG','Nantong','CN'),
('CNQZH','Qinzhou','CN'),
('CNSHA','Shanghai','CN'),
('CNSHD','Shunde','CN'),
('CNSHK','Shekou','CN'),
('CNSNS','Sanshui','CN'),
('CNSWA','Shantou','CN'),
('CNSZX','Shenzhen','CN'),
('CNTAC','Taicang','CN'),
('CNTAO','Qingdao','CN'),
('CNTXG','Tianjin/Xingang','CN'),
('CNTZO','Taizhou','CN'),
('CNWHI','Wuhu','CN'),
('CNWUH','Wuhan','CN'),
('CNWUZ','Wuzhou','CN'),
('CNXLN','Xiaolan','CN'),
('CNXMN','Xiamen','CN'),
('CNYIC','Yichang','CN'),
('CNYTN','Yantian','CN'),
('CNYZH','Yangzhou','CN'),
('CNZHA','Zhanjiang','CN'),
('CNZHE','Zhenjiang','CN'),
('CNZJG','Zhangjiagang','CN'),
('CNZSN','Zhongshan','CN'),
('CNZUH','Zhuhai','CN'),
('HKHKG','Hong Kong','HK'),
('IDSRG','Semarang','ID'),
('MYPKG','Port Klang','MY'),
('PYASU','Assunção','PY'),
('THBKK','Bangkok','TH'),
('THLCH','Laem Chabang','TH'),
('UYMVD','Montevidéu','UY'),
('VNSGN','Ho Chi Minh','VN')
on conflict (unlocode) do update set name = excluded.name;
insert into mcat.carriers (code, name) values
('PIL','PIL'),
('CMA','CMA'),
('YML','YML'),
('HMM','HMM'),
('COSCO','COSCO'),
('ONE','ONE'),
('OOCL','OOCL'),
('MSK','MSK'),
('MSC','MSC'),
('EMC','EMC'),
('CSSC','CSSC'),
('HPL','HPL')
on conflict (code) do update set name = excluded.name;
