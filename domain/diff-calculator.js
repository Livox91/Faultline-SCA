/**
 * Diff Calculator
 * Calculates graph diffs for incremental updates
 */

class DiffCalculator {
    /**
     * Calculate diff between two graph states
     * @param {Object} oldGraph - Old graph state
     * @param {Object} newGraph - New graph state
     * @returns {Object} Calculated diff
     */
    static calculateGraphDiff(oldGraph, newGraph) {
        return {
            nodes_added: DiffCalculator.findNewNodes(oldGraph, newGraph),
            nodes_removed: DiffCalculator.findRemovedNodes(oldGraph, newGraph),
            nodes_modified: DiffCalculator.findModifiedNodes(oldGraph, newGraph),
            edges_added: DiffCalculator.findNewEdges(oldGraph, newGraph),
            edges_removed: DiffCalculator.findRemovedEdges(oldGraph, newGraph),
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Find newly added nodes
     * @param {Object} oldGraph - Old graph
     * @param {Object} newGraph - New graph
     * @returns {Array} Added nodes
     */
    static findNewNodes(oldGraph, newGraph) {
        const oldIds = new Set(oldGraph.nodes.map(n => n.id));
        return newGraph.nodes.filter(n => !oldIds.has(n.id));
    }

    /**
     * Find removed nodes
     * @param {Object} oldGraph - Old graph
     * @param {Object} newGraph - New graph
     * @returns {Array} Removed nodes
     */
    static findRemovedNodes(oldGraph, newGraph) {
        const newIds = new Set(newGraph.nodes.map(n => n.id));
        return oldGraph.nodes.filter(n => !newIds.has(n.id));
    }

    /**
     * Find modified nodes
     * @param {Object} oldGraph - Old graph
     * @param {Object} newGraph - New graph
     * @returns {Array} Modified nodes
     */
    static findModifiedNodes(oldGraph, newGraph) {
        const oldNodeMap = new Map(oldGraph.nodes.map(n => [n.id, n]));
        const modified = [];

        newGraph.nodes.forEach(newNode => {
            const oldNode = oldNodeMap.get(newNode.id);
            if (oldNode && JSON.stringify(oldNode) !== JSON.stringify(newNode)) {
                modified.push({
                    id: newNode.id,
                    old_value: oldNode,
                    new_value: newNode,
                });
            }
        });

        return modified;
    }

    /**
     * Find newly added edges
     * @param {Object} oldGraph - Old graph
     * @param {Object} newGraph - New graph
     * @returns {Array} Added edges
     */
    static findNewEdges(oldGraph, newGraph) {
        const oldEdgeIds = new Set(oldGraph.edges.map(e => e.id));
        return newGraph.edges.filter(e => !oldEdgeIds.has(e.id));
    }

    /**
     * Find removed edges
     * @param {Object} oldGraph - Old graph
     * @param {Object} newGraph - New graph
     * @returns {Array} Removed edges
     */
    static findRemovedEdges(oldGraph, newGraph) {
        const newEdgeIds = new Set(newGraph.edges.map(e => e.id));
        return oldGraph.edges.filter(e => !newEdgeIds.has(e.id));
    }

    /**
     * Calculate impact scope of changes
     * @param {Object} diff - Graph diff
     * @returns {Object} Impact analysis
     */
    static calculateImpactScope(diff) {
        const impactedNodes = new Set();

        // Direct impacts
        diff.nodes_added.forEach(n => impactedNodes.add(n.id));
        diff.nodes_removed.forEach(n => impactedNodes.add(n.id));
        diff.nodes_modified.forEach(n => impactedNodes.add(n.id.id));

        // Related impacts through edges
        diff.edges_added.forEach(e => {
            impactedNodes.add(e.source);
            impactedNodes.add(e.target);
        });
        diff.edges_removed.forEach(e => {
            impactedNodes.add(e.source);
            impactedNodes.add(e.target);
        });

        return {
            impact_radius: impactedNodes.size,
            impacted_nodes: Array.from(impactedNodes),
            change_count: {
                nodes_added: diff.nodes_added.length,
                nodes_removed: diff.nodes_removed.length,
                nodes_modified: diff.nodes_modified.length,
                edges_added: diff.edges_added.length,
                edges_removed: diff.edges_removed.length,
            },
            total_changes: diff.nodes_added.length + diff.nodes_removed.length +
                diff.nodes_modified.length + diff.edges_added.length +
                diff.edges_removed.length,
        };
    }

    /**
     * Identify affected dependencies
     * @param {Object} diff - Graph diff
     * @returns {Array} Affected dependencies
     */
    static identifyAffectedDependencies(diff) {
        const affected = [];

        diff.nodes_added.forEach(n => {
            if (n.type === 'dependency') {
                affected.push({ type: 'added', node: n });
            }
        });

        diff.nodes_removed.forEach(n => {
            if (n.type === 'dependency') {
                affected.push({ type: 'removed', node: n });
            }
        });

        return affected;
    }

    /**
     * Calculate partial reindexing strategy
     * @param {Object} diff - Graph diff
     * @param {Object} graph - Full graph
     * @returns {Object} Reindexing plan
     */
    static calculateReindexingStrategy(diff, graph) {
        const toReindex = {
            nodes: new Set(),
            edges: new Set(),
        };

        // Directly affected nodes
        diff.nodes_added.forEach(n => toReindex.nodes.add(n.id));
        diff.nodes_removed.forEach(n => toReindex.nodes.add(n.id));
        diff.nodes_modified.forEach(n => toReindex.nodes.add(n.id));

        // Find transitively affected nodes (neighbors)
        const allEdges = [...diff.edges_added, ...diff.edges_removed];
        allEdges.forEach(e => {
            toReindex.nodes.add(e.source);
            toReindex.nodes.add(e.target);
            toReindex.edges.add(e.id);
        });

        return {
            nodes_to_reindex: Array.from(toReindex.nodes).length,
            edges_to_reindex: Array.from(toReindex.edges).length,
            total_graph_nodes: graph.nodes.length,
            total_graph_edges: graph.edges.length,
            reindex_percentage: (Array.from(toReindex.nodes).length / graph.nodes.length * 100).toFixed(2),
            affected_node_ids: Array.from(toReindex.nodes),
        };
    }

    /**
     * Detect breaking changes
     * @param {Object} diff - Graph diff
     * @returns {Array} Breaking changes
     */
    static detectBreakingChanges(diff) {
        const breaking = [];

        // Removed exports are breaking
        diff.nodes_removed.forEach(n => {
            if (n.type === 'export') {
                breaking.push({
                    type: 'removed_export',
                    node: n,
                    severity: 'high',
                });
            }
        });

        // Removed API endpoints are breaking
        diff.nodes_removed.forEach(n => {
            if (n.type === 'api_endpoint') {
                breaking.push({
                    type: 'removed_endpoint',
                    node: n,
                    severity: 'high',
                });
            }
        });

        // Removed dependencies could be breaking
        diff.nodes_removed.forEach(n => {
            if (n.type === 'dependency') {
                breaking.push({
                    type: 'removed_dependency',
                    node: n,
                    severity: 'medium',
                });
            }
        });

        return breaking;
    }

    /**
     * Estimate reindex cost
     * @param {Object} reindexPlan - Reindexing strategy
     * @returns {Object} Cost estimation
     */
    static estimateReindexCost(reindexPlan) {
        const avgTimePerNode = 10; // ms
        const avgTimePerEdge = 2; // ms

        const totalTime =
            (reindexPlan.nodes_to_reindex * avgTimePerNode) +
            (reindexPlan.edges_to_reindex * avgTimePerEdge);

        return {
            estimated_time_ms: totalTime,
            estimated_time_seconds: (totalTime / 1000).toFixed(2),
            nodes_to_process: reindexPlan.nodes_to_reindex,
            edges_to_process: reindexPlan.edges_to_reindex,
            optimization_percentage: (1 - (reindexPlan.nodes_to_reindex / reindexPlan.total_graph_nodes)) * 100,
        };
    }

    /**
     * Merge multiple diffs
     * @param {Array} diffs - Array of diffs to merge
     * @returns {Object} Merged diff
     */
    static mergeDiffs(diffs) {
        const merged = {
            nodes_added: [],
            nodes_removed: [],
            nodes_modified: [],
            edges_added: [],
            edges_removed: [],
        };

        diffs.forEach(diff => {
            merged.nodes_added.push(...diff.nodes_added);
            merged.nodes_removed.push(...diff.nodes_removed);
            merged.nodes_modified.push(...diff.nodes_modified);
            merged.edges_added.push(...diff.edges_added);
            merged.edges_removed.push(...diff.edges_removed);
        });

        // Deduplicate
        merged.nodes_added = DiffCalculator.deduplicateNodeList(merged.nodes_added);
        merged.nodes_removed = DiffCalculator.deduplicateNodeList(merged.nodes_removed);
        merged.edges_added = DiffCalculator.deduplicateEdgeList(merged.edges_added);
        merged.edges_removed = DiffCalculator.deduplicateEdgeList(merged.edges_removed);

        return merged;
    }

    /**
     * Deduplicate node list
     * @param {Array} nodes - Nodes
     * @returns {Array} Deduplicated nodes
     */
    static deduplicateNodeList(nodes) {
        const seen = new Set();
        return nodes.filter(n => {
            if (seen.has(n.id)) return false;
            seen.add(n.id);
            return true;
        });
    }

    /**
     * Deduplicate edge list
     * @param {Array} edges - Edges
     * @returns {Array} Deduplicated edges
     */
    static deduplicateEdgeList(edges) {
        const seen = new Set();
        return edges.filter(e => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
        });
    }
}

module.exports = DiffCalculator;
