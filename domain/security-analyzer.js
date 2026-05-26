/**
 * Security Analyzer
 * Analyzes security alerts and vulnerabilities
 */

class SecurityAnalyzer {
    constructor() {
        this.alerts = [];
        this.vulnerabilities = [];
        this.secrets = [];
    }

    /**
     * Process Dependabot alert
     * @param {Object} alertData - Dependabot alert
     * @returns {Object} Processed alert
     */
    processDependabotAlert(alertData) {
        const alert = {
            id: alertData.alert_id,
            type: 'dependabot',
            package: alertData.package_name,
            severity: this.normalizeSeverity(alertData.severity),
            cve: alertData.cve_id,
            ghsa: alertData.vulnerability_id,
            description: alertData.description,
            current_version: alertData.current_version,
            patched_version: alertData.first_patched_version,
            created_at: new Date().toISOString(),
            state: alertData.state,
        };

        this.alerts.push(alert);
        return alert;
    }

    /**
     * Process SAST/CodeQL alert
     * @param {Object} alertData - Code scanning alert
     * @returns {Object} Processed alert
     */
    processCodeScanningAlert(alertData) {
        const alert = {
            id: alertData.alert_id,
            type: 'sast',
            rule: alertData.rule_name,
            severity: this.normalizeSeverity(alertData.rule_severity),
            cwe_ids: alertData.cwe_ids || [],
            file: alertData.path,
            line: alertData.start_line,
            column: alertData.start_column,
            message: alertData.message,
            created_at: new Date().toISOString(),
            state: alertData.state,
        };

        this.alerts.push(alert);
        return alert;
    }

    /**
     * Process secret scanning alert
     * @param {Object} secretData - Secret detection data
     * @returns {Object} Processed secret
     */
    processSecretAlert(secretData) {
        const secret = {
            id: secretData.id,
            type: 'secret_scanning',
            secret_type: secretData.secret_type,
            file: secretData.file,
            line: secretData.line,
            detected_at: new Date().toISOString(),
            state: secretData.state || 'detected',
        };

        this.secrets.push(secret);
        return secret;
    }

    /**
     * Normalize severity levels
     * @param {string} severity - Original severity
     * @returns {string} Normalized severity
     */
    normalizeSeverity(severity) {
        const severityMap = {
            'critical': 'Critical',
            'high': 'Critical',
            'medium': 'Normal',
            'low': 'Minor',
            'note': 'Minor',
            'warning': 'Normal',
            'error': 'Critical',
        };
        return severityMap[severity?.toLowerCase()] || 'Normal';
    }

    /**
     * Get security score
     * @returns {Object} Security metrics
     */
    getSecurityScore() {
        const severityCount = {
            Critical: 0,
            Normal: 0,
            Minor: 0,
        };

        this.alerts.forEach(a => {
            severityCount[a.severity] = (severityCount[a.severity] || 0) + 1;
        });

        this.secrets.forEach(() => {
            severityCount.Critical = (severityCount.Critical || 0) + 1;
        });

        const totalIssues = this.alerts.length + this.secrets.length;
        const score = Math.max(0, 100 - (
            severityCount.Critical * 10 +
            severityCount.Normal * 5 +
            severityCount.Minor * 1
        ));

        return {
            score: Math.round(score),
            total_issues: totalIssues,
            severity_breakdown: severityCount,
            alert_count: this.alerts.length,
            secret_count: this.secrets.length,
        };
    }

    /**
     * Get vulnerable dependencies
     * @returns {Array} Vulnerable packages
     */
    getVulnerableDependencies() {
        const dependabotAlerts = this.alerts.filter(a => a.type === 'dependabot');
        const vulnerable = {};

        dependabotAlerts.forEach(alert => {
            if (!vulnerable[alert.package]) {
                vulnerable[alert.package] = [];
            }
            vulnerable[alert.package].push({
                cve: alert.cve,
                severity: alert.severity,
                patched_in: alert.patched_version,
            });
        });

        return Object.entries(vulnerable).map(([pkg, vulns]) => ({
            package: pkg,
            vulnerabilities: vulns,
            severity_count: this.countBySeverity(vulns),
        }));
    }

    /**
     * Count vulnerabilities by severity
     * @param {Array} vulns - Vulnerabilities
     * @returns {Object} Count by severity
     */
    countBySeverity(vulns) {
        const count = { Critical: 0, Normal: 0, Minor: 0 };
        vulns.forEach(v => {
            count[v.severity] = (count[v.severity] || 0) + 1;
        });
        return count;
    }

    /**
     * Get code quality issues by file
     * @returns {Array} Issues by file
     */
    getCodeQualityIssuesByFile() {
        const sastAlerts = this.alerts.filter(a => a.type === 'sast');
        const byFile = {};

        sastAlerts.forEach(alert => {
            if (!byFile[alert.file]) {
                byFile[alert.file] = [];
            }
            byFile[alert.file].push({
                rule: alert.rule,
                line: alert.line,
                severity: alert.severity,
                cwe_ids: alert.cwe_ids,
            });
        });

        return Object.entries(byFile).map(([file, issues]) => ({
            file,
            issue_count: issues.length,
            issues,
        }));
    }

    /**
     * Detect exposed secrets
     * @returns {Array} Exposed secrets
     */
    getExposedSecrets() {
        return this.secrets.filter(s => s.state === 'detected' || s.state === 'exposed');
    }

    /**
     * Create security incident ticket
     * @param {Object} alert - Security alert
     * @returns {Object} Incident ticket
     */
    createIncidentTicket(alert) {
        let title = '';
        let description = '';

        if (alert.type === 'dependabot') {
            title = `[${alert.severity}] CVE: ${alert.cve} in ${alert.package}@${alert.current_version}`;
            description = `Vulnerability in dependency: ${alert.description}\nPatch available in: ${alert.patched_version}`;
        } else if (alert.type === 'sast') {
            title = `[${alert.severity}] ${alert.rule} in ${alert.file}`;
            description = `Code quality issue at line ${alert.line}\nMessage: ${alert.message}\nCWE: ${alert.cwe_ids.join(', ')}`;
        } else if (alert.type === 'secret_scanning') {
            title = `[Critical] Exposed secret: ${alert.secret_type}`;
            description = `Detected in file ${alert.file} at line ${alert.line}. Immediate remediation required.`;
        }

        return {
            title,
            description,
            severity: alert.severity,
            type: alert.type,
            priority: alert.severity === 'Critical' ? 'P0' : alert.severity === 'Normal' ? 'P1' : 'P2',
        };
    }

    /**
     * Filter alerts by criteria
     * @param {Object} criteria - Filter criteria
     * @returns {Array} Filtered alerts
     */
    filterAlerts(criteria) {
        return this.alerts.filter(a => {
            if (criteria.type && a.type !== criteria.type) return false;
            if (criteria.severity && a.severity !== criteria.severity) return false;
            if (criteria.state && a.state !== criteria.state) return false;
            if (criteria.file && a.file && !a.file.includes(criteria.file)) return false;
            return true;
        });
    }
}

module.exports = SecurityAnalyzer;
