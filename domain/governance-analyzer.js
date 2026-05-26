/**
 * Governance Analyzer
 * Analyzes repository configuration and governance
 */

class GovernanceAnalyzer {
    constructor() {
        this.workflows = [];
        this.codeowners = {};
        this.branchProtection = {};
        this.config = {};
    }

    /**
     * Parse GitHub Actions workflow
     * @param {string} workflowYaml - Workflow YAML content
     * @returns {Object} Parsed workflow
     */
    parseWorkflow(workflowYaml) {
        const workflow = {
            name: this.extractYamlValue(workflowYaml, 'name'),
            triggers: this.extractYamlArray(workflowYaml, 'on'),
            jobs: this.extractJobs(workflowYaml),
            path: '',
        };

        this.workflows.push(workflow);
        return workflow;
    }

    /**
     * Extract YAML value
     * @param {string} yaml - YAML content
     * @param {string} key - Key to extract
     * @returns {string} Value
     */
    extractYamlValue(yaml, key) {
        const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm');
        const match = yaml.match(regex);
        return match ? match[1].trim() : '';
    }

    /**
     * Extract YAML array
     * @param {string} yaml - YAML content
     * @param {string} key - Key to extract
     * @returns {Array} Array values
     */
    extractYamlArray(yaml, key) {
        const regex = new RegExp(`^${key}:\\s*\\n((?:\\s+-.*\\n?)*)`, 'm');
        const match = yaml.match(regex);
        if (!match) return [];

        return match[1]
            .split('\n')
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.replace(/^\s*-\s*/, '').trim())
            .filter(Boolean);
    }

    /**
     * Extract jobs from workflow
     * @param {string} workflowYaml - Workflow YAML
     * @returns {Array} Jobs
     */
    extractJobs(workflowYaml) {
        const jobs = [];
        const jobRegex = /jobs:\s*\n((?:\s{2}\w+:[\s\S]*?(?=\s{2}\w+:|$))+)/;
        const match = workflowYaml.match(jobRegex);

        if (match) {
            const jobLines = match[1].split('\n');
            let currentJob = null;

            jobLines.forEach(line => {
                if (line.match(/^\s{2}\w+:\s*$/)) {
                    const jobName = line.trim().replace(':', '');
                    currentJob = { name: jobName, steps: [] };
                    jobs.push(currentJob);
                }
            });
        }

        return jobs;
    }

    /**
     * Parse CODEOWNERS file
     * @param {string} codeownersContent - CODEOWNERS file content
     * @returns {Object} Ownership rules
     */
    parseCodeowners(codeownersContent) {
        const rules = {};

        codeownersContent.split('\n').forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#')) return;

            const parts = line.split(/\s+/);
            const pattern = parts[0];
            const owners = parts.slice(1);

            rules[pattern] = owners;
            this.codeowners[pattern] = owners;
        });

        return rules;
    }

    /**
     * Parse branch protection rules
     * @param {Object} protectionData - Branch protection data
     * @returns {Object} Protection rules
     */
    parseBranchProtection(protectionData) {
        const rules = {
            branch: protectionData.branch,
            require_pull_request_reviews: protectionData.required_pull_request_reviews?.required_approving_review_count || 0,
            require_status_checks: !!protectionData.required_status_checks,
            required_checks: protectionData.required_status_checks?.contexts || [],
            require_signed_commits: protectionData.required_commit_signing || false,
            dismiss_stale_reviews: protectionData.required_pull_request_reviews?.dismiss_stale_reviews || false,
            enforce_admins: protectionData.enforce_admins || false,
        };

        this.branchProtection[protectionData.branch] = rules;
        return rules;
    }

    /**
     * Get CODEOWNERS for file
     * @param {string} filePath - File path
     * @returns {Array} Owners
     */
    getCodeownersForFile(filePath) {
        for (const [pattern, owners] of Object.entries(this.codeowners)) {
            if (this.pathMatches(filePath, pattern)) {
                return owners;
            }
        }
        return [];
    }

    /**
     * Check if path matches pattern
     * @param {string} filePath - File path
     * @param {string} pattern - Pattern
     * @returns {boolean} Matches
     */
    pathMatches(filePath, pattern) {
        const regex = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
        return regex.test(filePath);
    }

    /**
     * Get governance score
     * @returns {Object} Governance metrics
     */
    getGovernanceScore() {
        let score = 0;
        const details = [];

        // CI/CD configured
        if (this.workflows.length > 0) {
            score += 20;
            details.push('✓ CI/CD workflows configured');
        }

        // CODEOWNERS defined
        if (Object.keys(this.codeowners).length > 0) {
            score += 20;
            details.push('✓ CODEOWNERS file defined');
        }

        // Branch protection
        if (Object.keys(this.branchProtection).length > 0) {
            score += 20;
            details.push('✓ Branch protection rules configured');
        }

        // Require reviews
        const mainBranch = this.branchProtection['main'] || this.branchProtection['master'];
        if (mainBranch?.require_pull_request_reviews > 0) {
            score += 20;
            details.push(`✓ Require ${mainBranch.require_pull_request_reviews} review(s) for main branch`);
        }

        // Require status checks
        if (mainBranch?.require_status_checks) {
            score += 20;
            details.push('✓ Status checks required before merge');
        }

        return {
            score: Math.min(100, score),
            max_score: 100,
            percentage: Math.min(100, score),
            details,
        };
    }

    /**
     * Get workflow statistics
     * @returns {Object} Workflow stats
     */
    getWorkflowStatistics() {
        const stats = {
            total_workflows: this.workflows.length,
            workflows_by_trigger: {},
            total_jobs: 0,
        };

        this.workflows.forEach(workflow => {
            workflow.triggers.forEach(trigger => {
                stats.workflows_by_trigger[trigger] = (stats.workflows_by_trigger[trigger] || 0) + 1;
            });
            stats.total_jobs += workflow.jobs.length;
        });

        return stats;
    }

    /**
     * Check governance compliance
     * @returns {Object} Compliance report
     */
    checkCompliance() {
        const checks = {
            has_codeowners: Object.keys(this.codeowners).length > 0,
            has_branch_protection: Object.keys(this.branchProtection).length > 0,
            has_ci_cd: this.workflows.length > 0,
            main_branch_protected: !!this.branchProtection['main'] || !!this.branchProtection['master'],
            requires_reviews: !!(this.branchProtection['main']?.require_pull_request_reviews > 0 ||
                this.branchProtection['master']?.require_pull_request_reviews > 0),
            requires_status_checks: !!(this.branchProtection['main']?.require_status_checks ||
                this.branchProtection['master']?.require_status_checks),
        };

        const compliant = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;

        return {
            compliant_checks: compliant,
            total_checks: total,
            compliance_percentage: Math.round((compliant / total) * 100),
            checks,
        };
    }

    /**
     * List all protected branches
     * @returns {Array} Protected branches
     */
    getProtectedBranches() {
        return Object.keys(this.branchProtection);
    }

    /**
     * Get access control for file
     * @param {string} filePath - File path
     * @returns {Object} Access control info
     */
    getFileAccessControl(filePath) {
        const owners = this.getCodeownersForFile(filePath);
        const branch = 'main'; // Default to main
        const branchRules = this.branchProtection[branch];

        return {
            file: filePath,
            owners,
            requires_review: !!(branchRules?.require_pull_request_reviews > 0),
            review_count: branchRules?.require_pull_request_reviews || 0,
            requires_status_checks: !!branchRules?.require_status_checks,
            requires_signed_commits: !!branchRules?.require_signed_commits,
        };
    }
}

module.exports = GovernanceAnalyzer;
