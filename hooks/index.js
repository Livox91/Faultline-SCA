/**
 * Hooks Module Index
 * Central registry for all GitHub event hooks
 */

const scaHooks = require('./sca');
const orchestratorHooks = require('./orchestrator');

module.exports = {
    sca: scaHooks,
    orchestrator: orchestratorHooks,

    /**
     * Get all available hooks
     * @returns {Array} All hook names
     */
    getAllHooks() {
        return [
            ...scaHooks.getAvailableHooks(),
            ...orchestratorHooks.getAvailableHooks(),
        ];
    },

    /**
     * Get hook by event type (searches both categories)
     * @param {string} eventType - GitHub event type
     * @returns {Object} Hook module or null
     */
    getHookByEventType(eventType) {
        return scaHooks.getHook(eventType) || orchestratorHooks.getHook(eventType);
    },

    /**
     * List all hooks with descriptions
     * @returns {Array} Hooks with metadata
     */
    listAllHooks() {
        const hooks = [];

        // SCA hooks
        scaHooks.getAvailableHooks().forEach(name => {
            const hook = scaHooks.getHook(name);
            hooks.push({
                name,
                category: 'sca',
                description: hook.description,
                actions: hook.actions || [],
            });
        });

        // Orchestrator hooks
        orchestratorHooks.getAvailableHooks().forEach(name => {
            const hook = orchestratorHooks.getHook(name);
            hooks.push({
                name,
                category: 'orchestrator',
                description: hook.description,
                actions: hook.actions || [],
            });
        });

        return hooks;
    },
};
