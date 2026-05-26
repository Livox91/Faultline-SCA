/**
 * Release Hook for Runtime Orchestrator
 * Handles release events with action: published
 * 
 * Purpose: Maps production images back to specific code versions
 */

module.exports = {
    name: 'release',
    description: 'Tracks production releases and version mappings',
    actions: ['published'],

    /**
     * Main handler for release events
     * @param {Object} payload - GitHub webhook payload
     * @returns {Promise<Object>} Release tracking result
     */
    async handle(payload) {
        const {
            action,
            release,
            repository,
        } = payload;

        try {
            return {
                event_type: 'release',
                action,
                repository: repository.full_name,
                timestamp: new Date().toISOString(),
                status: 'tracking',
                data: {
                    release_id: release.id,
                    release_tag: release.tag_name,
                    release_name: release.name,
                    release_version: this.extractVersion(release.tag_name),
                    is_prerelease: release.prerelease,
                    is_draft: release.draft,
                    target_commitish: release.target_commitish,
                    commit_sha: release.target_commitish, // May be branch name, must resolve to SHA
                    created_at: release.created_at,
                    published_at: release.published_at,
                    author: release.author.login,
                    body: release.body,
                    assets: release.assets.map(a => ({
                        name: a.name,
                        url: a.browser_download_url,
                        size: a.size,
                        download_count: a.download_count,
                    })),
                    tarball_url: release.tarball_url,
                    zipball_url: release.zipball_url,
                },
            };
        } catch (error) {
            console.error('Error processing release hook:', error);
            throw error;
        }
    },

    /**
     * Extract semantic version from tag
     * @param {string} tagName - Git tag name
     * @returns {Object} Version components
     */
    extractVersion(tagName) {
        const versionRegex = /v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?/;
        const match = tagName.match(versionRegex);

        if (match) {
            return {
                major: parseInt(match[1]),
                minor: parseInt(match[2]),
                patch: parseInt(match[3]),
                prerelease: match[4] || null,
                full: `${match[1]}.${match[2]}.${match[3]}${match[4] ? `-${match[4]}` : ''}`,
            };
        }

        return { full: tagName };
    },

    /**
     * Create production mapping record
     * @param {Object} releaseData - Release data
     * @returns {Object} Production deployment record
     */
    createProductionMapping(releaseData) {
        return {
            version: releaseData.release_version.full,
            commit_sha: releaseData.commit_sha,
            tag: releaseData.release_tag,
            deployed_at: releaseData.published_at,
            is_prerelease: releaseData.is_prerelease,
            active: !releaseData.is_prerelease,
        };
    },
};
