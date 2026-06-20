const Diff = require('diff');

/**
 * DbNex - ComparatorService
 * Compares two extracted DatabaseSchema objects and produces CompareResult items.
 * 
 * Vendor: Vayunex Solution
 */
class ComparatorService {
  /**
   * Full comparison of two database schemas.
   * @param {object} sourceSchema - From ExtractorService.extractSchema()
   * @param {object} destSchema   - From ExtractorService.extractSchema()
   * @returns {CompareReport}
   */
  compare(sourceSchema, destSchema) {
    const results = [];

    this._compareTables(sourceSchema, destSchema, results);
    this._compareModules('View', sourceSchema.views, destSchema.views, results);
    this._compareModules('Procedure', sourceSchema.procedures, destSchema.procedures, results);
    this._compareModules('Function', sourceSchema.functions, destSchema.functions, results);
    this._compareTriggers(sourceSchema.triggers, destSchema.triggers, results);
    this._compareIndexes(sourceSchema.indexes, destSchema.indexes, results);

    const summary = this._buildSummary(results, sourceSchema, destSchema);

    return { summary, results };
  }

  // ─────────────────────────────────────────────
  // Table Comparison
  // ─────────────────────────────────────────────

  _compareTables(sourceSchema, destSchema, results) {
    const srcTables = sourceSchema.tables;
    const dstTables = destSchema.tables;
    const allKeys = new Set([...Object.keys(srcTables), ...Object.keys(dstTables)]);

    for (const key of allKeys) {
      const srcTable = srcTables[key];
      const dstTable = dstTables[key];

      if (!srcTable) {
        results.push({
          category: 'Table',
          objectName: key,
          status: 'Missing in Source',
          riskLevel: 'HIGH',
          alterScriptSql: `-- Table exists in Destination but not in Source\n-- DROP TABLE ${key}; -- Uncomment if you want to remove it`,
          sourceInfo: null,
          destInfo: this._tableInfo(dstTable),
        });
      } else if (!dstTable) {
        results.push({
          category: 'Table',
          objectName: key,
          status: 'Missing in Destination',
          riskLevel: 'MEDIUM',
          alterScriptSql: this._generateCreateTableScript(srcTable),
          sourceInfo: this._tableInfo(srcTable),
          destInfo: null,
        });
      } else {
        // Both exist - compare columns
        const columnDiffs = this._compareColumns(srcTable, dstTable);
        if (columnDiffs.length > 0) {
          const alterScript = columnDiffs.map(d => d.sql).join('\nGO\n') + '\nGO';
          results.push({
            category: 'Table',
            objectName: key,
            status: 'Different',
            riskLevel: this._assessTableRisk(columnDiffs),
            alterScriptSql: alterScript,
            columnDiffs,
            sourceInfo: this._tableInfo(srcTable),
            destInfo: this._tableInfo(dstTable),
          });
        }
      }
    }
  }

  _compareColumns(srcTable, dstTable) {
    const diffs = [];
    const allCols = new Set([
      ...Object.keys(srcTable.columns),
      ...Object.keys(dstTable.columns),
    ]);

    for (const colName of allCols) {
      const srcCol = srcTable.columns[colName];
      const dstCol = dstTable.columns[colName];

      if (!srcCol) {
        diffs.push({
          type: 'DROP_COLUMN',
          columnName: colName,
          riskLevel: 'HIGH',
          sql: `ALTER TABLE ${srcTable.fullName} DROP COLUMN ${colName};`,
          description: `Column "${colName}" exists in Destination but not in Source`,
        });
      } else if (!dstCol) {
        diffs.push({
          type: 'ADD_COLUMN',
          columnName: colName,
          riskLevel: 'LOW',
          sql: `ALTER TABLE ${srcTable.fullName} ADD ${this._columnDDL(srcCol)};`,
          description: `Column "${colName}" is missing in Destination`,
        });
      } else {
        const changes = this._detectColumnChanges(srcCol, dstCol);
        if (changes.length > 0) {
          diffs.push({
            type: 'MODIFY_COLUMN',
            columnName: colName,
            riskLevel: 'MEDIUM',
            changes,
            sql: `ALTER TABLE ${srcTable.fullName} ALTER COLUMN ${this._columnDDL(srcCol)};`,
            description: `Column "${colName}" definition differs: ${changes.join(', ')}`,
          });
        }
      }
    }
    return diffs;
  }

