# Módulo de Cotação de Frete Marítimo

Transforma a rate sheet do armador — uma planilha de agrupamentos manuais — num
comparador de custo total consultável por par origem/destino, equipamento e peso.

**Fonte processada:** `rate sheet 0901.xlsx` (3 abas, 139 linhas úteis)
**Resultado:** 12 armadores · 64 portos · 1.273 rotas · 2.966 cotações · 15 ressalvas

---

## 1. O problema: uma linha não é uma cotação

A linha `Brasil!L14` da planilha:

| Carrier | POL | POD | 20'GP | 40'GP/40'HQ | 40'NOR | Subject to | Validity | Free time |
|---|---|---|---|---|---|---|---|---|
| *(mesclada: PIL)* | Xiamen | Navegantes/Itapoa/Paranagua | 8800 | 9700，（9400<=16ton cargo weight) | 8500 | isps usd15 | 9.01~9.07 （KOTA MACHAN 0551S） | 21/18 days |

Isso é **9 cotações** (1 POL × 3 PODs × 3 equipamentos), uma delas com tarifa
condicional a peso. Nenhuma busca por "Xiamen → Itapoá, 40'HQ" funciona sobre
essa estrutura, porque nenhuma dessas informações está num campo próprio.

### Os 12 padrões de agrupamento encontrados

| # | Padrão | Exemplo real | Tratamento |
|---|---|---|---|
| 1 | Carrier em célula mesclada | `A2:A23 = PIL` | forward fill |
| 2 | POL/POD múltiplos com `/` | `Navegantes/Itapoa/Santos/Rio De Janeiro` | produto cartesiano |
| 3 | Tarifa condicional a peso (4 sintaxes) | `9700，（9400<=16ton cargo weight)`, `8410<=10TON VGM`, `8410<VGM 10TON` | `weight_operator` + `weight_basis` |
| 4 | Override por destino | `8910，（RIO， 8610)` | tarifa própria da rota do RIO |
| 5 | Tarifa restrita a mercadoria | `8500 (Tyre)`, `5500 (Solar)` | `cargo_type` |
| 6 | Adicional embutido na tarifa | `9000+pct usd100` | vira surcharge |
| 7 | Equipamento sobrescrito | `7415 /40reefer` na coluna 40'NOR | `equipment_type = 40RF` |
| 8 | Coluna de equipamento com taxa | `+local agent H/C usd50+mbl courier cost usd65` | vira surcharge, não tarifa |
| 9 | Portos colados por erro | `Tianjin/XingangQingdao/Shanghai` | de-glue automático |
| 10 | Validade sem ano, 5 formatos | `9.01~9.07`, `ETD:9/07`, `ETD Sep.08`, `4.01-4.04`, `11.31` | inferência de ano + validação de calendário |
| 11 | Free time composto | `21 /18 days` | dois campos |
| 12 | Taxa escalonada no Remark | `OWS USD200/20GP >14 ton, USD500/20GP >20ton` | duas faixas, aplicação exclusiva |

Some-se a isso: pontuação de largura plena (`，（）～`, ambiente CJK), notas em
chinês no meio da validade, barras duplas, e a mesma cidade escrita de 3 jeitos.

---

## 2. Modelo de dados

`migrations/0003_freight.sql`, schema `mcat`.

```
carriers ──┐
ports ─────┼──> freight_routes ──┬──> equipment_rates
rate_sheets┘   (1 rota = 1 POL   ├──> rate_surcharges
                × 1 POD)         └──> free_time_rules
                                 
rate_sheets ──> rate_issues   (trilha de qualidade)
```

O grão de `freight_routes` é **um par origem/destino**. É o que torna a pergunta
comercial respondível com um índice, em vez de um `LIKE '%Itapoa%'`.

### Decisões que não são óbvias

**Portos por UN/LOCODE, não por nome.** É o LOCODE que resolve `Tianjin` e
`Xingang` como o mesmo porto (CNTXG — Xingang *é* o porto novo de Tianjin, e a
planilha os separa com barra) e `Ninbgo`/`Ningbo` como o mesmo destino. Sem isso,
o split por `/` criaria portos fantasma e a busca por par nunca fecharia.

**`weight_basis` (VGM × CARGO) é campo de primeira classe.** VGM inclui a tara do
contêiner; peso de mercadoria não. Uma regra "9000 se ≤ 18 t VGM" aplicada sobre
15 t de carga concede um desconto que o armador glosa na fatura — 15 t num 40'HQ
são ~18,9 t de VGM. O motor converte antes de comparar e explica a conta.

**`rate_issues` guarda o que o parser não pôde afirmar.** Tarifa com dígito
faltando, data que não existe no calendário, porto fora do dicionário: vira
linha de auditoria em vez de sumir. Num produto de conformidade, dizer no que
*não* confiar vale tanto quanto o número.

**A coluna `40'GP/40'HQ` é uma tarifa para dois equipamentos.** Guardada como
`40HQ` + `also_valid_for='40GP'`, então filtrar por 40'GP encontra a tarifa sem
duplicar a linha.

