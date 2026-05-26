/**
 * Collaboration Analyzer
 * Analyzes PR/Issue context and collaboration data
 */

class CollaborationAnalyzer {
    constructor() {
        this.pullRequests = [];
        this.issues = [];
        this.reviews = [];
        this.comments = [];
    }

    /**
     * Process pull request
     * @param {Object} prData - PR data
     * @returns {Object} Processed PR
     */
    processPullRequest(prData) {
        const pr = {
            id: prData.pr_number,
            title: prData.pr_title,
            author: prData.author,
            created_at: prData.created_at,
            updated_at: prData.updated_at,
            merged_at: prData.merged_at || null,
            closed_at: prData.closed_at || null,
            state: prData.state,
            base_branch: prData.base_branch,
            head_branch: prData.head_branch,
            commits: prData.commits_count || 0,
            additions: prData.additions || 0,
            deletions: prData.deletions || 0,
            files_changed: prData.files_changed || 0,
            description: prData.body || '',
            labels: prData.labels || [],
            assignees: prData.assignees || [],
            reviewers: prData.reviewers || [],
            linked_issues: [],
        };

        // Extract linked issues from description
        pr.linked_issues = this.extractLinkedIssues(prData.body || '');

        this.pullRequests.push(pr);
        return pr;
    }

    /**
     * Process issue
     * @param {Object} issueData - Issue data
     * @returns {Object} Processed issue
     */
    processIssue(issueData) {
        const issue = {
            id: issueData.issue_number,
            title: issueData.title,
            author: issueData.user,
            created_at: issueData.created_at,
            updated_at: issueData.updated_at,
            closed_at: issueData.closed_at || null,
            state: issueData.state,
            description: issueData.body || '',
            labels: issueData.labels || [],
            assignees: issueData.assignees || [],
            comments_count: issueData.comments || 0,
            reactions: issueData.reactions || {},
            linked_prs: [],
        };

        // Extract linked PRs
        issue.linked_prs = this.findLinkedPRs(issue.id);

        this.issues.push(issue);
        return issue;
    }

    /**
     * Process code review
     * @param {Object} reviewData - Review data
     * @returns {Object} Processed review
     */
    processReview(reviewData) {
        const review = {
            id: reviewData.review_id,
            pr_id: reviewData.pr_number,
            author: reviewData.reviewer,
            state: reviewData.state, // approved, changes_requested, commented, dismissed
            submitted_at: reviewData.submitted_at,
            body: reviewData.body,
            comments_count: reviewData.comments?.length || 0,
        };

        this.reviews.push(review);
        return review;
    }

    /**
     * Extract linked issue IDs from text
     * @param {string} text - Text content
     * @returns {Array} Issue IDs
     */
    extractLinkedIssues(text) {
        const issueRegex = /#(\d+)|fixes?\s+#(\d+)|resolves?\s+#(\d+)|closes?\s+#(\d+)/gi;
        const issues = new Set();
        let match;

        while ((match = issueRegex.exec(text)) !== null) {
            const issueId = match[1] || match[2] || match[3] || match[4];
            issues.add(parseInt(issueId));
        }

        return Array.from(issues);
    }

    /**
     * Find PRs linked to an issue
     * @param {number} issueId - Issue ID
     * @returns {Array} Linked PRs
     */
    findLinkedPRs(issueId) {
        return this.pullRequests
            .filter(pr => pr.linked_issues.includes(issueId))
            .map(pr => pr.id);
    }

    /**
     * Get collaboration metrics
     * @returns {Object} Collaboration stats
     */
    getCollaborationMetrics() {
        const contributors = new Set();
        const reviewers = new Set();

        this.pullRequests.forEach(pr => {
            contributors.add(pr.author);
            pr.reviewers?.forEach(r => reviewers.add(r));
        });

        this.issues.forEach(issue => {
            contributors.add(issue.author);
        });

        return {
            total_contributors: contributors.size,
            total_reviewers: reviewers.size,
            total_prs: this.pullRequests.length,
            total_issues: this.issues.length,
            avg_pr_review_time: this.calculateAvgReviewTime(),
            merged_prs: this.pullRequests.filter(pr => pr.state === 'merged').length,
        };
    }

