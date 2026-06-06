
const { Octokit, App } = require('octokit');
const fs = require('fs');
const path = require('path');

async function downloadRepoArchive(installationOctokit, owner, repo, ref, fileDir) {

    const response = await installationOctokit.rest.repos.downloadZipballArchive({
        owner,
        repo,
    });

    const filePath = path.join(fileDir, `${owner}_${repo}.zip`);
    const buffer = Buffer.from(response.data);
    fs.writeFileSync(filePath, buffer);
    console.log(`Saved archive to ${filePath}`);

    // extract the archive to ../tempDir
    const extract = require('extract-zip');
    const extractPath = path.join(fileDir, `${owner}_${repo}`);
    await extract(filePath, { dir: extractPath });

    // delete the archive file after extraction
    fs.unlinkSync(filePath);


    console.log(`Extracted archive to ${extractPath}`);
}

module.exports = {
    downloadRepoArchive
};