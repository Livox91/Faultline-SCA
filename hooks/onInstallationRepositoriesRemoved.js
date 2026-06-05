const { downloadRepoArchive } = require('../domain/repoExtractor');
const { dropDatabase } = require('../neo4j/driver');

async function onInstallationRepositoriesRemoved(app, payload) {
    const repositories = payload.repositories_removed;
    for (const repoInfo of repositories) {
        const [owner, repo] = repoInfo.full_name.split("/");


        try {
            await dropDatabase(`${owner}_${repo}`);

        } catch (error) {
            console.error(`Error: ${error.message}`);
        }
    }
}

module.exports = {
    onInstallationRepositoriesRemoved
};