  _detectColumnChanges(srcCol, dstCol) {
    const changes = [];
    if (srcCol.dataType !== dstCol.dataType) changes.push(`type: ${dstCol.dataType} → ${srcCol.dataType}`);
    if (srcCol.maxLength !== dstCol.maxLength) changes.push(`length: ${dstCol.maxLength || 'n/a'} → ${srcCol.maxLength || 'n/a'}`);
    if (srcCol.isNullable !== dstCol.isNullable) changes.push(`nullable: ${dstCol.isNullable} → ${srcCol.isNullable}`);
    if (srcCol.defaultValue !== dstCol.defaultValue) changes.push(`default changed`);
    return changes;
  }

  _columnDDL(col) {
    let type = col.dataType.toUpperCase();
    if (col.maxLength) {
      type += `(${col.maxLength})`;
    } else if (col.numericPrecision != null && ['DECIMAL', 'NUMERIC'].includes(col.dataType.toUpperCase())) {
      type += `(${col.numericPrecision},${col.numericScale ?? 0})`;
    }
    const nullable = col.isNullable ? 'NULL' : 'NOT NULL';
    const def = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
    return `[${col.name}] ${type} ${nullable}${def}`;
  }

  _generateCreateTableScript(table) {
    const cols = table.columnsList.map(c => `    ${this._columnDDL(c)}`).join(',\n');
    return `CREATE TABLE ${table.fullName} (\n${cols}\n);\nGO`;
  }

  _tableInfo(table) {
    if (!table) return null;
    return {
      createDate: table.createDate,
      modifyDate: table.modifyDate,
      author: table.author,
      columnCount: table.columnsList?.length || 0,
    };
  }

