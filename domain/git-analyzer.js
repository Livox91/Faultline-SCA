/**
 * Git Analyzer
 * Analyzes Git history and provenance data
 */

class GitAnalyzer {
    constructor() {
        this.commits = [];
        this.blameData = new Map();
    }

    /**
     * Parse commit object from Git data
     * @param {Object} commitData - Git commit data
     * @returns {Object} Normalized commit
     */
    parseCommit(commitData) {
        return {
            id: commitData.sha || commitData.id,
            hash: commitData.sha?.substring(0, 40) || commitData.id,
            short_hash: commitData.sha?.substring(0, 7) || commitData.id?.substring(0, 7),
            message: commitData.message || commitData.commit?.message || '',
            author: {
                name: commitData.author?.name || commitData.commit?.author?.name || '',
                email: commitData.author?.email || commitData.commit?.author?.email || '',
                date: commitData.author?.date || commitData.commit?.author?.date || '',
            },
            committer: {
                name: commitData.committer?.name || commitData.commit?.committer?.name || '',
                email: commitData.committer?.email || commitData.commit?.committer?.email || '',
                date: commitData.committer?.date || commitData.commit?.committer?.date || '',
            },
            timestamp: new Date(commitData.timestamp || commitData.author?.date).toISOString(),
            parents: (commitData.parents || []).map(p => p.sha || p),
            files_changed: commitData.files?.length || 0,
            additions: commitData.stats?.additions || 0,
            deletions: commitData.stats?.deletions || 0,
            verified: commitData.verification?.verified || false,
        };
    }

    /**
     * Add commit to history
     * @param {Object} commitData - Git commit data
     */
    addCommit(commitData) {
        const commit = this.parseCommit(commitData);
        this.commits.push(commit);
        return commit;
    }

    /**
     * Parse blame information for a file
     * @param {Object} blameData - Git blame data
     * @returns {Map} Blame information
     */
    parseBlame(blameData) {
        const blame = new Map();

        blameData.forEach(range => {
            for (let i = range.originalStart; i < range.originalStart + range.lines; i++) {
                blame.set(i, {
                    commit_hash: range.commit.substring(0, 7),
                    author: this.extractAuthorFromCommit(range.commit),
                    timestamp: range.timestamp,
                });
            }
        });

        return blame;
    }

    /**
     * Extract author from commit data
     * @param {string} commitInfo - Commit information
     * @returns {Object} Author data
     */
    extractAuthorFromCommit(commitInfo) {
        const match = commitInfo.match(/^([^<]+)\s*<([^>]+)>/);
        if (match) {
            return { name: match[1].trim(), email: match[2] };
        }
        return { name: commitInfo, email: '' };
    }

    /**
     * Get commit history
     * @param {string} branch - Branch name (optional)
     * @returns {Array} Commits
     */
    getCommitHistory(branch) {
        if (branch) {
            return this.commits.filter(c => c.branch === branch);
        }
        return this.commits;
    }

    /**
     * Get commits by author
     * @param {string} authorEmail - Author email
     * @returns {Array} Commits by author
     */
    getCommitsByAuthor(authorEmail) {
        return this.commits.filter(c => c.author.email === authorEmail);
    }

    /**
     * Analyze commit frequency
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Object} Frequency analysis
     */
    analyzeCommitFrequency(startDate, endDate) {
        const filtered = this.commits.filter(c => {
            const date = new Date(c.timestamp);
            return date >= startDate && date <= endDate;
        });

        const byDate = {};
        const byAuthor = {};

        filtered.forEach(commit => {
            const date = commit.timestamp.split('T')[0];
            byDate[date] = (byDate[date] || 0) + 1;

            const author = commit.author.email;
            byAuthor[author] = (byAuthor[author] || 0) + 1;
        });

        return {
            total_commits: filtered.length,
            commits_by_date: byDate,
            commits_by_author: byAuthor,
            date_range: { start: startDate, end: endDate },
        };
    }

    /**
     * Detect code churn (high change frequency)
     * @param {string} file - File path
     * @returns {Object} Churn metrics
     */
    detectCodeChurn(file) {
        const fileCommits = this.commits.filter(c =>
            c.files?.some(f => f.path === file)
        );

        let totalAdditions = 0;
        let totalDeletions = 0;

        fileCommits.forEach(c => {
            totalAdditions += c.additions || 0;
            totalDeletions += c.deletions || 0;
        });

        return {
            file,
            commit_count: fileCommits.length,
            total_additions: totalAdditions,
            total_deletions: totalDeletions,
            churn_ratio: fileCommits.length > 0 ? (totalAdditions + totalDeletions) / fileCommits.length : 0,
        };
    }

    /**
     * Get blame for specific line in file
     * @param {string} file - File path
     * @param {number} lineNumber - Line number
     * @returns {Object} Blame information
     */
    getLineBlame(file, lineNumber) {
        const key = `${file}:${lineNumber}`;
        return this.blameData.get(key) || { error: 'No blame data found' };
    }

    /**
     * Find related commits (by message, author, or files)
     * @param {Object} criteria - Search criteria
     * @returns {Array} Related commits
     */
    findRelatedCommits(criteria) {
        return this.commits.filter(c => {
            if (criteria.message && !c.message.includes(criteria.message)) return false;
            if (criteria.author && c.author.email !== criteria.author) return false;
            if (criteria.file && !c.files?.some(f => f.includes(criteria.file))) return false;
            return true;
        });
    }

    /**
     * Calculate author statistics
     * @returns {Array} Author stats sorted by commits
     */
    getAuthorStatistics() {
        const stats = {};

        this.commits.forEach(c => {
            const email = c.author.email;
            if (!stats[email]) {
                stats[email] = {
                    name: c.author.name,
                    email,
                    commits: 0,
                    additions: 0,
                    deletions: 0,
                };
            }
            stats[email].commits += 1;
            stats[email].additions += c.additions || 0;
            stats[email].deletions += c.deletions || 0;
        });

        return Object.values(stats).sort((a, b) => b.commits - a.commits);
    }

    /**
     * Detect potentially risky commits (large changes)
     * @param {number} threshold - Line change threshold
     * @returns {Array} Risky commits
     */
    detectRiskyCommits(threshold = 500) {
        return this.commits.filter(c => {
            const totalChanges = (c.additions || 0) + (c.deletions || 0);
            return totalChanges > threshold;
        });
    }
}

module.exports = GitAnalyzer;
