/**
 * Pull Request Hook for SCA
 * Handles pull_request events with actions: opened, synchronize
 * 
 * Purpose: Shift-left security - intercept manifests and detect vulnerabilities
 */

module.exports = {
    name: 'pull-request-sca',
    description: 'Detects code quality issues and vulnerabilities in pull requests',
    actions: ['opened', 'synchronize'],

    /**
     * Main handler for pull request events
     * @param {Object} payload - GitHub webhook payload
     * @returns {Promise<Object>} Analysis result
     */
    async handle(payload) {
        const {
            pull_request: pr,
            repository,
            action,
        } = payload;

        try {
            return {
                event_type: 'pull_request',
                action,
                pr_number: pr.number,
                pr_title: pr.title,
                repository: repository.full_name,
                timestamp: new Date().toISOString(),
                status: 'processing',
                data: {
                    head_sha: pr.head.sha,
                    base_sha: pr.base.sha,
                    changed_files: pr.changed_files,
                    additions: pr.additions,
                    deletions: pr.deletions,
                    files_changed: [], // Will be populated by processing
                },
            };
        } catch (error) {
            console.error('Error processing pull request hook:', error);
            throw error;
        }
    },

    /**
     * Extract manifest files from PR diff
     * @param {Object} prData - PR data including files
     * @returns {Promise<Array>} List of manifest files
     */
    async extractManifests(prData) {
        const manifestPatterns = [
            /package\.json$/i,
            /package-lock\.json$/i,
            /yarn\.lock$/i,
            /requirements\.txt$/i,
            /poetry\.lock$/i,
            /pom\.xml$/i,
            /go\.mod$/i,
            /go\.sum$/i,
            /Gemfile$/i,
            /Gemfile\.lock$/i,
        ];

        return prData.files_changed?.filter(file =>
            manifestPatterns.some(pattern => pattern.test(file.filename))
        ) || [];
    },

    /**
     * Check for vulnerability block conditions
     * @param {Object} analysis - Vulnerability analysis result
     * @returns {boolean} Whether to block merge
     */
    shouldBlockMerge(analysis) {
        if (!analysis.vulnerabilities) return false;
        const criticalCount = analysis.vulnerabilities.filter(v => v.severity === 'critical').length;
        return criticalCount > 0;
    },
};
