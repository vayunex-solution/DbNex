/**
 * DbNex - RiskAnalyzerService
 * Analyzes a T-SQL script and classifies the risk level of each operation.
 * 
 * Vendor: Vayunex Solution
 */

const HIGH_RISK_PATTERNS = [
  { pattern: /\bDROP\s+TABLE\b/gi, type: 'DROP_TABLE', message: 'Drops an entire table and all its data permanently.' },
  { pattern: /\bDROP\s+DATABASE\b/gi, type: 'DROP_DATABASE', message: 'Drops an entire database — catastrophic and irreversible.' },
  { pattern: /\bTRUNCATE\s+TABLE\b/gi, type: 'TRUNCATE_TABLE', message: 'Removes all rows from a table. Cannot be rolled back without a transaction.' },
  { pattern: /\bDROP\s+SCHEMA\b/gi, type: 'DROP_SCHEMA', message: 'Drops a schema and all objects within it.' },
];

const MEDIUM_RISK_PATTERNS = [
  { pattern: /\bALTER\s+TABLE\b.*?\bDROP\s+COLUMN\b/gis, type: 'DROP_COLUMN', message: 'Removes a column. Data in this column will be permanently lost.' },
  { pattern: /\bALTER\s+TABLE\b.*?\bALTER\s+COLUMN\b/gis, type: 'ALTER_COLUMN', message: 'Changes column definition. May cause data truncation or implicit conversion.' },
  { pattern: /\bDROP\s+INDEX\b/gi, type: 'DROP_INDEX', message: 'Removes an index. May affect query performance.' },
  { pattern: /\bDROP\s+CONSTRAINT\b/gi, type: 'DROP_CONSTRAINT', message: 'Removes a constraint. May affect data integrity.' },
  { pattern: /\bDROP\s+VIEW\b/gi, type: 'DROP_VIEW', message: 'Removes a view. Applications depending on it will break.' },
  { pattern: /\bDROP\s+PROCEDURE\b/gi, type: 'DROP_PROCEDURE', message: 'Removes a stored procedure.' },
  { pattern: /\bDROP\s+FUNCTION\b/gi, type: 'DROP_FUNCTION', message: 'Removes a function.' },
  { pattern: /\bDROP\s+TRIGGER\b/gi, type: 'DROP_TRIGGER', message: 'Removes a trigger. Business logic associated will be lost.' },
];

const LOW_RISK_PATTERNS = [
  { pattern: /\bCREATE\s+TABLE\b/gi, type: 'CREATE_TABLE', message: 'Creates a new table. Safe to execute.' },
  { pattern: /\bALTER\s+TABLE\b.*?\bADD\b/gis, type: 'ADD_COLUMN', message: 'Adds a new column to a table. Safe to execute.' },
  { pattern: /\bCREATE\s+INDEX\b/gi, type: 'CREATE_INDEX', message: 'Creates a new index. Safe to execute.' },
  { pattern: /\bCREATE\s+VIEW\b/gi, type: 'CREATE_VIEW', message: 'Creates or replaces a view. Safe to execute.' },
  { pattern: /\bCREATE\s+PROCEDURE\b/gi, type: 'CREATE_PROCEDURE', message: 'Creates a stored procedure. Safe to execute.' },
  { pattern: /\bCREATE\s+FUNCTION\b/gi, type: 'CREATE_FUNCTION', message: 'Creates a function. Safe to execute.' },
  { pattern: /\bALTER\s+PROCEDURE\b/gi, type: 'ALTER_PROCEDURE', message: 'Modifies a stored procedure.' },
  { pattern: /\bALTER\s+VIEW\b/gi, type: 'ALTER_VIEW', message: 'Modifies a view definition.' },
  { pattern: /\bALTER\s+FUNCTION\b/gi, type: 'ALTER_FUNCTION', message: 'Modifies a function definition.' },
];

class RiskAnalyzerService {
  /**
   * Analyzes a full SQL script and returns a detailed risk report.
   * @param {string} scriptSql - The T-SQL script to analyze
   * @returns {RiskReport}
   */
  analyze(scriptSql) {
    if (!scriptSql || !scriptSql.trim()) {
      return {
        overallRisk: 'LOW',
        riskScore: 0,
        detectedItems: [],
        requiresConfirmation: false,
        summary: 'Empty script — no risk detected.',
      };
    }

    const detectedItems = [];

    // Check high risk
    for (const p of HIGH_RISK_PATTERNS) {
      const matches = scriptSql.match(p.pattern);
      if (matches) {
        detectedItems.push({
          riskLevel: 'HIGH',
          type: p.type,
          count: matches.length,
          message: p.message,
        });
      }
    }

    // Check medium risk
    for (const p of MEDIUM_RISK_PATTERNS) {
      p.pattern.lastIndex = 0;
      const matches = scriptSql.match(p.pattern);
      if (matches) {
        detectedItems.push({
          riskLevel: 'MEDIUM',
          type: p.type,
          count: matches.length,
          message: p.message,
        });
      }
    }

    // Check low risk
    for (const p of LOW_RISK_PATTERNS) {
      p.pattern.lastIndex = 0;
      const matches = scriptSql.match(p.pattern);
      if (matches) {
        detectedItems.push({
          riskLevel: 'LOW',
          type: p.type,
          count: matches.length,
          message: p.message,
        });
      }
    }

    // Calculate overall risk
    const hasHigh = detectedItems.some(i => i.riskLevel === 'HIGH');
    const hasMedium = detectedItems.some(i => i.riskLevel === 'MEDIUM');
    
    let overallRisk = 'LOW';
    let riskScore = 0;
    let requiresConfirmation = false;

    if (hasHigh) {
      overallRisk = 'HIGH';
      riskScore = detectedItems.filter(i => i.riskLevel === 'HIGH').reduce((a, b) => a + b.count * 10, 0);
      requiresConfirmation = true;
    } else if (hasMedium) {
      overallRisk = 'MEDIUM';
      riskScore = detectedItems.filter(i => i.riskLevel === 'MEDIUM').reduce((a, b) => a + b.count * 5, 0);
      requiresConfirmation = true;
    } else {
      riskScore = detectedItems.reduce((a, b) => a + b.count, 0);
    }

    const summary = this._buildSummary(overallRisk, detectedItems);

    return {
      overallRisk,
      riskScore,
      detectedItems,
      requiresConfirmation,
      summary,
    };
  }

  _buildSummary(overallRisk, items) {
    const high = items.filter(i => i.riskLevel === 'HIGH');
    const medium = items.filter(i => i.riskLevel === 'MEDIUM');
    const low = items.filter(i => i.riskLevel === 'LOW');

    const parts = [];
    if (high.length) parts.push(`⛔ ${high.length} HIGH risk operation(s) detected (e.g., ${high.map(h => h.type).join(', ')})`);
    if (medium.length) parts.push(`⚠️ ${medium.length} MEDIUM risk operation(s) detected`);
    if (low.length) parts.push(`✅ ${low.length} LOW risk operation(s)`);

    return parts.join('. ') || 'No operations detected.';
  }
}

module.exports = new RiskAnalyzerService();
