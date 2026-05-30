/**
 * SCA Orchestrator
 * Central orchestrator for the Static Code Analyzer system
 */

const EventEmitter = require('events');
const scaHooks = require('./hooks/sca');
const orchestratorHooks = require('./hooks/orchestrator');
const domain = require('./domain');
const KnowledgeGraphGenerator = require('./output/knowledge-graph');
const MongoDBManager = require('./config/db-manager');
const DiffCalculator = domain.DiffCalculator;
const IndexingManager = domain.IndexingManager;

class SCAOrchestrator extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config;
        this.analyzers = domain.createAnalyzers();
        this.graphGenerator = new KnowledgeGraphGenerator(config.outputDir || './output');

        // Initialize MongoDB Manager with config
        const dbConfig = {
            url: config.mongoUrl || process.env.MONGODB_URL,
            options: config.mongoOptions || {}
        };
        this.databaseManager = new MongoDBManager(dbConfig);

        this.currentGraph = this.analyzers.graph.export();
        this.diffs = [];
        this.initialized = false;
    }

    /**
     * Initialize the orchestrator
     */
    async initialize() {
        try {
            console.log('Initializing SCA Orchestrator...');

            // Initialize database
            await this.databaseManager.initialize();

            // Initialize output directory
            await this.graphGenerator.initializeOutputDir();

            // Register hooks
            this.registerAllHooks();

            // Create initial indices
            this.analyzers.indexing.createIndices(this.currentGraph);

            this.initialized = true;
            console.log('✓ SCA Orchestrator initialized');
        } catch (error) {
            console.error('Failed to initialize orchestrator:', error);
            throw error;
        }
    }

    /**
     * Register all hooks
     */
    registerAllHooks() {
        console.log('Registering GitHub event hooks...');

        // Register SCA hooks
        scaHooks.getAvailableHooks().forEach(eventType => {
            this.registerHook(eventType, 'sca');
        });

        // Register orchestrator hooks
        orchestratorHooks.getAvailableHooks().forEach(eventType => {
            this.registerHook(eventType, 'orchestrator');
        });

        console.log(`✓ Registered ${scaHooks.getAvailableHooks().length + orchestratorHooks.getAvailableHooks().length} hooks`);
    }

    /**
     * Register a hook
     * @param {string} eventType - GitHub event type
     * @param {string} category - Hook category (sca or orchestrator)
     */
    registerHook(eventType, category) {
        const hookModule = category === 'sca' ?
            scaHooks.getHook(eventType) :
            orchestratorHooks.getHook(eventType);

        if (hookModule) {
            this.on(eventType, async (payload) => {
                try {
                    const result = await hookModule.handle(payload);
                    this.emit(`${eventType}:processed`, result);
                    await this.processEvent(result, hookModule);
                } catch (error) {
                    console.error(`Error processing ${eventType} event:`, error);
                    this.emit(`${eventType}:error`, { error, payload });
                }
            });
        }
    }

    /**
     * Process GitHub event
     * @param {Object} eventPayload - GitHub webhook payload
     */
    async processGitHubEvent(eventPayload) {
        const eventType = eventPayload.event_type;
        console.log(`Processing event: ${eventType}`);
        this.emit(eventType, eventPayload);
    }

    /**
     * Process event through analyzers
     * @param {Object} eventResult - Result from hook handler
     * @param {Object} hookModule - Hook module
     */
    async processEvent(eventResult, hookModule) {
        const { event_type } = eventResult;

        switch (event_type) {
            case 'pull_request':
                await this.processPullRequest(eventResult);
                break;
            case 'push':
                await this.processPush(eventResult);
                break;
            case 'repository_vulnerability_alert':
                await this.processVulnerabilityAlert(eventResult);
                break;
            case 'code_scanning_alert':
                await this.processCodeScanningAlert(eventResult);
                break;
            case 'release':
                await this.processRelease(eventResult);
                break;
            case 'workflow_run':
                await this.processWorkflowRun(eventResult);
                break;
            case 'issues':
                await this.processIssue(eventResult);
                break;
            case 'issues_comment':
                await this.processIssueComment(eventResult);
                break;
            case 'deployment_status':
                await this.processDeploymentStatus(eventResult);
                break;
        }
    }

    /**
     * Process pull request event
     */
    async processPullRequest(eventResult) {
        console.log(`Processing PR #${eventResult.data.pr_number}`);
        // Add PR node and edges to graph
        const prNode = {
            type: 'pull_request',
            name: eventResult.data.pr_title,
            ...eventResult.data,
        };
        this.analyzers.graph.addNode(prNode);

        // Persist to database immediately
        await this.persistNode(prNode);
    }

    /**
     * Process push event
     */
    async processPush(eventResult) {
        if (!eventResult.data.is_default_branch) {
            console.log('Skipping push to non-default branch');
            return;
        }

        console.log(`Processing push to ${eventResult.data.branch}`);

        // Add commits as nodes
        eventResult.data.commits.forEach(async (commit) => {
            this.analyzers.git.addCommit(commit);
            const commitNode = {
                type: 'commit',
                name: commit.id,
                ...commit,
            };
            this.analyzers.graph.addNode(commitNode);

            // Persist to database immediately
            await this.persistNode(commitNode);
        });

        // Trigger incremental reindex
        await this.triggerIncrementalReindex();
    }

    /**
     * Process vulnerability alert
     */
    async processVulnerabilityAlert(eventResult) {
        console.log(`Processing vulnerability: ${eventResult.data.cve_id}`);

        const alert = this.analyzers.security.processDependabotAlert(eventResult.data);

        // Create incident node
        const incidentNode = {
            type: 'vulnerability_incident',
            name: eventResult.data.cve_id,
            ...alert,
        };
        this.analyzers.graph.addNode(incidentNode);

        // Persist to database immediately
        await this.persistNode(incidentNode);

        // Create ticket
        const ticket = this.analyzers.security.createIncidentTicket(alert);
        console.log(`Created incident ticket: ${ticket.title}`);
    }

    /**
     * Process code scanning alert
     */
    async processCodeScanningAlert(eventResult) {
        console.log(`Processing code scanning alert in ${eventResult.data.path}`);

        const alert = this.analyzers.security.processCodeScanningAlert(eventResult.data);

        const issueNode = {
            type: 'code_quality_issue',
            name: eventResult.data.rule_name,
            ...alert,
        };
        this.analyzers.graph.addNode(issueNode);

        // Persist to database immediately
        await this.persistNode(issueNode);
    }

    /**
     * Process release event
     */
    async processRelease(eventResult) {
        console.log(`Processing release: ${eventResult.data.release_tag}`);

        const releaseNode = {
            type: 'release',
            name: eventResult.data.release_tag,
            ...eventResult.data,
        };
        this.analyzers.graph.addNode(releaseNode);

        // Persist to database immediately
        await this.persistNode(releaseNode);
    }

    /**
     * Process workflow run event
     */
    async processWorkflowRun(eventResult) {
        console.log(`Processing workflow run: ${eventResult.data.workflow_name}`);

        const workflowNode = {
            type: 'workflow_run',
            name: `${eventResult.data.workflow_name} #${eventResult.data.run_number}`,
            ...eventResult.data,
        };
        this.analyzers.graph.addNode(workflowNode);

        // Persist to database immediately
        await this.persistNode(workflowNode);
    }

    /**
     * Process issue event
     */
    async processIssue(eventResult) {
        console.log(`Processing issue #${eventResult.data.issue_number}: ${eventResult.data.title}`);

        this.analyzers.collaboration.processIssue(eventResult.data);

        const issueNode = {
            type: 'issue',
            name: eventResult.data.title,
            ...eventResult.data,
        };
        this.analyzers.graph.addNode(issueNode);

        // Persist to database immediately
        await this.persistNode(issueNode);
    }

    /**
     * Process issue comment event
     */
    async processIssueComment(eventResult) {
        console.log(`Processing comment on issue #${eventResult.data.issue_number}`);

        if (eventResult.data.is_command) {
            console.log(`Detected commands: ${eventResult.data.commands.map(c => c.command).join(', ')}`);
            // Execute commands if authorized
            if (eventResult.data.is_authorized) {
                for (const cmd of eventResult.data.commands) {
                    await this.executeCommand(cmd, eventResult.data);
                }
            }
        }
    }

    /**
     * Process deployment status event
     */
    async processDeploymentStatus(eventResult) {
        console.log(`Processing deployment status: ${eventResult.data.state}`);

        const deploymentNode = {
            type: 'deployment',
            name: `${eventResult.data.environment} - ${eventResult.data.deployment_commit_sha?.substring(0, 7)}`,
            ...eventResult.data,
        };
        this.analyzers.graph.addNode(deploymentNode);

        // Persist to database immediately
        await this.persistNode(deploymentNode);
    }

    /**
     * Execute ChatOps command
     * @param {Object} command - Command to execute
     * @param {Object} context - Execution context
     */
    async executeCommand(command, context) {
        console.log(`Executing command: /${command.command} ${command.args}`);
        // Implementation would depend on specific commands
    }

    /**
     * Trigger incremental reindexing
     */
    async triggerIncrementalReindex() {
        console.log('Triggering incremental reindex...');

        const oldGraph = this.currentGraph;
        const newGraph = this.analyzers.graph.export();

        // Calculate diff
        const diff = DiffCalculator.calculateGraphDiff(oldGraph, newGraph);
        this.diffs.push(diff);

        // Calculate reindex strategy
        const impactScope = DiffCalculator.calculateImpactScope(diff);
        const reindexStrategy = DiffCalculator.calculateReindexingStrategy(diff, newGraph);
        const reindexCost = DiffCalculator.estimateReindexCost(reindexStrategy);

        console.log(`Impact scope: ${impactScope.impact_radius} nodes affected`);
        console.log(`Reindex optimization: ${reindexCost.optimization_percentage.toFixed(2)}% reduction`);

        // Perform partial reindex
        if (reindexStrategy.nodes_to_reindex > 0) {
            this.analyzers.indexing.partialReindex(
                reindexStrategy.affected_node_ids,
                newGraph
            );
        }

        // Update current graph
        this.currentGraph = newGraph;

        console.log('✓ Incremental reindex complete');
    }

    /**
     * Generate knowledge graph report
     */
    async generateReport() {
        if (!this.initialized) {
            throw new Error('Orchestrator not initialized');
        }

        console.log('Generating knowledge graph report...');

        const report = await this.graphGenerator.generateComprehensiveReport(
            this.currentGraph,
            this.analyzers
        );

        console.log('✓ Report generation complete');
        return report;
    }

    /**
     * Get system status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            graph_size: {
                nodes: this.currentGraph.nodes?.length || 0,
                edges: this.currentGraph.edges?.length || 0,
            },
            analyzers: {
                security_score: this.analyzers.security?.getSecurityScore() || null,
                collaboration: this.analyzers.collaboration?.getCollaborationMetrics() || null,
                governance: this.analyzers.governance?.checkCompliance() || null,
            },
            indexing: this.analyzers.indexing?.getStats() || null,
            diffs_recorded: this.diffs.length,
        };
    }

    /**
     * Persist a node to the database
     */
    async persistNode(node) {
        try {
            if (!this.initialized || !this.databaseManager.initialized) {
                console.warn('Database not initialized, skipping node persistence');
                return;
            }
            await this.databaseManager.upsertNode(node);
        } catch (error) {
            console.error('Failed to persist node:', error);
            // Don't throw - continue processing even if DB fails
        }
    }

    /**
     * Persist an edge to the database
     */
    async persistEdge(edge) {
        try {
            if (!this.initialized || !this.databaseManager.initialized) {
                console.warn('Database not initialized, skipping edge persistence');
                return;
            }
            await this.databaseManager.upsertEdge(edge);
        } catch (error) {
            console.error('Failed to persist edge:', error);
            // Don't throw - continue processing even if DB fails
        }
    }

    /**
     * Sync entire current graph to database
     */
    async syncGraphToDatabase() {
        try {
            if (!this.initialized || !this.databaseManager.initialized) {
                throw new Error('Orchestrator or Database not initialized');
            }

            console.log('Syncing graph to database...');

            // Persist all nodes
            const nodes = this.currentGraph.nodes || [];
            for (const node of nodes) {
                await this.persistNode(node);
            }

            // Persist all edges
            const edges = this.currentGraph.edges || [];
            for (const edge of edges) {
                await this.persistEdge(edge);
            }

            // Record statistics snapshot
            const stats = await this.databaseManager.getGraphStatistics();
            await this.databaseManager.recordStatistics(stats);

            console.log(`✓ Synced ${nodes.length} nodes and ${edges.length} edges to database`);
        } catch (error) {
            console.error('Failed to sync graph to database:', error);
            throw error;
        }
    }

    /**
     * Load graph from database
     */
    async loadGraphFromDatabase() {
        try {
            if (!this.initialized || !this.databaseManager.initialized) {
                throw new Error('Orchestrator or Database not initialized');
            }

            console.log('Loading graph from database...');
            const graph = await this.databaseManager.exportGraph();

            this.currentGraph = graph;
            console.log(`✓ Loaded ${graph.nodes.length} nodes and ${graph.edges.length} edges from database`);

            return graph;
        } catch (error) {
            console.error('Failed to load graph from database:', error);
            throw error;
        }
    }

    /**
     * Close database connection gracefully
     */
    async closeDatabase() {
        try {
            if (this.databaseManager && this.databaseManager.initialized) {
                await this.databaseManager.close();
                console.log('✓ Database connection closed');
            }
        } catch (error) {
            console.error('Error closing database:', error);
            throw error;
        }
    }
}

module.exports = SCAOrchestrator;
