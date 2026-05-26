/**
 * Push Hook for SCA
 * Handles push events on default branches
 * 
 * Purpose: Baseline scanning to maintain an up-to-date manifest of third-party libraries
 */

module.exports = {
    name: 'push-sca',
    description: 'Performs baseline scanning on default branch',

    /**
     * Main handler for push events
     * @param {Object} payload - GitHub webhook payload
     * @returns {Promise<Object>} Scan result
     */
    async handle(payload) {
        const {
            ref,
            repository,
            pusher,
            commits,
            head_commit,
        } = payload;

        // Only process push to default branch
        const branch = ref.split('/').pop();
        const isDefaultBranch = branch === repository.default_branch;

        try {
            return {
                event_type: 'push',
                repository: repository.full_name,
                branch,
                is_default_branch: isDefaultBranch,
                timestamp: new Date().toISOString(),
                status: isDefaultBranch ? 'processing' : 'skipped',
                data: {
                    head_sha: head_commit?.id,
                    commits_count: commits.length,
                    commits: commits.map(c => ({
                        id: c.id,
                        message: c.message,
                        author: c.author.name,
                        timestamp: c.timestamp,
                    })),
                    pusher: pusher.name,
                    modified_files: head_commit?.modified || [],
                    added_files: head_commit?.added || [],
                    removed_files: head_commit?.removed || [],
                },
            };
        } catch (error) {
            console.error('Error processing push hook:', error);
            throw error;
        }
    },

    /**
     * Identify files that need re-scanning
     * @param {Object} pushData - Push event data
     * @returns {Array} Files requiring scan
     */
    async identifyChangedDependencies(pushData) {
        const dependencyPatterns = [
            /package\.json$/i,
            /package-lock\.json$/i,
            /yarn\.lock$/i,
            /requirements\.txt$/i,
            /poetry\.lock$/i,
            /pom\.xml$/i,
            /go\.mod$/i,
            /Dockerfile$/i,
            /docker-compose\.yml$/i,
        ];

        const changedFiles = [
            ...pushData.modified_files,
            ...pushData.added_files,
            ...pushData.removed_files,
        ];

        return changedFiles.filter(file =>
            dependencyPatterns.some(pattern => pattern.test(file))
        );
    },
};
