/**
 * SCA Hooks Index
 * Exports all SCA event hooks for centralized management
 */

const pullRequestHook = require('./pull-request');
const pushHook = require('./push');
const vulnerabilityAlertHook = require('./repository-vulnerability-alert');
const codeScanningAlertHook = require('./code-scanning-alert');

module.exports = {
    'pull_request': pullRequestHook,
    'push': pushHook,
    'repository_vulnerability_alert': vulnerabilityAlertHook,
    'code_scanning_alert': codeScanningAlertHook,

    /**
     * Get hook by event type
     * @param {string} eventType - GitHub event type
     * @returns {Object} Hook module
     */
    getHook(eventType) {
        return module.exports[eventType];
    },

    /**
     * Get all available SCA hooks
     * @returns {Array} List of hook names
     */
    getAvailableHooks() {
        return Object.keys(module.exports).filter(key => key !== 'getHook' && key !== 'getAvailableHooks');
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
};
