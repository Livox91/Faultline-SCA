const analyzeRepository = require("../parsers/repoAnalyzer");
const { driver } = require("../neo4j/driver");

function sanitizeNeo4jDbName(inputString) {
    return inputString
        .toLowerCase()                     // 1. Force lowercase (Neo4j requirement)
        .replace(/[^a-z0-9.-]/g, '-')     // 2. Replace any illegal character with a dash
        .replace(/^[^a-z]+/, '')           // 3. Remove leading non-letters (must start with a letter)
        .substring(0, 63);                 // 4. Enforce Neo4j's 63-character limit
}

async function buildAstGraph(repoPath, owner, repo) {
    const astGraph = analyzeRepository(repoPath);
    const sanitized_name = sanitizeNeo4jDbName(`${owner}_${repo}`);
    const session = driver.session({ database: sanitized_name });
    try {

        await session.run(
            `
            UNWIND $nodes AS node

            CALL {
                WITH node
                MERGE (n:Symbol {id: node.id})
                SET n += node
                RETURN count(*) AS ignored
            }
            RETURN count(*)
            `,
            {
                nodes: astGraph.nodes
            }
        );
        for (const relType of [
            "IMPORTS",
            "DECLARES",
            "EXTENDS",
            "IMPLEMENTS",
            "CALLS"
        ]) {
            const rels =
                astGraph.relationships.filter(
                    r => r.type === relType
                );

            if (!rels.length)
                continue;

            await session.run(
                `
                UNWIND $rels AS rel
                MATCH (a {id: rel.from})
                MATCH (b {id: rel.to})
                MERGE (a)-[:${relType}]->(b)
                `,
                {
                    rels
                }
            );
        }
    } finally {
        await session.close();
    }
}

module.exports = {
    buildAstGraph
};