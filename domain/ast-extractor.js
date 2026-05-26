/**
 * AST Extractor
 * Extracts codebase structure and AST entities from source code
 */

const fs = require('fs').promises;
const path = require('path');

class ASTExtractor {
    constructor() {
        this.supportedLanguages = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rb': 'ruby',
            '.php': 'php',
            '.cs': 'csharp',
        };
    }

    /**
     * Extract AST from file
     * @param {string} filePath - Path to file
     * @param {string} content - File content
     * @returns {Promise<Object>} AST nodes
     */
    async extractFromFile(filePath, content) {
        const ext = path.extname(filePath);
        const language = this.supportedLanguages[ext];

        if (!language) {
            return { type: 'file', path: filePath, language: 'unknown', entities: [] };
        }

        return {
            type: 'file',
            path: filePath,
            language,
            entities: this.parseContent(content, language),
        };
    }

    /**
     * Parse file content based on language
     * @param {string} content - File content
     * @param {string} language - Programming language
     * @returns {Array} Extracted entities
     */
    parseContent(content, language) {
        switch (language) {
            case 'javascript':
            case 'typescript':
                return this.parseJavaScript(content);
            case 'python':
                return this.parsePython(content);
            case 'java':
                return this.parseJava(content);
            default:
                return this.parseGeneric(content);
        }
    }

    /**
     * Parse JavaScript/TypeScript
     * @param {string} content - File content
     * @returns {Array} Extracted entities
     */
    parseJavaScript(content) {
        const entities = [];

        // Extract imports
        const importRegex = /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            entities.push({
                type: 'import',
                name: match[1] || match[2],
                source: match[3],
            });
        }

        // Extract exports
        const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g;
        while ((match = exportRegex.exec(content)) !== null) {
            entities.push({
                type: 'export',
                name: match[1],
            });
        }

        // Extract class definitions
        const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
        while ((match = classRegex.exec(content)) !== null) {
            entities.push({
                type: 'class',
                name: match[1],
                extends: match[2] || null,
            });
        }

        // Extract function definitions
        const functionRegex = /(?:async\s+)?(?:function\s+)?(\w+)\s*\([^)]*\)\s*{/g;
        while ((match = functionRegex.exec(content)) !== null) {
            entities.push({
                type: 'function',
                name: match[1],
            });
        }

        return entities;
    }

    /**
     * Parse Python
     * @param {string} content - File content
     * @returns {Array} Extracted entities
     */
    parsePython(content) {
        const entities = [];

        // Extract imports
        const importRegex = /^(?:import|from)\s+(.+?)(?:\s+import\s+(.+))?$/gm;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            entities.push({
                type: 'import',
                module: match[1],
                items: match[2] || null,
            });
        }

        // Extract class definitions
        const classRegex = /^class\s+(\w+)(?:\(([^)]+)\))?:/gm;
        while ((match = classRegex.exec(content)) !== null) {
            entities.push({
                type: 'class',
                name: match[1],
                bases: match[2] || null,
            });
        }

        // Extract function definitions
        const functionRegex = /^(?:\s*)(?:async\s+)?def\s+(\w+)\s*\(/gm;
        while ((match = functionRegex.exec(content)) !== null) {
            entities.push({
                type: 'function',
                name: match[1],
            });
        }

        return entities;
    }

    /**
     * Parse Java
     * @param {string} content - File content
     * @returns {Array} Extracted entities
     */
    parseJava(content) {
        const entities = [];

        // Extract package
        const packageRegex = /^package\s+([^;]+);/m;
        const packageMatch = packageRegex.exec(content);
        if (packageMatch) {
            entities.push({
                type: 'package',
                name: packageMatch[1],
            });
        }

        // Extract imports
        const importRegex = /^import\s+([^;]+);/gm;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            entities.push({
                type: 'import',
                name: match[1],
            });
        }

        // Extract class definitions
        const classRegex = /(?:public|private|protected)?\s*class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
        while ((match = classRegex.exec(content)) !== null) {
            entities.push({
                type: 'class',
                name: match[1],
                extends: match[2] || null,
            });
        }

        // Extract method definitions
        const methodRegex = /(?:public|private|protected)?\s*(?:static)?\s*(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*{/g;
        while ((match = methodRegex.exec(content)) !== null) {
            entities.push({
                type: 'method',
                name: match[1],
            });
        }

        return entities;
    }

    /**
     * Generic parsing fallback
     * @param {string} content - File content
     * @returns {Array} Extracted entities
     */
    parseGeneric(content) {
        const entities = [];
        const lines = content.split('\n');

        // Try to extract function/class-like patterns
        const defRegex = /^(?:def|class|function|func|struct|interface)\s+(\w+)/;

        lines.forEach((line, index) => {
            const match = defRegex.exec(line);
            if (match) {
                entities.push({
                    type: 'definition',
                    name: match[1],
                    line: index + 1,
                });
            }
        });

        return entities;
    }

    /**
     * Extract directory structure
     * @param {string} dirPath - Directory path
     * @returns {Promise<Object>} Directory tree
     */
    async extractDirectoryStructure(dirPath) {
        const tree = {
            type: 'directory',
            name: path.basename(dirPath),
            path: dirPath,
            children: [],
        };

        try {
            const files = await fs.readdir(dirPath);

            for (const file of files) {
                const fullPath = path.join(dirPath, file);
                const stat = await fs.stat(fullPath);

                if (stat.isDirectory()) {
                    if (!this.isIgnoredDirectory(file)) {
                        tree.children.push(
                            await this.extractDirectoryStructure(fullPath)
                        );
                    }
                } else if (this.isCodeFile(file)) {
                    tree.children.push({
                        type: 'file',
                        name: file,
                        path: fullPath,
                        language: this.supportedLanguages[path.extname(file)] || 'unknown',
                    });
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
        }

        return tree;
    }

    /**
     * Check if directory should be ignored
     * @param {string} dirName - Directory name
     * @returns {boolean} Should ignore
     */
    isIgnoredDirectory(dirName) {
        const ignored = [
            'node_modules',
            '.git',
            'dist',
            'build',
            'venv',
            '__pycache__',
            '.pytest_cache',
        ];
        return ignored.includes(dirName);
    }

    /**
     * Check if file is a code file
     * @param {string} fileName - File name
     * @returns {boolean} Is code file
     */
    isCodeFile(fileName) {
        return Object.keys(this.supportedLanguages).some(ext =>
            fileName.endsWith(ext)
        );
    }
}

module.exports = ASTExtractor;
