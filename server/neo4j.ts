/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Conexão com o Neo4j Aura (SAT-Graph RAG — grafo de conformidade aduaneira).
 * SOMENTE LEITURA. As credenciais vêm de env (nunca do browser). Se não houver
 * NEO4J_URI/USER/PASSWORD, `getDriver()` devolve null e as rotas respondem 503.
 */
import neo4j, { Driver, isInt } from 'neo4j-driver';

let driver: Driver | null = null;

export function getDriver(): Driver | null {
  if (driver) return driver;
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const pass = process.env.NEO4J_PASSWORD;
  if (!uri || !user || !pass) return null;
  driver = neo4j.driver(uri, neo4j.auth.basic(user, pass));
  return driver;
}

// Converte Integer do Neo4j (contagens etc.) para number JS.
function normalize(value: unknown): unknown {
  if (isInt(value)) return (value as { toNumber(): number }).toNumber();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = normalize(v);
    return out;
  }
  return value;
}

/** Executa um Cypher de leitura e devolve as linhas como objetos. */
export async function query(cypher: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> {
  const d = getDriver();
  if (!d) throw new Error('Neo4j não configurado (defina NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD).');
  // Aura Free: o database chama-se "neo4j" (o id 785150a4 é a instância, não o db).
  const database = process.env.NEO4J_DATABASE || 'neo4j';
  const session = d.session({ database, defaultAccessMode: neo4j.session.READ });
  try {
    const res = await session.executeRead((tx) => tx.run(cypher, params));
    return res.records.map((r) => normalize(r.toObject()) as Record<string, unknown>);
  } finally {
    await session.close();
  }
}
