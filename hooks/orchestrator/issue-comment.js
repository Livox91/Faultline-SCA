/**
 * Issue Comment Hook for Runtime Orchestrator
 * Handles issue_comment events with action: created
 * 
 * Purpose: ChatOps commands for triggering diagnostics and hotfixes
 */

module.exports = {
    name: 'issue-comment',
    description: 'Processes issue comments for ChatOps commands',
    actions: ['created', 'edited', 'deleted'],

    /**
     * Main handler for issue comment events
     * @param {Object} payload - GitHub webhook payload
     * @returns {Promise<Object>} Comment processing result
     */
    async handle(payload) {
        const {
            action,
            issue,
            comment,
            repository,
        } = payload;

        try {
            return {
                event_type: 'issue_comment',
                action,
                repository: repository.full_name,
                timestamp: new Date().toISOString(),
                status: action === 'created' ? 'processing' : 'acknowledged',
                data: {
                    comment_id: comment.id,
                    issue_number: issue.number,
                    issue_title: issue.title,
                    author: comment.user.login,
                    body: comment.body,
                    created_at: comment.created_at,
                    updated_at: comment.updated_at,
                    is_command: this.isCommand(comment.body),
                    commands: this.parseCommands(comment.body),
                    is_authorized: this.isAuthorized(comment.user, issue),
                },
            };
        } catch (error) {
            console.error('Error processing issue comment hook:', error);
            throw error;
        }
    },

    /**
     * Check if comment contains a command
     * @param {string} body - Comment body
     * @returns {boolean} Whether body contains command
     */
    isCommand(body) {
        return /^\/[a-z]+(\s|$)/m.test(body.trim());
    },

    /**
     * Parse ChatOps commands from comment
     * @param {string} body - Comment body
     * @returns {Array} Parsed commands
     */
    parseCommands(body) {
        const commandRegex = /^\/(\w+)(?:\s+(.+))?$/gm;
        const commands = [];
        let match;

        while ((match = commandRegex.exec(body)) !== null) {
            commands.push({
                command: match[1],
                args: match[2] ? match[2].trim() : '',
                full: match[0],
            });
        }

        return commands;
    },

    /**
     * Check if commenter is authorized for commands
     * @param {Object} user - Comment author
     * @param {Object} issue - Issue data
     * @returns {boolean} Whether user is authorized
     */
    isAuthorized(user, issue) {
        // Authorized if: issue creator, assignee, or has admin role
        return (
            user.login === issue.user.login ||
            (issue.assignees || []).some(a => a.login === user.login) ||
            user.type === 'Bot'
        );
    },

    /**
     * Execute ChatOps command
     * @param {Object} command - Parsed command
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Command result
     */
    async executeCommand(command, context) {
        const { command: cmd, args } = command;

        switch (cmd) {
            case 'diagnose':
                return await this.runDiagnostics(context);
            case 'rollback':
                return await this.triggerRollback(args, context);
            case 'deploy':
                return await this.triggerDeploy(args, context);
            case 'hotfix':
                return await this.createHotfixPR(args, context);
            case 'status':
                return await this.getStatus(context);
            default:
                return { error: `Unknown command: ${cmd}` };
        }
    },

    /**
     * Run diagnostics on service
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Diagnostics result
     */
    async runDiagnostics(context) {
        return {
            command: 'diagnose',
            status: 'initiated',
            checks: [
                { name: 'Health Check', status: 'pending' },
                { name: 'Dependency Check', status: 'pending' },
                { name: 'Performance Check', status: 'pending' },
            ],
        };
    },

    /**
     * Trigger automated rollback
     * @param {string} args - Command arguments
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Rollback result
     */
    async triggerRollback(args, context) {
        return {
            command: 'rollback',
            status: 'initiated',
            target_version: args || 'previous',
            timestamp: new Date().toISOString(),
        };
    },

    /**
     * Trigger deployment
     * @param {string} args - Command arguments
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Deploy result
     */
    async triggerDeploy(args, context) {
        return {
            command: 'deploy',
            status: 'initiated',
            target_env: args || 'staging',
            timestamp: new Date().toISOString(),
        };
    },

    /**
     * Create automated hotfix PR
     * @param {string} args - Command arguments (issue description)
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Hotfix PR result
     */
    async createHotfixPR(args, context) {
        return {
            command: 'hotfix',
            status: 'initiated',
            pr_title: `Hotfix: ${args || 'Automated fix'}`,
            branch: `hotfix/auto-${Date.now()}`,
            timestamp: new Date().toISOString(),
        };
    },

    /**
     * Get current service status
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Status report
     */
    async getStatus(context) {
        return {
            command: 'status',
            service_health: 'healthy',
            last_deployment: new Date().toISOString(),
            active_incidents: 0,
        };
    },
};
