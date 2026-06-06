const { downloadRepoArchive } = require('../domain/repoExtractor');
const { createDatabase } = require('../neo4j/driver');
const { listAndIngestCommits } = require('../domain/listCommits');
const { buildAstGraph } = require('../domain/astGraph');
const fs = require('fs');
const path = require('path');

function sanitizeNeo4jDbName(inputString) {
    return inputString
        .toLowerCase()                     // 1. Force lowercase (Neo4j requirement)
        .replace(/[^a-z0-9.-]/g, '-')     // 2. Replace any illegal character with a dash
        .replace(/^[^a-z]+/, '')           // 3. Remove leading non-letters (must start with a letter)
        .substring(0, 63);                 // 4. Enforce Neo4j's 63-character limit
}

const fileDir = path.join(__dirname, '../tempDir');

async function onInstallationRepositoriesAdded(app, payload) {
    const repositories = payload.repositories_added;
    for (const repoInfo of repositories) {
        const [owner, repo] = repoInfo.full_name.split("/");
        const ref = "master"; // CAN BE CHANGED !!!!
        try {
            await downloadRepoArchive(app, owner, repo, ref, fileDir);
            await createDatabase(sanitizeNeo4jDbName(`${owner}_${repo}`));
            await listAndIngestCommits(app, owner, repo);
            await buildAstGraph(fileDir, owner, repo);
            console.log(`Successfully requested archive for ${owner}/${repo}`);
        } catch (error) {
            console.error(`Error: ${error.message}`);
        }
    }
}

module.exports = {
    onInstallationRepositoriesAdded
};