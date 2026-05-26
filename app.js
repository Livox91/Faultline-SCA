const dotenv = require('dotenv');
const fs = require('fs');
const http = require('http');
const { Octokit, App } = require('octokit');
const { createNodeMiddleware } = require('@octokit/webhooks');
const SCAOrchestrator = require('./orchestrator');

// Load environment variables from .env file
dotenv.config();

// Set configured values
const appId = process.env.APP_ID;
const privateKeyPath = process.env.PRIVATE_KEY_PATH;
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const secret = process.env.WEBHOOK_SECRET;
const enterpriseHostname = process.env.ENTERPRISE_HOSTNAME;
const outputDir = process.env.OUTPUT_DIR || './output';

// Create an authenticated Octokit client authenticated as a GitHub App
const app = new App({
  appId,
  privateKey,
  webhooks: {
    secret
  },
  ...(enterpriseHostname && {
    Octokit: Octokit.defaults({
      baseUrl: `https://${enterpriseHostname}/api/v3`
    })
  })
});

// Optional: Get & log the authenticated app's name
(async () => {
  try {
    const { data } = await app.octokit.request('/app');
    app.octokit.log.debug(`Authenticated as '${data.name}'`);

    // Initialize SCA Orchestrator
    console.log('\n🚀 Initializing Static Code Analyzer...\n');
    const orchestrator = new SCAOrchestrator({ outputDir });
    await orchestrator.initialize();

    console.log('✓ SCA Orchestrator ready to process events\n');

    /**
     * Map GitHub events to SCA event types
     */
    function mapEventType(githubEvent) {
      const eventMap = {
        'push': 'push',
        'pull_request': 'pull_request',
        'repository_vulnerability_alert': 'repository_vulnerability_alert',
        'code_scanning_alert': 'code_scanning_alert',
        'release': 'release',
        'workflow_run': 'workflow_run',
        'issues': 'issues',
        'issue_comment': 'issues_comment',
        'deployment_status': 'deployment_status',
      };
      return eventMap[githubEvent] || githubEvent;
    }

    /**
     * Process GitHub webhook through SCA orchestrator
     */
    async function processSCAEvent(eventType, payload) {
      try {
        const scaEventType = mapEventType(eventType);
        console.log(`\n📨 Received GitHub event: ${eventType}`);
        console.log(`🔄 Processing as SCA event: ${scaEventType}\n`);

        // Create SCA event payload
        const scaEvent = {
          event_type: scaEventType,
          ...payload
        };

        // Process through orchestrator
        await orchestrator.processGitHubEvent(scaEvent);

        // Trigger reindex if needed
        if (['push', 'pull_request', 'code_scanning_alert'].includes(scaEventType)) {
          await orchestrator.triggerIncrementalReindex();
        }

        console.log(`✓ Event processed successfully\n`);
      } catch (error) {
        console.error(`❌ Error processing event: ${error.message}\n`, error);
      }
    }

    // Hook into GitHub webhook events
    const hookEvents = [
      'push',
      'pull_request',
      'repository_vulnerability_alert',
      'code_scanning_alert',
      'release',
      'workflow_run',
      'issues',
      'issue_comment',
      'deployment_status'
    ];

    hookEvents.forEach(eventType => {
      app.webhooks.on(eventType, async ({ octokit, payload }) => {
        await processSCAEvent(eventType, payload);
      });
    });

    // Optional: Handle errors
    app.webhooks.onError((error) => {
      if (error.name === 'AggregateError') {
        console.error(`Error processing request: ${error.event}`);
      } else {
        console.error(`Webhook error: ${error.message}`, error);
      }
    });

    // Launch a web server to listen for GitHub webhooks
    const port = process.env.PORT || 3000;
    const path = '/api/webhook';
    const localWebhookUrl = `http://localhost:${port}${path}`;

    // See https://github.com/octokit/webhooks.js/#createnodemiddleware for all options
    const middleware = createNodeMiddleware(app.webhooks, { path });

    const server = http.createServer(middleware);

    server.listen(port, () => {
      console.log(`\n✅ SCA Server listening at: ${localWebhookUrl}`);
      console.log(`📊 Output directory: ${outputDir}`);
      console.log('Press Ctrl + C to quit.\n');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n📊 Generating final report before shutdown...');
      try {
        await orchestrator.generateReport();
        console.log('✓ Final report generated');
      } catch (error) {
        console.error('Error generating final report:', error);
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
})();
