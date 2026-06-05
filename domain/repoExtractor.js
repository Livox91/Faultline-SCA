const fs = require('fs');
const path = require('path');
const { Octokit, App } = require('octokit');

async function downloadRepoArchive(installationOctokit, owner, repo, ref) {

    const response = await installationOctokit.rest.repos.downloadZipballArchive({
        owner,
        repo,
    });

    const filePath = path.join(__dirname, `${repo}-${ref}.zip`);
    const buffer = Buffer.from(response.data);
    fs.writeFileSync(filePath, buffer);
    console.log(`Saved archive to ${filePath}`);
}

module.exports = {
    downloadRepoArchive
};