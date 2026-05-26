/**
 * Static Code Analyzer (SCA) - Main Entry Point
 * 
 * This is the main orchestrator for the Static Code Analyzer system.
 * It manages GitHub event hooks, domain processing, and knowledge graph generation.
 */

const SCAOrchestrator = require('./orchestrator');
const scaHooks = require('./hooks/sca');
const orchestratorHooks = require('./hooks/orchestrator');

/**
 * Initialize and start the SCA system
 */
async function initializeSCA(config = {}) {
    try {
        console.log('Starting Static Code Analyzer...\n');

        const orchestrator = new SCAOrchestrator(config);
        await orchestrator.initialize();

        // Display available hooks
        console.log('\n📊 Available Hooks:');
        console.log('SCA Hooks:', scaHooks.getAvailableHooks().join(', '));
        console.log('Orchestrator Hooks:', orchestratorHooks.getAvailableHooks().join(', '));

        // Display initial status
        const status = orchestrator.getStatus();
        console.log('\n📈 System Status:', JSON.stringify(status, null, 2));

        return orchestrator;
    } catch (error) {
        console.error('Failed to initialize SCA:', error);
        process.exit(1);
    }
}

/**
 * Example: Process a GitHub webhook event
 */
async function processWebhookEvent(orchestrator, githubEvent) {
    try {
        console.log(`\nProcessing ${githubEvent.event_type} event...`);
        await orchestrator.processGitHubEvent(githubEvent);
    } catch (error) {
        console.error('Error processing webhook:', error);
    }
}

/**
 * Example: Generate knowledge graph report
 */
async function generateKnowledgeGraphReport(orchestrator) {
    try {
        console.log('\nGenerating knowledge graph report...');
        const report = await orchestrator.generateReport();
        console.log('Report generated:', report);
        return report;
    } catch (error) {
        console.error('Error generating report:', error);
    }
}

/**
 * Start as Express middleware (for GitHub webhooks)
 */
function createWebhookHandler(orchestrator) {
    return async (req, res) => {
        try {
            const eventType = req.headers['x-github-event'];
            const payload = req.body;

            console.log(`Received GitHub webhook: ${eventType}`);

            // Process the event
            await orchestrator.processGitHubEvent({
                event_type: eventType,
                ...payload,
            });

            res.status(200).json({ status: 'received', event: eventType });
        } catch (error) {
            console.error('Webhook handler error:', error);
            res.status(500).json({ error: error.message });
        }
    };
}

// Export for use as module
module.exports = {
    SCAOrchestrator,
    initializeSCA,
    processWebhookEvent,
    generateKnowledgeGraphReport,
    createWebhookHandler,
    hooks: {
        sca: scaHooks,
        orchestrator: orchestratorHooks,
    },
};

// Example usage if run directly
if (require.main === module) {
    (async () => {
        const orchestrator = await initializeSCA({
            outputDir: './output',
        });

        // Example: Generate report
        await generateKnowledgeGraphReport(orchestrator);
    })();
}
