/**
 * Indexing Manager
 * Manages graph indexing and incremental reindexing operations
 */

class IndexingManager {
    constructor() {
        this.indices = {
            nodesByType: new Map(),
            nodesByName: new Map(),
            edgesByType: new Map(),
            edgesBySource: new Map(),
            edgesByTarget: new Map(),
        };
        this.lastReindexTime = null;
        this.indexStats = {};
    }

    /**
     * Create indices for graph
     * @param {Object} graph - Knowledge graph
     */
    createIndices(graph) {
        console.log('Creating indices for knowledge graph...');
        const startTime = Date.now();

        // Clear existing indices
        this.clearIndices();

        // Index nodes
        graph.nodes?.forEach(node => {
            this.indexNode(node);
        });

        // Index edges
        graph.edges?.forEach(edge => {
            this.indexEdge(edge);
        });

        this.lastReindexTime = new Date().toISOString();
        const duration = Date.now() - startTime;

        this.indexStats = {
            nodes_indexed: graph.nodes?.length || 0,
            edges_indexed: graph.edges?.length || 0,
            index_time_ms: duration,
            timestamp: this.lastReindexTime,
        };

        console.log(`Indexing complete in ${duration}ms`);
        return this.indexStats;
    }

    /**
     * Index a single node
     * @param {Object} node - Node to index
     */
    indexNode(node) {
        // Index by type
        if (!this.indices.nodesByType.has(node.type)) {
            this.indices.nodesByType.set(node.type, []);
        }
        this.indices.nodesByType.get(node.type).push(node);

        // Index by name
        if (!this.indices.nodesByName.has(node.name)) {
            this.indices.nodesByName.set(node.name, []);
        }
        this.indices.nodesByName.get(node.name).push(node);
    }

    /**
     * Index a single edge
     * @param {Object} edge - Edge to index
     */
    indexEdge(edge) {
        // Index by type
        if (!this.indices.edgesByType.has(edge.type)) {
            this.indices.edgesByType.set(edge.type, []);
        }
        this.indices.edgesByType.get(edge.type).push(edge);

        // Index by source
        if (!this.indices.edgesBySource.has(edge.source)) {
            this.indices.edgesBySource.set(edge.source, []);
        }
        this.indices.edgesBySource.get(edge.source).push(edge);

        // Index by target
        if (!this.indices.edgesByTarget.has(edge.target)) {
            this.indices.edgesByTarget.set(edge.target, []);
        }
        this.indices.edgesByTarget.get(edge.target).push(edge);
    }

    /**
     * Perform partial reindexing
     * @param {Array} nodeIds - Node IDs to reindex
     * @param {Object} graph - Knowledge graph
     */
    partialReindex(nodeIds, graph) {
        console.log(`Performing partial reindex on ${nodeIds.length} nodes...`);
        const startTime = Date.now();

        // Remove old indices for these nodes
        nodeIds.forEach(nodeId => {
            this.removeNodeFromIndices(nodeId);
        });

        // Re-index the nodes
        nodeIds.forEach(nodeId => {
            const node = graph.nodes.find(n => n.id === nodeId);
            if (node) {
                this.indexNode(node);
            }
        });

        // Update edges pointing to/from these nodes
        graph.edges?.forEach(edge => {
            if (nodeIds.includes(edge.source) || nodeIds.includes(edge.target)) {
                this.removeEdgeFromIndices(edge.id);
                this.indexEdge(edge);
            }
        });

        this.lastReindexTime = new Date().toISOString();
        const duration = Date.now() - startTime;

        console.log(`Partial reindex complete in ${duration}ms`);
        return {
            nodes_reindexed: nodeIds.length,
            reindex_time_ms: duration,
            timestamp: this.lastReindexTime,
        };
    }

    /**
     * Remove node from all indices
     * @param {string} nodeId - Node ID
     */
    removeNodeFromIndices(nodeId) {
        // This would need to be enhanced to properly handle node removal
        // For now, we'll track what type it is and remove it
        for (const [type, nodes] of this.indices.nodesByType.entries()) {
            this.indices.nodesByType.set(type, nodes.filter(n => n.id !== nodeId));
        }
    }

