const sql = require('mssql');
const logger = require('../utils/logger');

/**
 * DbNex - ExtractorService
 * Extracts complete database schema from a Microsoft SQL Server instance.
 * Ported and enhanced from the original C# DatabaseExtractorService.
 * 
 * Vendor: Vayunex Solution
 */
class ExtractorService {
  /**
   * Builds an mssql config object from project config
   */
  static buildSqlConfig(config) {
    return {
      server: config.host,
      port: config.port || 1433,
      database: config.database,
      user: config.username,
      password: config.password,
      options: {
        encrypt: config.encryptConnection || false,
        trustServerCertificate: config.trustServerCert !== false,
        requestTimeout: 60000,
        connectionTimeout: 30000,
      },
    };
  }

  /**
   * Main entry point: Extract full schema from a SQL Server database.
   * @param {object} config - { host, port, database, username, password, encryptConnection, trustServerCert }
   * @returns {DatabaseSchema}
   */
  async extractSchema(config) {
    let pool;
    try {
      pool = await sql.connect(ExtractorService.buildSqlConfig(config));
      logger.info(`[Extractor] Connected to ${config.host}\\${config.database}`);

      const schema = {
        serverName: config.host,
        databaseName: config.database,
        tables: {},
        views: {},
        procedures: {},
        functions: {},
        triggers: {},
        primaryKeys: {},
        foreignKeys: {},
        indexes: {},
      };

      const recentModifiers = await this._getRecentModifiers(pool);

      await Promise.all([
        this._extractTables(pool, schema, recentModifiers),
        this._extractModules(pool, schema, recentModifiers),
        this._extractPrimaryKeys(pool, schema),
        this._extractForeignKeys(pool, schema),
        this._extractIndexes(pool, schema),
        this._extractTriggers(pool, schema, recentModifiers),
      ]);

      logger.info(`[Extractor] Schema extraction complete for ${config.database}`);
      return schema;

    } finally {
      if (pool) {
        try { await pool.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * Tests a database connection without full extraction.
   */
  async testConnection(config) {
    let pool;
    try {
      pool = await sql.connect(ExtractorService.buildSqlConfig(config));
      const result = await pool.request().query('SELECT @@SERVERNAME AS ServerName, DB_NAME() AS DatabaseName, @@VERSION AS Version');
      return {
        success: true,
        serverName: result.recordset[0]?.ServerName,
        databaseName: result.recordset[0]?.DatabaseName,
        version: result.recordset[0]?.Version?.split('\n')[0],
      };
    } finally {
      if (pool) {
        try { await pool.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  // ─────────────────────────────────────────────
  // Private Extraction Methods
  // ─────────────────────────────────────────────

  async _getRecentModifiers(pool) {
    const dict = {};
    try {
      const sql_query = `
        DECLARE @TracePath NVARCHAR(256);
        SELECT TOP 1 @TracePath = CONVERT(NVARCHAR(256), value) 
        FROM sys.fn_trace_getinfo(NULL) 
        WHERE property = 2 AND value IS NOT NULL;

        IF @TracePath IS NOT NULL
        BEGIN
          SELECT ObjectName, HostName, LoginName
          FROM (
            SELECT 
              ObjectName, HostName, LoginName,
              ROW_NUMBER() OVER (PARTITION BY ObjectName ORDER BY StartTime DESC) as rn
            FROM sys.fn_trace_gettable(@TracePath, DEFAULT)
            WHERE EventClass IN (46, 47, 164)
              AND DatabaseID = DB_ID()
              AND ObjectName IS NOT NULL
          ) t
          WHERE rn = 1
        END
      `;
      const result = await pool.request().query(sql_query);
      for (const row of result.recordset || []) {
        if (row.ObjectName) {
          dict[row.ObjectName] = { hostName: row.HostName, loginName: row.LoginName };
        }
      }
    } catch (e) {
      // Trace may be disabled or insufficient permissions — non-fatal
      logger.debug('[Extractor] Could not fetch trace modifiers (non-fatal):', e.message);
    }
    return dict;
  }

  async _extractTables(pool, schema, recentModifiers) {
    const query = `
      SELECT 
        c.TABLE_SCHEMA,
        c.TABLE_NAME,
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE,
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT,
        c.ORDINAL_POSITION,
        c.COLLATION_NAME,
        t.create_date,
        t.modify_date,
        p.name AS author_name
      FROM INFORMATION_SCHEMA.COLUMNS c
      INNER JOIN sys.tables t ON t.name = c.TABLE_NAME AND SCHEMA_NAME(t.schema_id) = c.TABLE_SCHEMA
      LEFT JOIN sys.schemas s ON s.schema_id = t.schema_id
      LEFT JOIN sys.database_principals p ON ISNULL(t.principal_id, s.principal_id) = p.principal_id
      ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
    `;

    const result = await pool.request().query(query);
    for (const row of result.recordset) {
      const fullName = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;

      if (!schema.tables[fullName]) {
        const modifier = recentModifiers[row.TABLE_NAME] || {};
        let author = row.author_name || '';
        if (modifier.loginName) author = modifier.loginName;
        if (modifier.hostName) author = `${author} (System: ${modifier.hostName})`.trim();

        schema.tables[fullName] = {
          fullName,
          schema: row.TABLE_SCHEMA,
          name: row.TABLE_NAME,
          createDate: row.create_date,
          modifyDate: row.modify_date,
          author,
          columns: {},
          columnsList: [],
        };
      }

      const colName = row.COLUMN_NAME;
      if (!schema.tables[fullName].columns[colName]) {
        let maxLength = '';
        if (row.CHARACTER_MAXIMUM_LENGTH != null) {
          maxLength = row.CHARACTER_MAXIMUM_LENGTH === -1 ? 'max' : String(row.CHARACTER_MAXIMUM_LENGTH);
        }

        const col = {
          name: colName,
          dataType: row.DATA_TYPE,
          maxLength,
          numericPrecision: row.NUMERIC_PRECISION,
          numericScale: row.NUMERIC_SCALE,
          isNullable: row.IS_NULLABLE === 'YES',
          defaultValue: row.COLUMN_DEFAULT,
          collationName: row.COLLATION_NAME,
          ordinalPosition: row.ORDINAL_POSITION,
        };

        schema.tables[fullName].columns[colName] = col;
        schema.tables[fullName].columnsList.push(col);
      }
    }
  }

  async _extractModules(pool, schema, recentModifiers) {
    const query = `
      SELECT 
        s.name AS schema_name,
        o.name AS object_name,
        o.type_desc,
        m.definition,
        o.create_date,
        o.modify_date,
        p.name AS author_name
      FROM sys.sql_modules m
      INNER JOIN sys.objects o ON m.object_id = o.object_id
      INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
      LEFT JOIN sys.database_principals p ON ISNULL(o.principal_id, s.principal_id) = p.principal_id
      WHERE o.type IN ('V', 'P', 'FN', 'IF', 'TF')
    `;

    const result = await pool.request().query(query);
    for (const row of result.recordset) {
      const fullName = `${row.schema_name}.${row.object_name}`;
      const typeDesc = (row.type_desc || '').trim();

      const modifier = recentModifiers[row.object_name] || {};
      let author = row.author_name || '';
      if (modifier.loginName) author = modifier.loginName;
      if (modifier.hostName) author = `${author} (System: ${modifier.hostName})`.trim();

      const mod = {
        fullName,
        definition: (row.definition || '').trim(),
        createDate: row.create_date,
        modifyDate: row.modify_date,
        author,
      };

      if (typeDesc === 'VIEW') schema.views[fullName] = mod;
      else if (typeDesc === 'SQL_STORED_PROCEDURE') schema.procedures[fullName] = mod;
      else if (['SQL_SCALAR_FUNCTION', 'SQL_INLINE_TABLE_VALUED_FUNCTION', 'SQL_TABLE_VALUED_FUNCTION'].includes(typeDesc)) {
        schema.functions[fullName] = mod;
      }
    }
  }

  async _extractPrimaryKeys(pool, schema) {
    const query = `
      SELECT 
        tc.TABLE_SCHEMA,
        tc.TABLE_NAME,
        tc.CONSTRAINT_NAME,
        kcu.COLUMN_NAME,
        kcu.ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        AND tc.TABLE_NAME = kcu.TABLE_NAME
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ORDER BY tc.TABLE_SCHEMA, tc.TABLE_NAME, kcu.ORDINAL_POSITION
    `;
    const result = await pool.request().query(query);
    for (const row of result.recordset) {
      const tableKey = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
      if (!schema.primaryKeys[tableKey]) {
        schema.primaryKeys[tableKey] = { constraintName: row.CONSTRAINT_NAME, columns: [] };
      }
      schema.primaryKeys[tableKey].columns.push(row.COLUMN_NAME);
    }
  }

  async _extractForeignKeys(pool, schema) {
    const query = `
      SELECT 
        fk.name AS FK_NAME,
        SCHEMA_NAME(fk_tab.schema_id) AS FK_SCHEMA,
        fk_tab.name AS FK_TABLE,
        fk_col.name AS FK_COLUMN,
        SCHEMA_NAME(pk_tab.schema_id) AS PK_SCHEMA,
        pk_tab.name AS PK_TABLE,
        pk_col.name AS PK_COLUMN,
        fk.delete_referential_action_desc AS ON_DELETE,
        fk.update_referential_action_desc AS ON_UPDATE
      FROM sys.foreign_keys fk
      INNER JOIN sys.tables fk_tab ON fk.parent_object_id = fk_tab.object_id
      INNER JOIN sys.tables pk_tab ON fk.referenced_object_id = pk_tab.object_id
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.columns fk_col ON fkc.parent_object_id = fk_col.object_id AND fkc.parent_column_id = fk_col.column_id
      INNER JOIN sys.columns pk_col ON fkc.referenced_object_id = pk_col.object_id AND fkc.referenced_column_id = pk_col.column_id
      ORDER BY FK_SCHEMA, FK_TABLE
    `;
    const result = await pool.request().query(query);
    for (const row of result.recordset) {
      const tableKey = `${row.FK_SCHEMA}.${row.FK_TABLE}`;
      if (!schema.foreignKeys[tableKey]) schema.foreignKeys[tableKey] = [];
      schema.foreignKeys[tableKey].push({
        constraintName: row.FK_NAME,
        column: row.FK_COLUMN,
        referencedTable: `${row.PK_SCHEMA}.${row.PK_TABLE}`,
        referencedColumn: row.PK_COLUMN,
        onDelete: row.ON_DELETE,
        onUpdate: row.ON_UPDATE,
      });
    }
  }

  async _extractIndexes(pool, schema) {
    const query = `
      SELECT 
        SCHEMA_NAME(t.schema_id) AS TABLE_SCHEMA,
        t.name AS TABLE_NAME,
        i.name AS INDEX_NAME,
        i.type_desc AS INDEX_TYPE,
        i.is_unique,
        i.is_primary_key,
        STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS COLUMNS
      FROM sys.indexes i
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.name IS NOT NULL AND i.is_primary_key = 0
      GROUP BY SCHEMA_NAME(t.schema_id), t.name, i.name, i.type_desc, i.is_unique, i.is_primary_key
    `;
    try {
      const result = await pool.request().query(query);
      for (const row of result.recordset) {
        const tableKey = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
        if (!schema.indexes[tableKey]) schema.indexes[tableKey] = [];
        schema.indexes[tableKey].push({
          indexName: row.INDEX_NAME,
          indexType: row.INDEX_TYPE,
          isUnique: row.is_unique,
          columns: row.COLUMNS,
        });
      }
    } catch (e) {
      // STRING_AGG requires SQL Server 2017+; graceful fallback
      logger.debug('[Extractor] Index extraction skipped (may need SQL Server 2017+):', e.message);
    }
  }

  async _extractTriggers(pool, schema, recentModifiers) {
    const query = `
      SELECT 
        SCHEMA_NAME(t.schema_id) AS TABLE_SCHEMA,
        t.name AS TABLE_NAME,
        tr.name AS TRIGGER_NAME,
        m.definition,
        tr.is_disabled,
        tr.create_date,
        tr.modify_date
      FROM sys.triggers tr
      INNER JOIN sys.tables t ON tr.parent_id = t.object_id
      INNER JOIN sys.sql_modules m ON tr.object_id = m.object_id
    `;
    const result = await pool.request().query(query);
    for (const row of result.recordset) {
      const tableKey = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
      if (!schema.triggers[tableKey]) schema.triggers[tableKey] = [];
      schema.triggers[tableKey].push({
        name: row.TRIGGER_NAME,
        definition: (row.definition || '').trim(),
        isDisabled: row.is_disabled,
        createDate: row.create_date,
        modifyDate: row.modify_date,
      });
    }
  }
}

module.exports = new ExtractorService();
