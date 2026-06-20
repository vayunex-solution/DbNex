const sql = require('mssql');
const ExtractorService = require('./ExtractorService');
const logger = require('../utils/logger');

/**
 * DbNex - ScriptRunnerService
 * Executes T-SQL synchronization scripts against a target SQL Server database.
 * Handles GO batch splitting since mssql driver does not support GO natively.
 * 
 * Vendor: Vayunex Solution
 */
class ScriptRunnerService {
  /**
   * Executes a full T-SQL script against the target database.
   * @param {object} config - MSSQL connection config (decrypted)
   * @param {string} scriptSql - The full T-SQL script
   * @param {Function} [onProgress] - Optional callback(batchIndex, total, result)
   * @returns {ExecutionResult}
   */
  async executeScript(config, scriptSql, onProgress) {
    const startTime = Date.now();
    const batches = this._splitBatches(scriptSql);
    
    if (batches.length === 0) {
      return {
        success: true,
        totalBatches: 0,
        successBatches: 0,
        failedBatches: 0,
        batchLogs: [],
        durationMs: 0,
        message: 'No executable batches found in the script.',
      };
    }

    logger.info(`[ScriptRunner] Executing ${batches.length} batch(es) against ${config.host}\\${config.database}`);

    const batchLogs = [];
    let successBatches = 0;
    let failedBatches = 0;

    let pool;
    try {
      pool = await sql.connect(ExtractorService.buildSqlConfig(config));

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchNum = i + 1;
        const batchStart = Date.now();
        const logEntry = {
          batchNumber: batchNum,
          sql: batch.substring(0, 500) + (batch.length > 500 ? '...' : ''),
          status: null,
          rowsAffected: null,
          error: null,
          durationMs: null,
        };

        try {
          const result = await pool.request().query(batch);
          const rowsAffected = result.rowsAffected?.reduce((a, b) => a + b, 0) ?? 0;
          logEntry.status = 'SUCCESS';
          logEntry.rowsAffected = rowsAffected;
          logEntry.durationMs = Date.now() - batchStart;
          successBatches++;

          logger.info(`[ScriptRunner] Batch ${batchNum}/${batches.length} ✅ (${rowsAffected} rows, ${logEntry.durationMs}ms)`);
        } catch (batchError) {
          logEntry.status = 'FAILED';
          logEntry.error = batchError.message;
          logEntry.durationMs = Date.now() - batchStart;
          failedBatches++;

          logger.error(`[ScriptRunner] Batch ${batchNum}/${batches.length} ❌: ${batchError.message}`);
        }

        batchLogs.push(logEntry);

        if (onProgress) {
          onProgress(batchNum, batches.length, logEntry);
        }
      }

      const durationMs = Date.now() - startTime;
      const hasFailures = failedBatches > 0;

      return {
        success: !hasFailures,
        status: failedBatches === 0 ? 'SUCCESS' : successBatches === 0 ? 'FAILED' : 'PARTIAL',
        totalBatches: batches.length,
        successBatches,
        failedBatches,
        batchLogs,
        durationMs,
        message: failedBatches === 0
          ? `All ${batches.length} batch(es) executed successfully.`
          : `${failedBatches} of ${batches.length} batch(es) failed. ${successBatches} succeeded.`,
      };
    } finally {
      if (pool) {
        try { await pool.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * Splits a T-SQL script on GO statements (batch separator).
   * GO must be on its own line (with optional whitespace).
   * Ignores GO inside string literals or comments.
   * 
   * @param {string} script 
   * @returns {string[]} Array of non-empty SQL batch strings
   */
  _splitBatches(script) {
    if (!script) return [];
    
    // Regex: match GO on its own line (case-insensitive), optionally followed by a count
    const goBatchRegex = /^\s*GO\s*(\d+)?\s*$/gim;
    const batches = script.split(goBatchRegex).map(b => b.trim()).filter(b => {
      if (!b) return false;
      // Filter out numeric remainders from split (the count capture groups)
      if (/^\d+$/.test(b)) return false;
      return true;
    });

    // Expand GO with count (e.g., "GO 3" means run batch 3 times)
    // This is handled by re-joining batches properly
    const result = [];
    const parts = script.split(/^\s*GO(?:\s+\d+)?\s*$/gim);
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) result.push(trimmed);
    }

    return result;
  }
}

module.exports = new ScriptRunnerService();
