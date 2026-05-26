/**
 * Dependency Analyzer
 * Analyzes dependencies and supply chain data
 */

const fs = require('fs').promises;
const path = require('path');

class DependencyAnalyzer {
    constructor() {
        this.manifestPatterns = {
            'npm': ['package.json', 'package-lock.json', 'yarn.lock'],
            'pip': ['requirements.txt', 'setup.py', 'poetry.lock', 'Pipfile.lock'],
            'maven': ['pom.xml'],
            'gradle': ['build.gradle', 'build.gradle.kts'],
            'go': ['go.mod', 'go.sum'],
            'rust': ['Cargo.toml', 'Cargo.lock'],
            'ruby': ['Gemfile', 'Gemfile.lock'],
            'dotnet': ['packages.config', '.csproj'],
            'php': ['composer.json', 'composer.lock'],
        };
    }

    /**
     * Parse package.json (npm)
     * @param {string} content - File content
     * @returns {Object} Dependencies
     */
    parsePackageJson(content) {
        try {
            const pkg = JSON.parse(content);
            return {
                package_manager: 'npm',
                dependencies: pkg.dependencies || {},
                devDependencies: pkg.devDependencies || {},
                peerDependencies: pkg.peerDependencies || {},
                optionalDependencies: pkg.optionalDependencies || {},
            };
        } catch (error) {
            console.error('Error parsing package.json:', error);
            return { package_manager: 'npm', dependencies: {} };
        }
    }

    /**
     * Parse package-lock.json (npm lockfile)
     * @param {string} content - File content
     * @returns {Object} Lock data
     */
    parsePackageLock(content) {
        try {
            const lockData = JSON.parse(content);
            const transitive = {};

            const extractDeps = (pkg) => {
                if (pkg.dependencies) {
                    Object.entries(pkg.dependencies).forEach(([name, dep]) => {
                        transitive[name] = dep.version || dep;
                        if (dep.dependencies) {
                            extractDeps(dep);
                        }
                    });
                }
            };

            extractDeps(lockData);

            return {
                lockfile_type: 'package-lock.json',
                lockfile_version: lockData.lockfileVersion,
                transitive_dependencies: transitive,
            };
        } catch (error) {
            console.error('Error parsing package-lock.json:', error);
            return { lockfile_type: 'package-lock.json', transitive_dependencies: {} };
        }
    }

    /**
     * Parse requirements.txt (pip)
     * @param {string} content - File content
     * @returns {Object} Dependencies
     */
    parseRequirements(content) {
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        const dependencies = {};

        lines.forEach(line => {
            const match = line.match(/^([a-zA-Z0-9\-_.]+)(?:([<>=!~]+)(.+))?/);
            if (match) {
                const name = match[1];
                const version = match[3] || '*';
                const operator = match[2] || '==';
                dependencies[name] = `${operator}${version}`;
            }
        });

        return {
            package_manager: 'pip',
            dependencies,
        };
    }

    /**
     * Parse pom.xml (Maven)
     * @param {string} content - File content
     * @returns {Object} Dependencies
     */
    parsePomXml(content) {
        const dependencies = {};

        // Simple regex-based parsing for dependency tags
        const depRegex = /<dependency>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?<version>([^<]+)<\/version>/g;
        let match;

        while ((match = depRegex.exec(content)) !== null) {
            dependencies[match[1]] = match[2];
        }

        return {
            package_manager: 'maven',
            dependencies,
        };
    }

    /**
     * Parse Cargo.toml (Rust)
     * @param {string} content - File content
     * @returns {Object} Dependencies
     */
    parseCargoToml(content) {
        const dependencies = {};

        // Simple parsing for [dependencies] section
        const depSection = content.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
        if (depSection) {
            const lines = depSection[1].split('\n');
            lines.forEach(line => {
                const match = line.match(/^([a-zA-Z0-9\-_]+)\s*=\s*"([^"]+)"/);
                if (match) {
                    dependencies[match[1]] = match[2];
                }
            });
        }

        return {
            package_manager: 'cargo',
            dependencies,
        };
    }

    /**
     * Parse Dockerfile for base images
     * @param {string} content - Dockerfile content
     * @returns {Array} Base images
     */
    parseDockerfile(content) {
        const baseImages = [];
        const fromRegex = /^FROM\s+([^\s#]+)/gm;
        let match;

        while ((match = fromRegex.exec(content)) !== null) {
            baseImages.push(this.parseImageRef(match[1]));
        }

        return baseImages;
    }

    /**
     * Parse Docker image reference
     * @param {string} imageRef - Image reference
     * @returns {Object} Parsed image
     */
    parseImageRef(imageRef) {
        const parts = imageRef.split(':');
        return {
            registry: imageRef.includes('/') ? imageRef.split('/')[0] : 'docker.io',
            name: parts[0],
            tag: parts[1] || 'latest',
            full: imageRef,
        };
    }

    /**
     * Analyze file content for dependencies
     * @param {string} filePath - File path
     * @param {string} content - File content
     * @returns {Object} Analyzed dependencies
     */
    async analyze(filePath, content) {
        const fileName = path.basename(filePath);

        if (fileName === 'package.json') {
            return this.parsePackageJson(content);
        } else if (fileName === 'package-lock.json') {
            return this.parsePackageLock(content);
        } else if (fileName === 'yarn.lock') {
            return { lockfile_type: 'yarn.lock', parsed: true };
        } else if (fileName === 'requirements.txt') {
            return this.parseRequirements(content);
        } else if (fileName === 'pom.xml') {
            return this.parsePomXml(content);
        } else if (fileName === 'Cargo.toml') {
            return this.parseCargoToml(content);
        } else if (fileName === 'Dockerfile') {
            return { base_images: this.parseDockerfile(content) };
        }

        return { file: fileName, status: 'not_analyzed' };
    }

    /**
     * Calculate vulnerability risk based on dependencies
     * @param {Array} vulnerabilities - List of known vulnerabilities
     * @param {Object} dependencies - Dependencies object
     * @returns {Object} Risk assessment
     */
    assessVulnerabilityRisk(vulnerabilities, dependencies) {
        const affectedDeps = [];
        const riskScore = { critical: 0, high: 0, medium: 0, low: 0 };

        vulnerabilities.forEach(vuln => {
            if (dependencies[vuln.package]) {
                affectedDeps.push({
                    package: vuln.package,
                    installed_version: dependencies[vuln.package],
                    vulnerable_versions: vuln.affected_versions,
                    cve: vuln.cve_id,
                    severity: vuln.severity,
                });
                riskScore[vuln.severity] = (riskScore[vuln.severity] || 0) + 1;
            }
        });

        return {
            affected_dependencies: affectedDeps,
            risk_score: riskScore,
            total_vulnerabilities: affectedDeps.length,
            critical_count: riskScore.critical,
        };
    }

    /**
     * Get transitive dependency chain
     * @param {Object} lockData - Lock file data
     * @param {string} packageName - Package to trace
     * @returns {Array} Dependency chain
     */
    getTransitiveDependencyChain(lockData, packageName) {
        const chain = [packageName];
        let currentDeps = lockData.dependencies?.[packageName]?.dependencies || {};

        while (Object.keys(currentDeps).length > 0) {
            const firstDep = Object.keys(currentDeps)[0];
            chain.push(firstDep);
            currentDeps = currentDeps[firstDep]?.dependencies || {};
        }

        return chain;
    }
}

module.exports = DependencyAnalyzer;
