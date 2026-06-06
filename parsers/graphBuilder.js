
class GraphBuilder {

    constructor() {

        this.nodes = new Map();
        this.relationships = [];
    }

    addGraph(graph) {

        for (const node of graph.nodes) {

            if (!this.nodes.has(node.id)) {
                this.nodes.set(node.id, node);
            }
        }

        this.relationships.push(
            ...graph.relationships
        );
    }

    build() {

        return {
            nodes: [...this.nodes.values()],
            relationships: this.relationships
        };
    }
}

module.exports = GraphBuilder;