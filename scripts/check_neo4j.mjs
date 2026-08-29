/**
 * Diagnóstico da conexão Neo4j. Uso: npm run check:neo4j
 * Não expõe a senha — só valida e explica o erro.
 */
import 'dotenv/config';
import neo4j from 'neo4j-driver';

const { NEO4J_URI: uri, NEO4J_USER: user, NEO4J_PASSWORD: pass, NEO4J_DATABASE: db = 'neo4j' } = process.env;

console.log('\n── Configuração ──');
console.log('URI     :', uri || '(vazio)');
console.log('USER    :', user || '(vazio)');
console.log('DATABASE:', db);
console.log('PASSWORD:', pass ? `${pass.length} caracteres` : '(vazio)');

if (!uri || !user || !pass) {
  console.log('\n❌ Faltam variáveis no .env (NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD).\n');
  process.exit(1);
}
if (user.includes('@')) {
  console.log('\n⚠️  NEO4J_USER parece um e-mail. O usuário do BANCO é sempre "neo4j"\n    (o e-mail é o login do console, credencial diferente).\n');
}

const d = neo4j.driver(uri, neo4j.auth.basic(user, pass));
// O nome do database varia: no Aura Free costuma ser "neo4j", mas algumas
// instâncias usam o próprio id. Testamos os dois antes de desistir.
const instanceId = (uri.match(/\/\/([^.]+)\./) || [])[1];
const candidatos = [...new Set([db, 'neo4j', instanceId].filter(Boolean))];
try {
  const info = await d.getServerInfo();
  let s, usado;
  for (const cand of candidatos) {
    try { const t = d.session({ database: cand }); await t.run('RETURN 1'); s = t; usado = cand; break; }
    catch { /* tenta o próximo */ }
  }
  if (!s) throw new Error('Nenhum database acessível: ' + candidatos.join(', '));
  if (usado !== db) console.log(`
⚠️  DATABASE correto é "${usado}" (o .env tem "${db}") — ajuste NEO4J_DATABASE.`);
  const r = await s.run('MATCH (n) RETURN count(n) AS total');
  const labels = await s.run('MATCH (n) RETURN labels(n)[0] AS label, count(n) AS t ORDER BY t DESC LIMIT 5');
  await s.close();
  console.log('\n✅ CONECTADO —', info.agent);
  console.log('   total de nós:', r.records[0].get('total').toString());
  console.log('   top labels  :', labels.records.map(x => `${x.get('label')}(${x.get('t')})`).join(', '));
  console.log('\n   Pronto: rode `npm run dev` e teste /api/sat-graph/test\n');
} catch (e) {
  const code = e.code || '';
  console.log('\n❌ FALHOU:', code || e.message.split('\n')[0]);
  if (code.includes('Unauthorized')) {
    console.log(`
   A instância respondeu, mas recusou a credencial. Confira no console
   (console.neo4j.io) a instância cujo ID bate com a URI acima:

     • O "Connection URI" dela é exatamente ${uri} ?
       Se for outro, atualize NEO4J_URI no .env.
     • A senha resetada foi a DESSA instância?
     • Usuário do banco é sempre "neo4j" (não o e-mail do console).
`);
  } else if (code.includes('ServiceUnavailable') || /getaddrinfo|ENOTFOUND/.test(e.message)) {
    console.log('\n   Instância inacessível: URI errada ou instância pausada/removida.\n');
  }
} finally {
  await d.close();
}
