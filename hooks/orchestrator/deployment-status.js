/**
 * Deployment Status Hook for Runtime Orchestrator
 * Handles deployment_status events
 * 
 * Purpose: Environment awareness and monitoring baseline establishment
 */

module.exports = {
    name: 'deployment-status',
    description: 'Tracks deployment status transitions across environments',

    /**
     * Main handler for deployment status events
     * @param {Object} payload - GitHub webhook payload
     * @returns {Promise<Object>} Deployment status result
     */
    async handle(payload) {
        const {
            deployment,
            deployment_status,
            repository,
        } = payload;

        try {
            return {
                event_type: 'deployment_status',
                repository: repository.full_name,
                timestamp: new Date().toISOString(),
                status: deployment_status.state,
                data: {
                    deployment_id: deployment.id,
                    deployment_status_id: deployment_status.id,
                    environment: deployment.environment,
                    production_environment: deployment.production_environment,
                    state: deployment_status.state, // pending, in_progress, queued, success, failure, inactive, error
                    url: deployment_status.deployment_url,
                    log_url: deployment_status.log_url,
                    description: deployment_status.description,
                    created_at: deployment_status.created_at,
                    updated_at: deployment_status.updated_at,
                    deployment_commit_sha: deployment.sha,
                    deployment_ref: deployment.ref,
                    deployment_task: deployment.task,
                    creator: deployment.creator.login,
                    payload: deployment.payload,
                    transitioned_at: this.getTransitionTime(deployment_status),
                    target_url: deployment_status.target_url,
                },
            };
        } catch (error) {
            console.error('Error processing deployment status hook:', error);
            throw error;
        }
    },

    /**
     * Get transition timestamp
     * @param {Object} deploymentStatus - Deployment status object
     * @returns {string} Transition timestamp
     */
    getTransitionTime(deploymentStatus) {
        return deploymentStatus.updated_at || deploymentStatus.created_at;
    },

    /**
     * Determine if deployment transitioned to production
     * @param {Object} deploymentData - Deployment data
     * @returns {boolean} Whether transitioning to production
     */
    isProductionTransition(deploymentData) {
        return deploymentData.production_environment === true &&
            deploymentData.state === 'success';
    },

    /**
     * Establish monitoring baseline when deployment succeeds in production
     * @param {Object} deploymentData - Deployment data
     * @returns {Object} Baseline configuration
     */
    createMonitoringBaseline(deploymentData) {
        if (!this.isProductionTransition(deploymentData)) {
            return null;
        }

        return {
            deployment_id: deploymentData.deployment_id,
            deployed_version: this.extractVersion(deploymentData.deployment_commit_sha),
            environment: 'production',
            baseline_established_at: deploymentData.transitioned_at,
            monitoring_active: true,
            metrics_to_track: [
                'response_time',
                'error_rate',
                'cpu_usage',
                'memory_usage',
                'request_volume',
                'dependency_health',
            ],
        };
    },

    /**
     * Handle deployment failure scenarios
     * @param {Object} deploymentData - Deployment data
     * @returns {Object|null} Failure incident or null
     */
    handleFailure(deploymentData) {
        if (deploymentData.state !== 'failure' && deploymentData.state !== 'error') {
            return null;
        }

        return {
            incident_type: 'deployment_failure',
            severity: deploymentData.environment === 'production' ? 'Critical' : 'Normal',
            environment: deploymentData.environment,
            commit_sha: deploymentData.deployment_commit_sha,
            timestamp: deploymentData.transitioned_at,
            description: deploymentData.description,
            log_url: deploymentData.log_url,
        };
    },

    /**
     * Extract version from commit SHA
     * @param {string} sha - Commit SHA
     * @returns {string} Short SHA
     */
    extractVersion(sha) {
        return sha ? sha.substring(0, 8) : 'unknown';
    },

    /**
     * Check deployment status for anomalies
     * @param {Object} deploymentData - Deployment data
     * @returns {Array} Detected anomalies
     */
    detectAnomalies(deploymentData) {
        const anomalies = [];

        if (deploymentData.state === 'pending') {
            anomalies.push('Deployment stuck in pending state');
        }

        if (deploymentData.state === 'in_progress') {
            const createdTime = new Date(deploymentData.created_at);
            const now = new Date();
            const durationMinutes = (now - createdTime) / (1000 * 60);

            if (durationMinutes > 30) {
                anomalies.push(`Deployment in progress for ${durationMinutes} minutes`);
            }
        }

        if (deploymentData.state === 'error' || deploymentData.state === 'failure') {
            anomalies.push(`Deployment failed: ${deploymentData.description}`);
        }

        return anomalies;
    },
};
