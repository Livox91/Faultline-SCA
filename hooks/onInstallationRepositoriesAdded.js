const { downloadRepoArchive } = require('../domain/repoExtractor');
const { createDatabase } = require('../neo4j/driver');
const { listAndIngestCommits } = require('../domain/listCommits');

async function onInstallationRepositoriesAdded(app, payload) {
    const repositories = payload.repositories_added;
    for (const repoInfo of repositories) {
        const [owner, repo] = repoInfo.full_name.split("/");
        const ref = "master"; // CAN BE CHANGED !!!!
        try {
            // await downloadRepoArchive(app, owner, repo, ref);
            await createDatabase(`${owner}_${repo}`);
            await listAndIngestCommits(app, owner, repo);
            console.log(`Successfully requested archive for ${owner}/${repo}`);
        } catch (error) {
            console.error(`Error: ${error.message}`);
        }
    }
}

module.exports = {
    onInstallationRepositoriesAdded
};