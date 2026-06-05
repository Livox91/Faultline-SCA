const fs = require('fs');
const http = require('http');
const { Octokit, App } = require('octokit');
const { createNodeMiddleware } = require('@octokit/webhooks');
const dotenv = require('dotenv');

//hooks
const { onInstallationRepositoriesAdded } = require('./hooks/onInstallationRepositoriesAdded');
const { onInstallationRepositoriesRemoved } = require('./hooks/onInstallationRepositoriesRemoved');


// Load environment variables from .env file
dotenv.config();

// Set configured values
const appId = process.env.APP_ID;
const privateKeyPath = process.env.PRIVATE_KEY_PATH;
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const secret = process.env.WEBHOOK_SECRET;

// Create an authenticated Octokit client authenticated as a GitHub App
const app = new App({
  appId,
  privateKey,
  webhooks: {
    secret
  }
});

//Get & log the authenticated app's name
(async () => {
  try {
    const { data } = await app.octokit.request('/app');
    app.octokit.log.debug(`Authenticated as '${data.name}'`);

    // 3. on Installation download the repository archive
    app.webhooks.on('installation_repositories.added', async ({ payload }) => {
      const installationId = payload.installation.id;
      const authOctokit = await app.getInstallationOctokit(installationId);
      await onInstallationRepositoriesAdded(authOctokit, payload);
    });

    // 4. on Installation removal drop the database
    app.webhooks.on('installation_repositories.removed', async ({ payload }) => {
      const installationId = payload.installation.id;
      const authOctokit = await app.getInstallationOctokit(installationId);
      await onInstallationRepositoriesRemoved(authOctokit, payload);
    });

    // Create an HTTP server to listen for webhook events on /api/webhook
    const server = http.createServer(createNodeMiddleware(app.webhooks, { path: '/api/webhook' }));
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      app.octokit.log.debug(`Server is listening on port ${PORT}`);
    });

  } catch (error) {
    app.octokit.log.error('Error authenticating GitHub App:', error);
    process.exit(1);
  }
})();
