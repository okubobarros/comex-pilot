// ============================================================================
// Trocar a senha do usuário `neo4j` a partir do Query Studio do console.
//
// COMO USAR
// 1. console.neo4j.io → instância `sat-graph-rag` → botão "Open" → Query
//    (o Query Studio conecta pela sua sessão do console, NÃO pede a senha do banco)
// 2. No seletor de database (canto superior), troque para `system`
//    — comandos de usuário só rodam no database `system`.
// 3. Cole a linha abaixo, troque a senha, e execute.
//
// Regras da senha no Aura: mínimo 8 caracteres. Evite aspas simples.
// ============================================================================

ALTER USER neo4j SET PASSWORD 'TroqueEstaSenha2026';


// ----------------------------------------------------------------------------
// Se o comando acima der "permission denied", tente esta variante (exige saber
// a senha atual — só serve se você a tiver em algum lugar):
//
// ALTER CURRENT USER SET PASSWORD FROM 'senhaAtual' TO 'senhaNova';
//
// Se nenhuma funcionar, use o caminho do CLONE (ver docs/ops/sat-graph.md):
// menu ⋯ → "Clone To" → cria uma instância nova COM OS DADOS e mostra as
// credenciais novas na criação. Nunca use "Reset To Blank" (apaga o grafo).
// ----------------------------------------------------------------------------
