/**
 * Orchestrator Hooks Index
 * Exports all Runtime Orchestrator event hooks for centralized management
 */

const releaseHook = require('./release');
const workflowRunHook = require('./workflow-run');
const issuesHook = require('./issues');
const issueCommentHook = require('./issue-comment');
const deploymentStatusHook = require('./deployment-status');

module.exports = {
    'release': releaseHook,
    'workflow_run': workflowRunHook,
    'issues': issuesHook,
    'issue_comment': issueCommentHook,
    'deployment_status': deploymentStatusHook,

    /**
     * Get hook by event type
     * @param {string} eventType - GitHub event type
     * @returns {Object} Hook module
     */
    getHook(eventType) {
        return module.exports[eventType];
    },

    /**
     * Get all available orchestrator hooks
     * @returns {Array} List of hook names
     */
    getAvailableHooks() {
        return Object.keys(module.exports).filter(
            key => key !== 'getHook' && key !== 'getAvailableHooks'
        );
    },

    /**
     * Register hook with event emitter
     * @param {Object} emitter - Event emitter
     * @param {string} eventType - GitHub event type
     */
    registerHook(emitter, eventType) {
        const hook = this.getHook(eventType);
        if (hook) {
            emitter.on(eventType, payload => hook.handle(payload));
        }
    },

    /**
     * Register all orchestrator hooks
     * @param {Object} emitter - Event emitter
     */
    registerAll(emitter) {
        this.getAvailableHooks().forEach(eventType => {
            this.registerHook(emitter, eventType);
        });
    },
};
