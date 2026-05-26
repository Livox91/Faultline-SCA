/**
 * Domain Module Index
 * Exports all domain processing modules
 */

const GraphBuilder = require('./graph-builder');
const ASTExtractor = require('./ast-extractor');
const DependencyAnalyzer = require('./dependency-analyzer');
const GitAnalyzer = require('./git-analyzer');
const SecurityAnalyzer = require('./security-analyzer');
const CollaborationAnalyzer = require('./collaboration-analyzer');
const GovernanceAnalyzer = require('./governance-analyzer');
const DiffCalculator = require('./diff-calculator');
const IndexingManager = require('./indexing-manager');

module.exports = {
    GraphBuilder,
    ASTExtractor,
    DependencyAnalyzer,
    GitAnalyzer,
    SecurityAnalyzer,
    CollaborationAnalyzer,
    GovernanceAnalyzer,
    DiffCalculator,
    IndexingManager,

    /**
     * Create all analyzers
     * @returns {Object} Analyzer instances
     */
    createAnalyzers() {
        return {
            graph: new GraphBuilder(),
            ast: new ASTExtractor(),
            dependencies: new DependencyAnalyzer(),
            git: new GitAnalyzer(),
            security: new SecurityAnalyzer(),
            collaboration: new CollaborationAnalyzer(),
            governance: new GovernanceAnalyzer(),
            indexing: new IndexingManager(),
        };
    },
};
