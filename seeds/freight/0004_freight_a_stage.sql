-- GERADO POR scripts/etl/parse_rate_sheet.py — NÃO EDITAR À MÃO.
-- Fonte: rate sheet 0901.xlsx | importado em 2026-09-01T17:18:19

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
insert into mcat.ports (unlocode, name, country, lat, lon) values
('ARBUE','Buenos Aires','AR',-34.6,-58.38),
('BRIOA','Itapoá','BR',-26.11,-48.61),
('BRITJ','Itajaí','BR',-26.91,-48.66),
('BRMAO','Manaus','BR',-3.13,-60.02),
('BRNVT','Navegantes','BR',-26.9,-48.65),
('BRPEC','Pecém','BR',-3.55,-38.81),
('BRPNG','Paranaguá','BR',-25.52,-48.51),
('BRRIG','Rio Grande','BR',-32.04,-52.1),
('BRRIO','Rio de Janeiro','BR',-22.9,-43.2),
('BRSSA','Salvador','BR',-12.97,-38.51),
('BRSSZ','Santos','BR',-23.96,-46.33),
('BRSUA','Suape','BR',-8.39,-34.96),
('BRVIX','Vitória','BR',-20.32,-40.34),
('BRVLC','Vila do Conde','BR',-1.54,-48.75),
('CNAQG','Anqing','CN',30.51,117.05),
('CNCKG','Chongqing','CN',29.56,106.55),
('CNCNG','Changshu','CN',31.65,120.75),
('CNCZX','Changzhou','CN',31.81,119.97),
('CNDLC','Dalian','CN',38.92,121.63),
('CNFOC','Fuzhou','CN',26.07,119.3),
('CNFOS','Foshan','CN',23.02,113.12),
('CNGMI','Gaoming','CN',22.9,112.89),
('CNHUA','Huangpu','CN',23.09,113.42),
('CNJIA','Jiangyin','CN',31.92,120.28),
('CNJIU','Jiujiang','CN',29.71,116.0),
('CNJMN','Jiangmen','CN',22.58,113.08),
('CNLYG','Lianyungang','CN',34.6,119.22),
('CNNCH','Nanchang','CN',28.68,115.86),
('CNNGB','Ningbo','CN',29.87,121.55),
('CNNKG','Nanjing','CN',32.06,118.8),
('CNNSA','Nansha','CN',22.8,113.6),
('CNNTG','Nantong','CN',32.01,120.86),
('CNQZH','Qinzhou','CN',21.95,108.62),
('CNSHA','Shanghai','CN',31.23,121.47),
('CNSHD','Shunde','CN',22.8,113.29),
('CNSHK','Shekou','CN',22.48,113.9),
('CNSNS','Sanshui','CN',23.16,112.9),
('CNSWA','Shantou','CN',23.35,116.68),
('CNSZX','Shenzhen','CN',22.54,114.06),
('CNTAC','Taicang','CN',31.45,121.1),
('CNTAO','Qingdao','CN',36.07,120.32),
('CNTXG','Tianjin/Xingang','CN',38.98,117.78),
('CNTZO','Taizhou','CN',32.49,119.92),
('CNWHI','Wuhu','CN',31.35,118.38),
('CNWUH','Wuhan','CN',30.59,114.3),
('CNWUZ','Wuzhou','CN',23.48,111.28),
('CNXLN','Xiaolan','CN',22.66,113.25),
('CNXMN','Xiamen','CN',24.48,118.09),
('CNYIC','Yichang','CN',30.69,111.29),
('CNYTN','Yantian','CN',22.58,114.27),
('CNYZH','Yangzhou','CN',32.39,119.42),
('CNZHA','Zhanjiang','CN',21.27,110.36),
('CNZHE','Zhenjiang','CN',32.19,119.42),
('CNZJG','Zhangjiagang','CN',31.88,120.55),
('CNZSN','Zhongshan','CN',22.52,113.39),
('CNZUH','Zhuhai','CN',22.27,113.58),
('HKHKG','Hong Kong','HK',22.32,114.17),
('IDSRG','Semarang','ID',-6.97,110.42),
('MYPKG','Port Klang','MY',3.0,101.39),
('PYASU','Assunção','PY',-25.28,-57.63),
('THBKK','Bangkok','TH',13.7,100.52),
('THLCH','Laem Chabang','TH',13.08,100.88),
('UYMVD','Montevidéu','UY',-34.9,-56.19),
('VNSGN','Ho Chi Minh','VN',10.77,106.7)
on conflict (unlocode) do update set name = excluded.name, lat = excluded.lat, lon = excluded.lon;
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
