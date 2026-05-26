/**
 * Knowledge Graph Generator & Output Manager
 * Generates and manages the final knowledge graph output
 */

const fs = require('fs').promises;
const path = require('path');

class KnowledgeGraphGenerator {
    constructor(outputDir = './output') {
        this.outputDir = outputDir;
        this.graph = null;
        this.metadata = {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            version: '1.0.0',
            repository: null,
        };
    }

    /**
     * Initialize output directory
     */
    async initializeOutputDir() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
            console.log(`Output directory ready: ${this.outputDir}`);
        } catch (error) {
            console.error(`Failed to initialize output directory: ${error}`);
            throw error;
        }
    }

    /**
     * Save knowledge graph to JSON
     * @param {Object} graph - Knowledge graph
     * @param {string} filename - Output filename
     */
    async saveGraphToJSON(graph, filename = 'knowledge-graph.json') {
        const filepath = path.join(this.outputDir, filename);
        const output = {
            metadata: this.metadata,
            graph,
        };

        try {
            await fs.writeFile(filepath, JSON.stringify(output, null, 2), 'utf8');
            console.log(`Knowledge graph saved to: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`Failed to save knowledge graph: ${error}`);
            throw error;
        }
    }

    /**
     * Export graph as GraphML (network analysis format)
     * @param {Object} graph - Knowledge graph
     * @param {string} filename - Output filename
     */
    async exportAsGraphML(graph, filename = 'knowledge-graph.graphml') {
        const filepath = path.join(this.outputDir, filename);
        let graphml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns
  http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
  <graph edgedefault="directed">\n`;

        // Add nodes
        graph.nodes?.forEach(node => {
            graphml += `    <node id="${this.sanitizeId(node.id)}">
      <data key="type">${node.type}</data>
      <data key="name">${this.sanitizeXml(node.name)}</data>
    </node>\n`;
        });

        // Add edges
        graph.edges?.forEach((edge, idx) => {
            graphml += `    <edge source="${this.sanitizeId(edge.source)}" target="${this.sanitizeId(edge.target)}">
      <data key="type">${edge.type}</data>
    </edge>\n`;
        });

        graphml += `  </graph>
</graphml>`;

        try {
            await fs.writeFile(filepath, graphml, 'utf8');
            console.log(`GraphML exported to: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`Failed to export GraphML: ${error}`);
            throw error;
        }
    }

    /**
     * Export graph as CSV (tabular format)
     * @param {Object} graph - Knowledge graph
     */
    async exportAsCSV(graph) {
        // Export nodes
        const nodesCSV = await this.exportNodesToCSV(graph);
        // Export edges
        const edgesCSV = await this.exportEdgesToCSV(graph);

        return { nodesFile: nodesCSV, edgesFile: edgesCSV };
    }

    /**
     * Export nodes to CSV
     * @param {Object} graph - Knowledge graph
     */
    async exportNodesToCSV(graph) {
        const filepath = path.join(this.outputDir, 'nodes.csv');
        let csv = 'id,type,name,properties\n';

        graph.nodes?.forEach(node => {
            const props = JSON.stringify(node).replace(/"/g, '""');
            csv += `"${node.id}","${node.type}","${node.name}","${props}"\n`;
        });

        try {
            await fs.writeFile(filepath, csv, 'utf8');
            console.log(`Nodes exported to: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`Failed to export nodes CSV: ${error}`);
            throw error;
        }
    }

    /**
     * Export edges to CSV
     * @param {Object} graph - Knowledge graph
     */
    async exportEdgesToCSV(graph) {
        const filepath = path.join(this.outputDir, 'edges.csv');
        let csv = 'source,target,type,relationship\n';

        graph.edges?.forEach(edge => {
            csv += `"${edge.source}","${edge.target}","${edge.type}","${edge.relationship || ''}"\n`;
        });

        try {
            await fs.writeFile(filepath, csv, 'utf8');
            console.log(`Edges exported to: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`Failed to export edges CSV: ${error}`);
            throw error;
        }
    }

    /**
     * Generate graph statistics report
     * @param {Object} graph - Knowledge graph
     * @param {Object} analyzers - Analyzer instances
     */
    async generateStatisticsReport(graph, analyzers) {
        const report = {
            generated_at: new Date().toISOString(),
            graph_statistics: {
                total_nodes: graph.nodes?.length || 0,
                total_edges: graph.edges?.length || 0,
                nodes_by_type: this.groupNodesByType(graph),
                edges_by_type: this.groupEdgesByType(graph),
            },
            security_analysis: analyzers.security?.getSecurityScore() || {},
            collaboration_metrics: analyzers.collaboration?.getCollaborationMetrics() || {},
            governance_compliance: analyzers.governance?.checkCompliance() || {},
            git_statistics: {
                total_commits: analyzers.git?.commits?.length || 0,
                top_contributors: analyzers.git?.getAuthorStatistics?.().slice(0, 5) || [],
            },
        };

        const filepath = path.join(this.outputDir, 'statistics-report.json');
        try {
            await fs.writeFile(filepath, JSON.stringify(report, null, 2), 'utf8');
            console.log(`Statistics report saved to: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`Failed to save statistics report: ${error}`);
            throw error;
        }
    }

    /**
     * Group nodes by type
     * @param {Object} graph - Knowledge graph
     */
    groupNodesByType(graph) {
        const grouped = {};
        graph.nodes?.forEach(node => {
            grouped[node.type] = (grouped[node.type] || 0) + 1;
        });
        return grouped;
    }

    /**
     * Group edges by type
     * @param {Object} graph - Knowledge graph
     */
    groupEdgesByType(graph) {
        const grouped = {};
        graph.edges?.forEach(edge => {
            grouped[edge.type] = (grouped[edge.type] || 0) + 1;
        });
        return grouped;
    }

    /**
     * Generate HTML visualization template
     * @param {Object} graph - Knowledge graph
     */
    async generateHTMLVisualization(graph) {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Knowledge Graph Visualization</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        #graph-container { width: 100%; height: 600px; border: 1px solid #ccc; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat-card { padding: 15px; background: #f5f5f5; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Knowledge Graph Visualization</h1>
    <div class="stats">
        <div class="stat-card">
            <h3>Total Nodes</h3>
            <p>${graph.nodes?.length || 0}</p>
        </div>
        <div class="stat-card">
            <h3>Total Edges</h3>
            <p>${graph.edges?.length || 0}</p>
        </div>
        <div class="stat-card">
            <h3>Node Types</h3>
            <p>${Object.keys(this.groupNodesByType(graph)).length}</p>
        </div>
    </div>
    <div id="graph-container"></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.js"></script>
    <script>
        const graphData = ${JSON.stringify({
            nodes: graph.nodes?.map((n, i) => ({ id: i, label: n.name, title: n.type })) || [],
            edges: graph.edges?.map(e => {
                const sourceIdx = graph.nodes?.findIndex(n => n.id === e.source) || 0;
                const targetIdx = graph.nodes?.findIndex(n => n.id === e.target) || 0;
                return { from: sourceIdx, to: targetIdx, label: e.type };
            }) || [],
        })};
        
        const options = {
            physics: { enabled: true },
            edges: { arrows: 'to', smooth: { type: 'continuous' } }
        };
        
        new vis.Network(document.getElementById('graph-container'), graphData, options);
    </script>
</body>
</html>`;

        const filepath = path.join(this.outputDir, 'visualization.html');
        try {
            await fs.writeFile(filepath, html, 'utf8');
            console.log(`HTML visualization saved to: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`Failed to save HTML visualization: ${error}`);
            throw error;
        }
    }

    /**
     * Sanitize ID for GraphML
     * @param {string} id - ID to sanitize
     */
    sanitizeId(id) {
        return id.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    /**
     * Sanitize XML content
     * @param {string} content - Content to sanitize
     */
    sanitizeXml(content) {
        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Generate comprehensive report
     * @param {Object} graph - Knowledge graph
     * @param {Object} analyzers - Analyzer instances
     */
    async generateComprehensiveReport(graph, analyzers) {
        await this.initializeOutputDir();

        console.log('Generating comprehensive knowledge graph report...');

        // Save main graph
        await this.saveGraphToJSON(graph);

        // Export in multiple formats
        await this.exportAsGraphML(graph);
        await this.exportAsCSV(graph);

        // Generate reports
        await this.generateStatisticsReport(graph, analyzers);
        await this.generateHTMLVisualization(graph);

        // Generate summary
        const summary = {
            timestamp: new Date().toISOString(),
            files_generated: [
                'knowledge-graph.json',
                'knowledge-graph.graphml',
                'nodes.csv',
                'edges.csv',
                'statistics-report.json',
                'visualization.html',
            ],
            output_directory: this.outputDir,
        };

        const summaryPath = path.join(this.outputDir, 'report-summary.json');
        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

        console.log('✓ Knowledge graph report generation complete');
        return summary;
    }
}

module.exports = KnowledgeGraphGenerator;
