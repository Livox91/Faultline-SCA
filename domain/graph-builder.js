/**
 * Graph Builder
 * Central orchestrator for building and updating the knowledge graph
 */

class GraphBuilder {
    constructor() {
        this.graph = {
            nodes: [],
            edges: [],
            metadata: {
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                version: '1.0.0',
            },
        };
        this.nodeIndex = new Map(); // For quick lookups
    }

    /**
     * Add node to the graph
     * @param {Object} node - Node data
     * @returns {Object} Added node
     */
    addNode(node) {
        const nodeWithId = {
            id: this.generateId(node.type, node.name),
            ...node,
            created_at: new Date().toISOString(),
        };

        this.graph.nodes.push(nodeWithId);
        this.nodeIndex.set(nodeWithId.id, nodeWithId);

        return nodeWithId;
    }

    /**
     * Add edge (relationship) to the graph
     * @param {string} sourceId - Source node ID
     * @param {string} targetId - Target node ID
     * @param {Object} relationship - Relationship metadata
     * @returns {Object} Added edge
     */
    addEdge(sourceId, targetId, relationship) {
        const edge = {
            id: `${sourceId}--${relationship.type}-->${targetId}`,
            source: sourceId,
            target: targetId,
            ...relationship,
            created_at: new Date().toISOString(),
        };

        this.graph.edges.push(edge);
        return edge;
    }

    /**
     * Generate unique ID for node
     * @param {string} type - Node type
     * @param {string} name - Node name
     * @returns {string} Generated ID
     */
    generateId(type, name) {
        const hash = require('crypto')
            .createHash('md5')
            .update(`${type}:${name}`)
            .digest('hex');
        return `${type}:${hash}`;
    }

    /**
     * Update node properties
     * @param {string} nodeId - Node ID
     * @param {Object} updates - Properties to update
     * @returns {Object} Updated node
     */
    updateNode(nodeId, updates) {
        const node = this.nodeIndex.get(nodeId);
        if (!node) {
            throw new Error(`Node not found: ${nodeId}`);
        }

        Object.assign(node, updates);
        node.updated_at = new Date().toISOString();

        return node;
    }

    /**
     * Get node by ID
     * @param {string} nodeId - Node ID
     * @returns {Object} Node data
     */
    getNode(nodeId) {
        return this.nodeIndex.get(nodeId);
    }

    /**
     * Find nodes by type
     * @param {string} type - Node type
     * @returns {Array} Nodes of given type
     */
    findNodesByType(type) {
        return this.graph.nodes.filter(n => n.type === type);
    }

    /**
     * Get incoming edges for node
     * @param {string} nodeId - Target node ID
     * @returns {Array} Incoming edges
     */
    getIncomingEdges(nodeId) {
        return this.graph.edges.filter(e => e.target === nodeId);
    }

    /**
     * Get outgoing edges for node
     * @param {string} nodeId - Source node ID
     * @returns {Array} Outgoing edges
     */
    getOutgoingEdges(nodeId) {
        return this.graph.edges.filter(e => e.source === nodeId);
    }

    /**
     * Get graph statistics
     * @returns {Object} Graph stats
     */
    getStats() {
        const nodeTypeCount = {};
        const edgeTypeCount = {};

        this.graph.nodes.forEach(n => {
            nodeTypeCount[n.type] = (nodeTypeCount[n.type] || 0) + 1;
        });

        this.graph.edges.forEach(e => {
            edgeTypeCount[e.type] = (edgeTypeCount[e.type] || 0) + 1;
        });

        return {
            total_nodes: this.graph.nodes.length,
            total_edges: this.graph.edges.length,
            node_types: nodeTypeCount,
            edge_types: edgeTypeCount,
            created_at: this.graph.metadata.created_at,
            updated_at: this.graph.metadata.updated_at,
        };
    }

    /**
     * Export graph as JSON
     * @returns {Object} Graph data
     */
    export() {
        this.graph.metadata.updated_at = new Date().toISOString();
        return JSON.parse(JSON.stringify(this.graph));
    }

    /**
     * Import graph from JSON
     * @param {Object} data - Graph data
     */
    import(data) {
        this.graph = data;
        this.rebuildIndex();
    }

    /**
     * Rebuild node index after import
     */
    rebuildIndex() {
        this.nodeIndex.clear();
        this.graph.nodes.forEach(node => {
            this.nodeIndex.set(node.id, node);
        });
    }

    /**
     * Find path between two nodes
     * @param {string} sourceId - Source node ID
     * @param {string} targetId - Target node ID
     * @returns {Array} Path nodes
     */
    findPath(sourceId, targetId) {
        const queue = [{ nodeId: sourceId, path: [sourceId] }];
        const visited = new Set([sourceId]);

        while (queue.length > 0) {
            const { nodeId, path } = queue.shift();

            if (nodeId === targetId) {
                return path;
            }

            const outgoing = this.getOutgoingEdges(nodeId);
            for (const edge of outgoing) {
                if (!visited.has(edge.target)) {
                    visited.add(edge.target);
                    queue.push({
                        nodeId: edge.target,
                        path: [...path, edge.target],
                    });
                }
            }
        }

        return null; // No path found
    }
}

module.exports = GraphBuilder;