    /**
     * Remove edge from all indices
     * @param {string} edgeId - Edge ID
     */
    removeEdgeFromIndices(edgeId) {
        for (const [key, edges] of this.indices.edgesByType.entries()) {
            this.indices.edgesByType.set(key, edges.filter(e => e.id !== edgeId));
        }
        for (const [key, edges] of this.indices.edgesBySource.entries()) {
            this.indices.edgesBySource.set(key, edges.filter(e => e.id !== edgeId));
        }
        for (const [key, edges] of this.indices.edgesByTarget.entries()) {
            this.indices.edgesByTarget.set(key, edges.filter(e => e.id !== edgeId));
        }
    }

    /**
     * Clear all indices
     */
    clearIndices() {
        Object.values(this.indices).forEach(index => {
            if (index instanceof Map) {
                index.clear();
            }
        });
    }

    /**
     * Query nodes by type
     * @param {string} type - Node type
     * @returns {Array} Nodes of type
     */
    queryByType(type) {
        return this.indices.nodesByType.get(type) || [];
    }

    /**
     * Query nodes by name
     * @param {string} name - Node name
     * @returns {Array} Nodes with name
     */
    queryByName(name) {
        return this.indices.nodesByName.get(name) || [];
    }

    /**
     * Query edges by type
     * @param {string} type - Edge type
     * @returns {Array} Edges of type
     */
    queryEdgesByType(type) {
        return this.indices.edgesByType.get(type) || [];
    }

    /**
     * Query edges from node
     * @param {string} nodeId - Source node ID
     * @returns {Array} Outgoing edges
     */
    queryEdgesFrom(nodeId) {
        return this.indices.edgesBySource.get(nodeId) || [];
    }

    /**
     * Query edges to node
     * @param {string} nodeId - Target node ID
     * @returns {Array} Incoming edges
     */
    queryEdgesTo(nodeId) {
        return this.indices.edgesByTarget.get(nodeId) || [];
    }

    /**
     * Get index statistics
     * @returns {Object} Index stats
     */
    getStats() {
        return {
            total_node_types: this.indices.nodesByType.size,
            total_unique_names: this.indices.nodesByName.size,
            total_edge_types: this.indices.edgesByType.size,
            nodes_by_type: Object.fromEntries(
                Array.from(this.indices.nodesByType.entries()).map(([type, nodes]) => [type, nodes.length])
            ),
            edges_by_type: Object.fromEntries(
                Array.from(this.indices.edgesByType.entries()).map(([type, edges]) => [type, edges.length])
            ),
            last_reindex_time: this.lastReindexTime,
            index_stats: this.indexStats,
        };
    }

    /**
     * Batch query operations
     * @param {Array} queries - Array of query operations
     * @returns {Object} Batch results
     */
    batchQuery(queries) {
        const results = {};

        queries.forEach((query, index) => {
            switch (query.type) {
                case 'by_type':
                    results[index] = this.queryByType(query.value);
                    break;
                case 'by_name':
                    results[index] = this.queryByName(query.value);
                    break;
                case 'edge_type':
                    results[index] = this.queryEdgesByType(query.value);
                    break;
                case 'edges_from':
                    results[index] = this.queryEdgesFrom(query.value);
                    break;
                case 'edges_to':
                    results[index] = this.queryEdgesTo(query.value);
                    break;
            }
        });

        return results;
    }

    /**
     * Validate index integrity
     * @param {Object} graph - Knowledge graph
     * @returns {Object} Validation report
     */
    validateIntegrity(graph) {
        const report = {
            valid: true,
            issues: [],
        };

        // Check node count
        let totalIndexedNodes = 0;
        this.indices.nodesByType.forEach(nodes => {
            totalIndexedNodes += nodes.length;
        });

        if (totalIndexedNodes !== graph.nodes?.length) {
            report.valid = false;
            report.issues.push(
                `Node count mismatch: indexed=${totalIndexedNodes}, actual=${graph.nodes?.length}`
            );
        }

        // Check edge count
        let totalIndexedEdges = 0;
        this.indices.edgesByType.forEach(edges => {
            totalIndexedEdges += edges.length;
        });

        if (totalIndexedEdges !== graph.edges?.length) {
            report.valid = false;
            report.issues.push(
                `Edge count mismatch: indexed=${totalIndexedEdges}, actual=${graph.edges?.length}`
            );
        }

        return report;
    }
}

module.exports = IndexingManager;