    /**
     * Calculate average PR review time
     * @returns {number} Average review time in hours
     */
    calculateAvgReviewTime() {
        const reviewedPRs = this.pullRequests.filter(pr => pr.merged_at);
        if (reviewedPRs.length === 0) return 0;

        const totalTime = reviewedPRs.reduce((sum, pr) => {
            const created = new Date(pr.created_at);
            const merged = new Date(pr.merged_at);
            return sum + (merged - created) / (1000 * 60 * 60);
        }, 0);

        return Math.round(totalTime / reviewedPRs.length);
    }

    /**
     * Get code review quality
     * @returns {Object} Review quality metrics
     */
    getCodeReviewQuality() {
        const approvals = this.reviews.filter(r => r.state === 'approved').length;
        const changesRequested = this.reviews.filter(r => r.state === 'changes_requested').length;
        const totalReviews = this.reviews.length;

        return {
            total_reviews: totalReviews,
            approvals,
            changes_requested: changesRequested,
            approval_rate: totalReviews > 0 ? (approvals / totalReviews * 100).toFixed(2) + '%' : '0%',
            avg_comments_per_review: totalReviews > 0 ?
                Math.round(this.reviews.reduce((sum, r) => sum + r.comments_count, 0) / totalReviews) : 0,
        };
    }

    /**
     * Get contributor activity
     * @returns {Array} Contributors sorted by activity
     */
    getContributorActivity() {
        const activity = {};

        this.pullRequests.forEach(pr => {
            if (!activity[pr.author]) {
                activity[pr.author] = { prs: 0, reviews: 0, issues: 0 };
            }
            activity[pr.author].prs += 1;
        });

        this.reviews.forEach(review => {
            if (!activity[review.author]) {
                activity[review.author] = { prs: 0, reviews: 0, issues: 0 };
            }
            activity[review.author].reviews += 1;
        });

        this.issues.forEach(issue => {
            if (!activity[issue.author]) {
                activity[issue.author] = { prs: 0, reviews: 0, issues: 0 };
            }
            activity[issue.author].issues += 1;
        });

        return Object.entries(activity)
            .map(([author, stats]) => ({ author, ...stats }))
            .sort((a, b) => (b.prs + b.reviews + b.issues) - (a.prs + a.reviews + a.issues));
    }

    /**
     * Detect development patterns
     * @returns {Object} Development patterns
     */
    detectDevelopmentPatterns() {
        return {
            active_contributors: this.getContributorActivity().slice(0, 5),
            most_commented_pr: this.getMostCommentedPR(),
            most_discussed_issue: this.getMostDiscussedIssue(),
            pr_velocity: this.calculatePRVelocity(),
            issue_resolution_rate: this.calculateIssueResolution(),
        };
    }

    /**
     * Get most commented PR
     * @returns {Object} PR with most comments
     */
    getMostCommentedPR() {
        const reviews = {};
        this.reviews.forEach(r => {
            reviews[r.pr_id] = (reviews[r.pr_id] || 0) + r.comments_count;
        });

        let maxPR = null;
        let maxComments = 0;

        Object.entries(reviews).forEach(([prId, count]) => {
            if (count > maxComments) {
                maxComments = count;
                maxPR = prId;
            }
        });

        return maxPR ? { pr_id: maxPR, comments: maxComments } : null;
    }

    /**
     * Get most discussed issue
     * @returns {Object} Issue with most comments
     */
    getMostDiscussedIssue() {
        const sorted = [...this.issues].sort((a, b) => b.comments_count - a.comments_count);
        return sorted[0] || null;
    }

    /**
     * Calculate PR velocity (PRs per week)
     * @returns {number} PRs per week
     */
    calculatePRVelocity() {
        if (this.pullRequests.length === 0) return 0;

        const first = new Date(Math.min(...this.pullRequests.map(pr => new Date(pr.created_at))));
        const last = new Date(Math.max(...this.pullRequests.map(pr => new Date(pr.created_at))));
        const weeks = (last - first) / (1000 * 60 * 60 * 24 * 7);

        return weeks > 0 ? (this.pullRequests.length / weeks).toFixed(2) : this.pullRequests.length;
    }

    /**
     * Calculate issue resolution rate
     * @returns {string} Percentage of closed issues
     */
    calculateIssueResolution() {
        if (this.issues.length === 0) return '0%';
        const closed = this.issues.filter(i => i.state === 'closed').length;
        return ((closed / this.issues.length) * 100).toFixed(2) + '%';
    }
}

module.exports = CollaborationAnalyzer;
