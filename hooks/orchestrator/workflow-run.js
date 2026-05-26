/**
 * Workflow Run Hook for Runtime Orchestrator
 * Handles workflow_run events with action: completed
 * 
 * Purpose: Deployment tracking and automated rollback correlation
 */

module.exports = {
    name: 'workflow-run',
    description: 'Tracks workflow completions for deployment tracking',
    actions: ['completed'],

    /**
     * Main handler for workflow run events
     * @param {Object} payload - GitHub webhook payload
     * @returns {Promise<Object>} Workflow tracking result
     */
    async handle(payload) {
        const {
            action,
            workflow_run,
            repository,
        } = payload;

        try {
            return {
                event_type: 'workflow_run',
                action,
                repository: repository.full_name,
                timestamp: new Date().toISOString(),
                status: workflow_run.conclusion === 'success' ? 'success' : 'failed',
                data: {
                    run_id: workflow_run.id,
                    run_number: workflow_run.run_number,
                    workflow_id: workflow_run.workflow_id,
                    workflow_name: workflow_run.name,
                    head_branch: workflow_run.head_branch,
                    head_commit: workflow_run.head_commit?.id,
                    base_branch: workflow_run.base_branch,
                    event: workflow_run.event,
                    status: workflow_run.status,
                    conclusion: workflow_run.conclusion, // success, failure, cancelled, skipped, etc.
                    created_at: workflow_run.created_at,
                    updated_at: workflow_run.updated_at,
                    run_started_at: workflow_run.run_started_at,
                    actor: workflow_run.actor?.login,
                    pull_requests: workflow_run.pull_requests || [],
                    artifacts_count: workflow_run.artifacts_count,
                    duration_minutes: this.calculateDuration(workflow_run.created_at, workflow_run.updated_at),
                },
            };
        } catch (error) {
            console.error('Error processing workflow run hook:', error);
            throw error;
        }
    },

    /**
     * Calculate workflow duration in minutes
     * @param {string} startTime - Workflow start time
     * @param {string} endTime - Workflow end time
     * @returns {number} Duration in minutes
     */
    calculateDuration(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        return Math.round((end - start) / (1000 * 60));
    },

    /**
     * Determine if workflow indicates a deployment
     * @param {Object} workflowData - Workflow run data
     * @returns {boolean} Whether this is a deployment
     */
    isDeploymentWorkflow(workflowData) {
        const deploymentKeywords = ['deploy', 'release', 'production'];
        const workflowName = workflowData.workflow_name.toLowerCase();
        return deploymentKeywords.some(keyword => workflowName.includes(keyword));
    },

    /**
     * Create deployment record from successful workflow
     * @param {Object} workflowData - Workflow run data
     * @returns {Object|null} Deployment record or null if not a deployment
     */
    createDeploymentRecord(workflowData) {
        if (!this.isDeploymentWorkflow(workflowData) || workflowData.conclusion !== 'success') {
            return null;
        }

        return {
            commit_sha: workflowData.head_commit,
            branch: workflowData.head_branch,
            workflow_run_id: workflowData.run_id,
            deployed_at: workflowData.updated_at,
            duration_minutes: workflowData.duration_minutes,
            status: 'deployed',
        };
    },

    /**
     * Detect potential failures to correlate with runtime incidents
     * @param {Object} workflowData - Workflow run data
     * @returns {Object|null} Failure incident or null
     */
    detectFailureIncident(workflowData) {
        if (workflowData.conclusion === 'success') {
            return null;
        }

        return {
            incident_type: 'deployment_failure',
            workflow_run_id: workflowData.run_id,
            workflow_name: workflowData.workflow_name,
            commit_sha: workflowData.head_commit,
            failure_reason: workflowData.conclusion,
            timestamp: workflowData.updated_at,
            severity: workflowData.head_branch === 'main' ? 'Critical' : 'Normal',
        };
    },
};
