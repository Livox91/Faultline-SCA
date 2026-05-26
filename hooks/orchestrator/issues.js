/**
 * Issues Hook for Runtime Orchestrator
 * Handles issue events with actions: opened, edited, closed
 * 
 * Purpose: ChatOps and automated incident ticket creation
 */

module.exports = {
    name: 'issues',
    description: 'Processes issue events for ChatOps and incident tracking',
    actions: ['opened', 'edited', 'closed', 'reopened'],

    /**
     * Main handler for issue events
     * @param {Object} payload - GitHub webhook payload
     * @returns {Promise<Object>} Issue processing result
     */
    async handle(payload) {
        const {
            action,
            issue,
            repository,
        } = payload;

        try {
            return {
                event_type: 'issues',
                action,
                repository: repository.full_name,
                timestamp: new Date().toISOString(),
                status: 'processing',
                data: {
                    issue_id: issue.id,
                    issue_number: issue.number,
                    title: issue.title,
                    body: issue.body,
                    state: issue.state,
                    user: issue.user.login,
                    labels: (issue.labels || []).map(l => ({
                        name: l.name,
                        color: l.color,
                    })),
                    assignees: (issue.assignees || []).map(a => a.login),
                    milestone: issue.milestone?.title || null,
                    created_at: issue.created_at,
                    updated_at: issue.updated_at,
                    closed_at: issue.closed_at,
                    linked_pull_requests: issue.pull_requests?.length || 0,
                    comments_count: issue.comments,
                    is_incident: this.isIncidentIssue(issue),
                    incident_type: this.detectIncidentType(issue),
                },
            };
        } catch (error) {
            console.error('Error processing issue hook:', error);
            throw error;
        }
    },

    /**
     * Check if issue is an incident report
     * @param {Object} issue - GitHub issue
     * @returns {boolean} Whether this is an incident
     */
    isIncidentIssue(issue) {
        const incidentLabels = ['incident', 'bug', 'critical', 'production-issue'];
        const issueLabels = (issue.labels || []).map(l => l.name.toLowerCase());
        return incidentLabels.some(label => issueLabels.includes(label));
    },

    /**
     * Detect type of incident from issue content
     * @param {Object} issue - GitHub issue
     * @returns {string} Incident type
     */
    detectIncidentType(issue) {
        const content = `${issue.title} ${issue.body}`.toLowerCase();

        if (content.includes('memory') || content.includes('leak')) return 'memory_leak';
        if (content.includes('cpu')) return 'cpu_spike';
        if (content.includes('timeout') || content.includes('hang')) return 'timeout';
        if (content.includes('error') || content.includes('exception')) return 'error';
        if (content.includes('vulnerability') || content.includes('cve')) return 'security';
        if (content.includes('performance') || content.includes('slow')) return 'performance';

        return 'general_incident';
    },

    /**
     * Extract severity from issue labels
     * @param {Array} labels - Issue labels
     * @returns {string} Severity level
     */
    extractSeverity(labels) {
        const labelNames = labels.map(l => l.name.toLowerCase());

        if (labelNames.includes('critical') || labelNames.includes('p0')) return 'Critical';
        if (labelNames.includes('high') || labelNames.includes('p1')) return 'Normal';
        if (labelNames.includes('medium') || labelNames.includes('p2')) return 'Normal';

        return 'Minor';
    },

    /**
     * Parse issue for ChatOps commands
     * @param {string} body - Issue body
     * @returns {Array} Commands found
     */
    parseCommands(body) {
        const commandRegex = /\/(\w+)(?:\s+(.+))?/g;
        const commands = [];
        let match;

        while ((match = commandRegex.exec(body)) !== null) {
            commands.push({
                command: match[1],
                args: match[2] ? match[2].split(' ') : [],
            });
        }

        return commands;
    },
};
