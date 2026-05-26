/**
 * Code Scanning Alert Hook for SCA
 * Handles code_scanning_alert events
 * 
 * Purpose: Ingestion of specific line-of-code vulnerabilities from SAST tools
 */

module.exports = {
    name: 'code-scanning-alert',
    description: 'Processes SAST and code scanning alerts with specific line coordinates',

    /**
     * Main handler for code scanning alert events
     * @param {Object} payload - GitHub webhook payload
     * @returns {Promise<Object>} Alert processing result
     */
    async handle(payload) {
        const {
            action,
            alert,
            repository,
            ref,
            commit_oid,
        } = payload;

        try {
            return {
                event_type: 'code_scanning_alert',
                action, // appeared, updated, dismissed, reopened, fixed
                repository: repository.full_name,
                branch: ref.split('/').pop(),
                commit: commit_oid,
                timestamp: new Date().toISOString(),
                status: 'processing',
                data: {
                    alert_id: alert?.number,
                    rule_id: alert?.rule?.id,
                    rule_name: alert?.rule?.name,
                    rule_severity: alert?.rule?.severity, // error, warning, note
                    rule_tags: alert?.rule?.tags || [],
                    cwe_ids: alert?.rule?.security_severity_level ? this.getCWEsFromSeverity(alert.rule.security_severity_level) : [],
                    description: alert?.rule?.description,
                    help_uri: alert?.rule?.help_uri,
                    path: alert?.most_recent_instance?.location?.path,
                    start_line: alert?.most_recent_instance?.location?.start_line,
                    end_line: alert?.most_recent_instance?.location?.end_line,
                    start_column: alert?.most_recent_instance?.location?.start_column,
                    end_column: alert?.most_recent_instance?.location?.end_column,
                    message: alert?.most_recent_instance?.message?.text,
                    state: alert?.state, // open, dismissed, fixed
                    dismissed_by: alert?.dismissed_by?.login,
                    dismissed_at: alert?.dismissed_at,
                    dismissed_reason: alert?.dismissed_reason,
                },
            };
        } catch (error) {
            console.error('Error processing code scanning alert hook:', error);
            throw error;
        }
    },

    /**
     * Extract vulnerability location and context
     * @param {Object} alertData - Alert data
     * @returns {Object} Vulnerability location context
     */
    extractVulnerabilityContext(alertData) {
        return {
            file: alertData.path,
            lines: {
                start: alertData.start_line,
                end: alertData.end_line,
            },
            columns: {
                start: alertData.start_column,
                end: alertData.end_column,
            },
            message: alertData.message,
            rule: alertData.rule_name,
            severity: this.mapSeverity(alertData.rule_severity),
            cwe_ids: alertData.cwe_ids,
        };
    },

    /**
     * Map severity levels to internal format
     * @param {string} severity - Rule severity level
     * @returns {string} Mapped severity
     */
    mapSeverity(severity) {
        const severityMap = {
            'error': 'Critical',
            'warning': 'Normal',
            'note': 'Minor',
        };
        return severityMap[severity?.toLowerCase()] || 'Normal';
    },

    /**
     * Get CWE IDs from security severity level
     * @param {string} severityLevel - Security severity level
     * @returns {Array} CWE identifiers
     */
    getCWEsFromSeverity(severityLevel) {
        // Common CWEs mapped by severity level
        const cweMappings = {
            'high': ['CWE-79', 'CWE-89', 'CWE-94'],
            'medium': ['CWE-200', 'CWE-311', 'CWE-400'],
            'low': ['CWE-693', 'CWE-827'],
        };
        return cweMappings[severityLevel?.toLowerCase()] || [];
    },
};
