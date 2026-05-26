/**
 * SCA Configuration
 * Default configuration for the Static Code Analyzer
 */

module.exports = {
    // GitHub App Configuration
    github: {
        appId: process.env.GITHUB_APP_ID,
        privateKey: process.env.GITHUB_PRIVATE_KEY,
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    },

    // Output Configuration
    output: {
        directory: process.env.OUTPUT_DIR || './output',
        formats: ['json', 'graphml', 'csv', 'html'],
        includeStats: true,
        includeVisualization: true,
    },

    // Analysis Configuration
    analysis: {
        enableSecurityScanning: true,
        enableCodeQuality: true,
        enableCollaborationMetrics: true,
        enableGovernanceValidation: true,
    },

    // Processing Configuration
    processing: {
        enableIncrementalIndexing: true,
        maxDiffSize: 5000, // Maximum nodes to process in a single diff
        batchSize: 100, // Nodes per batch for processing
        cacheResults: true,
    },

    // Event Hooks Configuration
    hooks: {
        enabled: {
            sca: ['pull_request', 'push', 'repository_vulnerability_alert', 'code_scanning_alert'],
            orchestrator: [
                'release',
                'workflow_run',
                'issues',
                'issue_comment',
                'deployment_status',
            ],
        },
        retry: {
            enabled: true,
            maxAttempts: 3,
            backoffMs: 1000,
        },
    },

    // Server Configuration
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || '0.0.0.0',
        enableHealthCheck: true,
        enableMetrics: true,
    },

    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: 'json',
        outputFile: process.env.LOG_FILE || './logs/sca.log',
    },

    // Database Configuration (optional)
    database: {
        enabled: process.env.DATABASE_ENABLED === 'true' || false,
        type: process.env.DATABASE_TYPE || 'mongodb',
        url: process.env.DATABASE_URL,
    },

    // Security Configuration
    security: {
        validateWebhookSignature: true,
        allowedOrigins: (process.env.ALLOWED_ORIGINS || 'github.com').split(','),
        rateLimit: {
            enabled: true,
            maxRequestsPerMinute: 60,
        },
    },
};