  _assessTableRisk(columnDiffs) {
    if (columnDiffs.some(d => d.riskLevel === 'HIGH')) return 'HIGH';
    if (columnDiffs.some(d => d.riskLevel === 'MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  // ─────────────────────────────────────────────
  // Module Comparison (Views / Procedures / Functions)
  // ─────────────────────────────────────────────

  _compareModules(category, srcDict, dstDict, results) {
    const allKeys = new Set([...Object.keys(srcDict), ...Object.keys(dstDict)]);

    for (const key of allKeys) {
      const srcVal = srcDict[key];
      const dstVal = dstDict[key];

      if (!srcVal) {
        results.push({
          category,
          objectName: key,
          status: 'Missing in Source',
          riskLevel: 'MEDIUM',
          alterScriptSql: `-- ${category} exists in Destination but not in Source\n-- DROP ${category.toUpperCase()} ${key};`,
          sourceInfo: null,
          destInfo: { createDate: dstVal.createDate, modifyDate: dstVal.modifyDate, author: dstVal.author },
        });
      } else if (!dstVal) {
        results.push({
          category,
          objectName: key,
          status: 'Missing in Destination',
          riskLevel: 'LOW',
          alterScriptSql: srcVal.definition,
          sourceInfo: { createDate: srcVal.createDate, modifyDate: srcVal.modifyDate, author: srcVal.author },
          destInfo: null,
        });
      } else {
        const srcNorm = this._normalize(srcVal.definition);
        const dstNorm = this._normalize(dstVal.definition);

        if (srcNorm !== dstNorm) {
          const diffResult = this._generateDiff(dstVal.definition, srcVal.definition);
          results.push({
            category,
            objectName: key,
            status: 'Different',
            riskLevel: 'MEDIUM',
            alterScriptSql: this._convertToAlter(srcVal.definition),
            diffResult,
            sourceInfo: { createDate: srcVal.createDate, modifyDate: srcVal.modifyDate, author: srcVal.author },
            destInfo: { createDate: dstVal.createDate, modifyDate: dstVal.modifyDate, author: dstVal.author },
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // Triggers & Indexes
  // ─────────────────────────────────────────────

  _compareTriggers(srcTriggers, dstTriggers, results) {
    const allTables = new Set([...Object.keys(srcTriggers), ...Object.keys(dstTriggers)]);
    for (const table of allTables) {
      const srcList = srcTriggers[table] || [];
      const dstList = dstTriggers[table] || [];
      const srcMap = Object.fromEntries(srcList.map(t => [t.name, t]));
      const dstMap = Object.fromEntries(dstList.map(t => [t.name, t]));
      const allNames = new Set([...Object.keys(srcMap), ...Object.keys(dstMap)]);

      for (const name of allNames) {
        const src = srcMap[name];
        const dst = dstMap[name];
        if (!src) {
          results.push({ category: 'Trigger', objectName: `${table}.${name}`, status: 'Missing in Source', riskLevel: 'LOW', alterScriptSql: `-- Trigger exists in Destination: ${name}` });
        } else if (!dst) {
          results.push({ category: 'Trigger', objectName: `${table}.${name}`, status: 'Missing in Destination', riskLevel: 'LOW', alterScriptSql: src.definition });
        } else if (this._normalize(src.definition) !== this._normalize(dst.definition)) {
          results.push({ category: 'Trigger', objectName: `${table}.${name}`, status: 'Different', riskLevel: 'LOW', alterScriptSql: this._convertToAlter(src.definition), diffResult: this._generateDiff(dst.definition, src.definition) });
        }
      }
    }
  }

  _compareIndexes(srcIndexes, dstIndexes, results) {
    const allTables = new Set([...Object.keys(srcIndexes), ...Object.keys(dstIndexes)]);
    for (const table of allTables) {
      const srcList = srcIndexes[table] || [];
      const dstList = dstIndexes[table] || [];
      const srcMap = Object.fromEntries(srcList.map(i => [i.indexName, i]));
      const dstMap = Object.fromEntries(dstList.map(i => [i.indexName, i]));
      const allNames = new Set([...Object.keys(srcMap), ...Object.keys(dstMap)]);

      for (const name of allNames) {
        const src = srcMap[name];
        const dst = dstMap[name];
        if (!src) {
          results.push({ category: 'Index', objectName: `${table}.${name}`, status: 'Missing in Source', riskLevel: 'LOW', alterScriptSql: `DROP INDEX ${name} ON ${table};\nGO` });
        } else if (!dst) {
          const unique = src.isUnique ? 'UNIQUE ' : '';
          results.push({ category: 'Index', objectName: `${table}.${name}`, status: 'Missing in Destination', riskLevel: 'LOW', alterScriptSql: `CREATE ${unique}INDEX ${name} ON ${table} (${src.columns});\nGO` });
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // Diff Generation
  // ─────────────────────────────────────────────

  _normalize(sql) {
    if (!sql) return '';
    return sql
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\b(CREATE|ALTER)\b/i, 'CREATE')
      .trim();
  }

  _convertToAlter(ddl) {
    return (ddl || '').replace(/\bCREATE\b/i, 'ALTER');
  }

  _generateDiff(oldText, newText) {
    const changes = Diff.diffLines(oldText || '', newText || '', { ignoreWhitespace: false });
    return changes.map(part => ({
      type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
      value: part.value,
      count: part.count,
    }));
  }

  // ─────────────────────────────────────────────
  // Summary Builder
  // ─────────────────────────────────────────────

  _buildSummary(results, sourceSchema, destSchema) {
    const byCategory = {};
    let totalDifferences = 0;
    let highRisk = 0, mediumRisk = 0, lowRisk = 0;

    for (const r of results) {
      if (!byCategory[r.category]) byCategory[r.category] = { added: 0, missing: 0, different: 0, total: 0 };
      totalDifferences++;
      byCategory[r.category].total++;

      if (r.status === 'Missing in Destination') byCategory[r.category].missing++;
      else if (r.status === 'Missing in Source') byCategory[r.category].added++;
      else byCategory[r.category].different++;

      if (r.riskLevel === 'HIGH') highRisk++;
      else if (r.riskLevel === 'MEDIUM') mediumRisk++;
      else lowRisk++;
    }

    let overallRisk = 'LOW';
    if (highRisk > 0) overallRisk = 'HIGH';
    else if (mediumRisk > 0) overallRisk = 'MEDIUM';

    return {
      sourceDatabaseName: sourceSchema.databaseName,
      sourceServerName: sourceSchema.serverName,
      destDatabaseName: destSchema.databaseName,
      destServerName: destSchema.serverName,
      totalDifferences,
      overallRisk,
      riskBreakdown: { high: highRisk, medium: mediumRisk, low: lowRisk },
      byCategory,
      tablesAdded: byCategory.Table?.missing || 0,
      tablesModified: byCategory.Table?.different || 0,
      tablesMissing: byCategory.Table?.added || 0,
      viewsChanged: (byCategory.View?.missing || 0) + (byCategory.View?.different || 0) + (byCategory.View?.added || 0),
      proceduresChanged: (byCategory.Procedure?.missing || 0) + (byCategory.Procedure?.different || 0) + (byCategory.Procedure?.added || 0),
      functionsChanged: (byCategory.Function?.missing || 0) + (byCategory.Function?.different || 0) + (byCategory.Function?.added || 0),
    };
  }
}

module.exports = new ComparatorService();