---

## 3. Motor de cálculo

`src/engine/freight.ts` — função pura, sem I/O, coberta por
`npm run test:freight` (24 asserções sobre células reais da planilha).

Ordem de aplicação:

1. **Tarifa base** ou **faixa de peso**, se o peso informado a libera (com
   conversão CARGO ⇄ VGM pela tara do equipamento).
2. **Taxas fixas** (ISPS, CSS, SPG, PCT...), filtradas por equipamento.
3. **Taxas por excesso de peso**, aplicadas de forma **exclusiva**: entre
   USD 200 (>14 t) e USD 500 (>20 t), uma carga de 22 t paga só a de 500 —
   não as duas.

Tara adotada (t): 20GP 2,2 · 40GP 3,75 · 40HQ 3,9 · 40NOR 3,8 · 40RF 4,6.

A ordenação nunca deixa uma tarifa expirada liderar, mesmo sendo a mais barata.
Sem essa regra, a HPL a USD 1.915 (validade `4.01-4.04`, 5 meses vencida) seria
apresentada como a melhor opção para Montevidéu.

---

## 4. Interface

`src/components/freight/FreightWorkspace.tsx`

- **Filtros:** POL, POD, equipamento, peso (+ seletor carga/VGM), tipo de
  mercadoria, incluir expiradas.
- **Matriz comparativa** ordenada por **custo total** (frete + taxas), não por
  tarifa cheia. A economia por faixa de peso aparece na própria linha.
- **Painel lateral:** composição do custo linha a linha, ressalvas antes de
  fechar, regras operacionais (free time, navio, validade crua) e a **fonte**
  (aba + linha da planilha).
- **Saída:** `Exportar para Custeio de Importação` leva o total ao campo de
  frete **e alinha o porto de entrada ao POD cotado** — o ICMS depende da UF de
  desembaraço, então importar o valor sem o porto produziria um custo errado em
  silêncio.

Tarifas de nicho (pneu, solar, têxtil, reefer) ficam **fora** da busca de carga
geral: são preços restritos que puxariam a comparação para baixo indevidamente.

---

## 5. Como rodar

```bash
npm run etl:freight -- "C:\caminho\rate sheet 0901.xlsx" --year 2026
```

Gera dois artefatos com o mesmo conteúdo:

- `src/data/freightRates.json` — base embarcada, servida por padrão
- `seeds/0004_freight_rates.sql` — carga idempotente para o Postgres/Supabase

```bash
npm run test:freight      # motor de cálculo
```

Para usar o Postgres como fonte: aplicar `migrations/0003_freight.sql` e
`seeds/0004_freight_rates.sql`, depois definir `FREIGHT_SOURCE=db` +
`DATABASE_URL`. A view `mcat.v_freight_quotes` devolve o mesmo formato da base
embarcada, então o motor de cálculo não muda.

---

## 6. Premissas e limites — ler antes de usar em produção

**O ano das validades é inferido.** A planilha escreve `9.01~9.07` sem ano. O ETL
usa `--year` (default: ano corrente) e registra a premissa em
`rate_sheets.assumed_year`. Com o arquivo `0901`, assumiu-se 2026.

**Free time: o significado dos dois números não está declarado.** `21 /18 days`
foi mapeado para `free_days_pol` / `free_days_pod` conforme o modelo pedido, mas
boa parte do mercado usa esse par como **demurrage / detention no destino**.
Confirmar com o armador antes de tratar como compromisso contratual.

**As 15 ressalvas do arquivo atual** (`GET /api/freight/issues`):

- `Brasil!L23` e `Uruguay!L14`: tarifa base `1000` com condicional `9800` —
  dígito faltando, provavelmente `10000`. **Precisa de confirmação do armador.**
- `LCL!L2`: validade `11.31` — 31 de novembro não existe.
- `Shanshan` (3 linhas): porto fora do dicionário. Pelo contexto (Delta do Rio
  das Pérolas) é provavelmente `Sanshui`, mas o parser **não adivinha** — essas
  rotas não foram geradas. Confirmar e adicionar o apelido em `PORTOS`.
- 5 linhas com validade não interpretável (`EVER FEAT`, `FE4 JONG00009W`): só
  nome de navio/serviço, sem data.
- `Uruguay!L56`: HPL a USD 1.450 no 40'NOR — implausível para contêiner e com
  validade de abril.

**O SQL não foi executado contra um Postgres vivo** nesta entrega (Docker
indisponível no ambiente). Foi validado estaticamente: as contagens de `insert`
batem exatamente com o JSON em todas as 7 tabelas, e o aspeamento está íntegro.
A base embarcada, essa sim, está exercitada de ponta a ponta pela UI e pelos
testes.

**Não há integração com API de armador.** A base é uma foto da planilha recebida;
não se atualiza sozinha. Cada nova rate sheet exige rodar o ETL.
