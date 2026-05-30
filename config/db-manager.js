/**
 * MongoDB Database Manager
 * Manages MongoDB connection and persistence for knowledge graph nodes and edges
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

// Define MongoDB Schemas
const nodeSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, index: true },
    name: { type: String, required: true },
    properties: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const edgeSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    source: { type: String, required: true, index: true },
    target: { type: String, required: true, index: true },
    type: { type: String, required: true },
    relationship: { type: String },
    properties: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const statisticsSchema = new mongoose.Schema({
    totalNodes: { type: Number, required: true },
    totalEdges: { type: Number, required: true },
    nodesByType: mongoose.Schema.Types.Mixed,
    edgesByType: mongoose.Schema.Types.Mixed,
    recordedAt: { type: Date, default: Date.now },
});

const metadataSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, index: true },
    value: mongoose.Schema.Types.Mixed,
    updatedAt: { type: Date, default: Date.now },
});

class MongoDBManager {
    constructor(dbConfig = {}) {
        this.config = {
            url: dbConfig.url || process.env.MONGODB_URL || 'mongodb://localhost:27017/sca-knowledge-graph',
            options: {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                ...dbConfig.options
            }
        };

        this.connection = null;
        this.models = {};
        this.initialized = false;
    }

    /**
     * Initialize MongoDB connection
     */
    async initialize() {
        try {
            console.log('Initializing MongoDB connection...');
            console.log(`MongoDB URL: ${this.config.url}`);

            this.connection = await mongoose.connect(this.config.url, this.config.options);

            // Define models
            this.models.Node = mongoose.model('Node', nodeSchema, 'nodes');
            this.models.Edge = mongoose.model('Edge', edgeSchema, 'edges');
            this.models.Statistics = mongoose.model('Statistics', statisticsSchema, 'statistics');
            this.models.Metadata = mongoose.model('Metadata', metadataSchema, 'metadata');

            this.initialized = true;
            console.log('✓ MongoDB connected and initialized');

            // Create indices
            await this.createIndices();

        } catch (error) {
            console.error('Failed to initialize MongoDB:', error);
            throw error;
        }
    }

    /**
     * Create database indices for performance
     */
    async createIndices() {
        try {
            // Node indices
            await this.models.Node.collection.createIndex({ type: 1 });
            await this.models.Node.collection.createIndex({ createdAt: 1 });

            // Edge indices
            await this.models.Edge.collection.createIndex({ source: 1, target: 1 });
            await this.models.Edge.collection.createIndex({ type: 1 });

            console.log('✓ Database indices created');
        } catch (error) {
            console.error('Failed to create indices:', error);
            // Don't throw - indices may already exist
        }
    }

    /**
     * Insert or update a node
     */
    async upsertNode(node) {
        try {
            const nodeId = node.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const result = await this.models.Node.findOneAndUpdate(
                { id: nodeId },
                {
                    id: nodeId,
                    type: node.type,
                    name: node.name,
                    properties: node,
                    updatedAt: new Date(),
                },
                { upsert: true, new: true }
            );

            console.log(`✓ Node persisted: ${nodeId} (${node.type})`);
            return result;
        } catch (error) {
            console.error('Failed to upsert node:', error);
            throw error;
        }
    }

    /**
     * Insert or update an edge
     */
    async upsertEdge(edge) {
        try {
            const edgeId = edge.id || `edge_${edge.source}_${edge.target}_${Date.now()}`;

            const result = await this.models.Edge.findOneAndUpdate(
                { id: edgeId },
                {
                    id: edgeId,
                    source: edge.source,
                    target: edge.target,
                    type: edge.type,
                    relationship: edge.relationship || null,
                    properties: edge,
                    updatedAt: new Date(),
                },
                { upsert: true, new: true }
            );

            console.log(`✓ Edge persisted: ${edge.source} -> ${edge.target}`);
            return result;
        } catch (error) {
            console.error('Failed to upsert edge:', error);
            throw error;
        }
    }

    /**
     * Get all nodes
     */
    async getAllNodes() {
        try {
            const nodes = await this.models.Node.find({});
            return nodes.map(doc => ({
                ...doc.properties,
                id: doc.id,
            }));
        } catch (error) {
            console.error('Failed to get nodes:', error);
            throw error;
        }
    }

    /**
     * Get all edges
     */
    async getAllEdges() {
        try {
            const edges = await this.models.Edge.find({});
            return edges.map(doc => ({
                ...doc.properties,
                id: doc.id,
                source: doc.source,
                target: doc.target,
                type: doc.type,
                relationship: doc.relationship,
            }));
        } catch (error) {
            console.error('Failed to get edges:', error);
            throw error;
        }
    }

    /**
     * Get nodes by type
     */
    async getNodesByType(type) {
        try {
            const nodes = await this.models.Node.find({ type });
            return nodes.map(doc => ({
                ...doc.properties,
                id: doc.id,
            }));
        } catch (error) {
            console.error('Failed to get nodes by type:', error);
            throw error;
        }
    }

    /**
     * Get edges by type
     */
    async getEdgesByType(type) {
        try {
            const edges = await this.models.Edge.find({ type });
            return edges.map(doc => ({
                ...doc.properties,
                id: doc.id,
                source: doc.source,
                target: doc.target,
                type: doc.type,
            }));
        } catch (error) {
            console.error('Failed to get edges by type:', error);
            throw error;
        }
    }

    /**
     * Get graph statistics
     */
    async getGraphStatistics() {
        try {
            const totalNodes = await this.models.Node.countDocuments();
            const totalEdges = await this.models.Edge.countDocuments();

            const nodeTypes = await this.models.Node.aggregate([
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ]);

            const edgeTypes = await this.models.Edge.aggregate([
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ]);

            const stats = {
                total_nodes: totalNodes,
                total_edges: totalEdges,
                nodes_by_type: nodeTypes.reduce((acc, row) => {
                    acc[row._id] = row.count;
                    return acc;
                }, {}),
                edges_by_type: edgeTypes.reduce((acc, row) => {
                    acc[row._id] = row.count;
                    return acc;
                }, {}),
                recorded_at: new Date().toISOString(),
            };

            return stats;
        } catch (error) {
            console.error('Failed to get statistics:', error);
            throw error;
        }
    }

    /**
     * Record statistics snapshot
     */
    async recordStatistics(stats) {
        try {
            const doc = new this.models.Statistics({
                totalNodes: stats.total_nodes,
                totalEdges: stats.total_edges,
                nodesByType: stats.nodes_by_type,
                edgesByType: stats.edges_by_type,
            });

            await doc.save();
            console.log('✓ Statistics recorded in MongoDB');
        } catch (error) {
            console.error('Failed to record statistics:', error);
            throw error;
        }
    }

    /**
     * Export graph from database
     */
    async exportGraph() {
        try {
            const nodes = await this.getAllNodes();
            const edges = await this.getAllEdges();

            return {
                nodes,
                edges,
                metadata: {
                    exported_at: new Date().toISOString(),
                    total_nodes: nodes.length,
                    total_edges: edges.length,
                }
            };
        } catch (error) {
            console.error('Failed to export graph:', error);
            throw error;
        }
    }

    /**
     * Clear all data (for testing/reset)
     */
    async clearAll() {
        try {
            await this.models.Node.deleteMany({});
            await this.models.Edge.deleteMany({});
            await this.models.Statistics.deleteMany({});
            console.log('✓ All collections cleared');
        } catch (error) {
            console.error('Failed to clear database:', error);
            throw error;
        }
    }

    /**
     * Get collection stats
     */
    async getCollectionStats() {
        try {
            const nodeCount = await this.models.Node.countDocuments();
            const edgeCount = await this.models.Edge.countDocuments();
            const statCount = await this.models.Statistics.countDocuments();

            return {
                nodes: nodeCount,
                edges: edgeCount,
                statistics_snapshots: statCount,
            };
        } catch (error) {
            console.error('Failed to get collection stats:', error);
            throw error;
        }
    }

    /**
     * Close database connection
     */
    async close() {
        try {
            if (this.connection) {
                await mongoose.disconnect();
                console.log('✓ MongoDB connection closed gracefully');
            }
        } catch (error) {
            console.error('Error closing MongoDB connection:', error);
            throw error;
        }
    }
}

module.exports = MongoDBManager;
