import { executeSqlQueryApi, getDatabaseSchemaApi } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { escapeHtml } from '../../utils/dom.util.js';
import { formatNumber } from './analytics-format.util.js';
import { SQL_SNIPPETS } from './analytics-sql-snippets.config.js';
import { DatabaseSchemaColumn, DatabaseSchemaResponse, DatabaseSchemaTable, RedisKeyPattern, SqlQueryResult } from './analytics.types.js';

export class AnalyticsSqlStudioManager {
  public activeSchemaDb: 'db_canvas' | 'db_identity' | 'redis' = 'db_identity';
  public isExecutingQuery = false;
  public lastQueryResult: SqlQueryResult | null = null;
  public schemaData: DatabaseSchemaResponse | null = null;
  public schemaFilterQuery = '';

  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async executeSql(): Promise<void> {
    await this.handleExecuteQuery();
  }

  public async loadSchema(force = false): Promise<void> {
    const treeContainer = this.container.querySelector<HTMLElement>('[data-ref="schema-tree-container"]');
    if (treeContainer && (!this.schemaData || force)) {
      treeContainer.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: var(--text-secondary); font-size: 12px;">Cargando esquema de base de datos...</div>';
    }

    try {
      const res = await getDatabaseSchemaApi();
      if (!res.ok || !res.data) {
        if (treeContainer) {
          treeContainer.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: #ef4444; font-size: 12px;">Error al cargar el esquema.</div>';
        }
        return;
      }
      this.schemaData = res.data as DatabaseSchemaResponse;
      this.renderSchemaTree();
      if (force) {
        showToast('Esquema de base de datos actualizado', 'success');
      }
    } catch {
      if (treeContainer) {
        treeContainer.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: #ef4444; font-size: 12px;">Error de conexión al cargar esquema.</div>';
      }
    }
  }

  public renderSchemaTree(): void {
    const treeContainer = this.container.querySelector<HTMLElement>('[data-ref="schema-tree-container"]');
    if (!treeContainer || !this.schemaData) return;

    if (this.activeSchemaDb === 'redis') {
      const patterns: RedisKeyPattern[] = this.schemaData.redisKeys || (this.schemaData as any).redis?.keyPatterns || [];
      const filter = this.schemaFilterQuery;
      const filtered = patterns.filter((p: RedisKeyPattern) => {
        if (!filter) return true;
        const pat = (p.pattern || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const type = (p.type || p.dataStructure || '').toLowerCase();
        return pat.includes(filter) || desc.includes(filter) || type.includes(filter);
      });

      if (filtered.length === 0) {
        treeContainer.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: var(--text-secondary); font-size: 12px;">No se encontraron claves de Redis.</div>';
        return;
      }

      treeContainer.innerHTML = filtered.map((p: RedisKeyPattern) => `
        <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px; flex-shrink: 0; width: 100%; box-sizing: border-box;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <code style="font-family: monospace; font-weight: 700; color: #6366f1; font-size: 12px;">${escapeHtml(p.pattern)}</code>
            <span class="component-badge component-badge--sm" style="font-size: 10px;">${escapeHtml(p.type || p.dataStructure || 'Clave')}</span>
          </div>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 6px 0; line-height: 1.4;">${escapeHtml(p.description)}</p>
          <div style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
            <span>TTL:</span>
            <strong style="color: var(--text-primary);">${escapeHtml(p.ttl)}</strong>
          </div>
        </div>
      `).join('');
      return;
    }

    const dbKey = this.activeSchemaDb;
    let tables: DatabaseSchemaTable[] = [];
    if (Array.isArray(this.schemaData.databases)) {
      const dbObj = this.schemaData.databases.find((d) => d.name === dbKey);
      tables = dbObj?.tables || [];
    } else if (this.schemaData.databases && typeof this.schemaData.databases === 'object') {
      tables = (this.schemaData.databases as any)[dbKey]?.tables || [];
    }

    const filter = this.schemaFilterQuery;

    const filteredTables = tables.filter((t) => {
      if (!filter) return true;
      if (t.tableName.toLowerCase().includes(filter)) return true;
      return t.columns?.some((c) => c.columnName.toLowerCase().includes(filter) || (c.dataType || c.typeFormatted || '').toLowerCase().includes(filter));
    });

    if (filteredTables.length === 0) {
      treeContainer.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: var(--text-secondary); font-size: 12px;">No se encontraron tablas que coincidan con la búsqueda.</div>';
      return;
    }

    treeContainer.innerHTML = filteredTables.map((table) => {
      const colsHtml = (table.columns || []).map((c) => {
        let keyBadge = '';
        if (c.columnKey === 'PRI') {
          keyBadge = '<span class="component-badge component-badge--sm" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; font-size: 9px; padding: 1px 4px;">PK</span>';
        } else if (c.columnKey === 'MUL') {
          keyBadge = '<span class="component-badge component-badge--sm" style="background: rgba(59, 130, 246, 0.12); color: #3b82f6; font-size: 9px; padding: 1px 4px;">IDX</span>';
        } else if (c.columnKey === 'UNI') {
          keyBadge = '<span class="component-badge component-badge--sm" style="background: rgba(16, 185, 129, 0.12); color: #10b981; font-size: 9px; padding: 1px 4px;">UNI</span>';
        }

        const typeStr = c.typeFormatted || c.dataType || '';

        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid var(--border-color); font-size: 11px;">
            <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
              ${keyBadge}
              <span style="font-family: monospace; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(c.columnName)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="color: var(--text-secondary); font-size: 10px;">${escapeHtml(typeStr)}</span>
              <span style="color: var(--text-secondary); font-size: 9px;">${c.isNullable ? 'NULL' : 'NOT NULL'}</span>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="schema-table-item" style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: 8px; flex-shrink: 0; width: 100%; box-sizing: border-box; overflow: hidden;">
          <div data-table-toggle="true" style="padding: 10px 12px; min-height: 42px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; user-select: none; transition: background 0.15s ease;">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
              <svg class="component-icon schema-chevron-icon" style="width: 14px; height: 14px; flex-shrink: 0; color: var(--text-secondary); transition: transform 0.2s ease;" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
              <svg class="component-icon" style="width: 16px; height: 16px; flex-shrink: 0; color: #6366f1;" aria-hidden="true"><use href="/icons.svg#table_chart"></use></svg>
              <strong style="font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(table.tableName)}</strong>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              <span class="component-badge component-badge--sm" style="font-size: 10px;">~${formatNumber(table.estimatedRows)} filas</span>
              <button type="button" class="component-button component-button--sm component-button--ghost" data-action="insert-table-query" data-db="${escapeHtml(dbKey)}" data-table="${escapeHtml(table.tableName)}" data-tooltip="Insertar consulta de muestra" aria-label="Insertar consulta" style="padding: 2px 4px; height: 22px; width: 22px; display: inline-flex; align-items: center; justify-content: center;">
                <svg class="component-icon" style="width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#code"></use></svg>
              </button>
            </div>
          </div>
          <div class="schema-columns-list" style="display: none; max-height: 280px; overflow-y: auto; background: var(--bg-card); border-top: 1px solid var(--border-color);">
            ${colsHtml}
          </div>
        </div>
      `;
    }).join('');

    renderIcons(treeContainer);
  }

  private showSqlError(message: string): void {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="sql-error-banner"]');
    const errorMessage = this.container.querySelector<HTMLElement>('[data-ref="sql-error-message"]');
    if (errorBanner && errorMessage) {
      errorMessage.textContent = message;
      errorBanner.style.display = 'block';
    }
  }

  private hideSqlError(): void {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="sql-error-banner"]');
    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
  }

  private async handleExecuteQuery(): Promise<void> {
    if (this.isExecutingQuery) return;

    const textarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="sql-query-input"]');
    const query = textarea ? textarea.value.trim() : '';

    if (!query) {
      showToast('Por favor escribe una consulta SQL antes de ejecutar.', 'warning');
      return;
    }

    this.hideSqlError();
    this.isExecutingQuery = true;

    const btnExecute = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-sql"]');
    if (btnExecute) {
      btnExecute.disabled = true;
      btnExecute.innerHTML = '<svg class="component-icon" style="width: 16px; height: 16px; animation: spin 1s linear infinite;" aria-hidden="true"><use href="/icons.svg#refresh"></use></svg><span>Ejecutando...</span>';
    }

    try {
      const res = await executeSqlQueryApi(query);
      if (!res.ok || !res.data) {
        this.showSqlError(res.error || 'Error al ejecutar la consulta SQL.');
        showToast('Error al ejecutar la consulta SQL', 'danger');
        return;
      }

      const result = res.data as SqlQueryResult;
      this.lastQueryResult = result;
      this.renderSqlResults(result);

      const btnExport = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-sql-csv"]');
      if (btnExport) {
        btnExport.disabled = false;
      }

      const count = result.totalRows ?? result.rowCount ?? result.rows?.length ?? 0;
      const duration = result.executionTimeMs ?? 0;
      showToast(`Consulta completada en ${duration.toFixed(2)} ms (${count} filas)`, 'success');
    } catch {
      this.showSqlError('Error de conexión con el servidor al ejecutar la consulta.');
      showToast('Error de conexión', 'danger');
    } finally {
      this.isExecutingQuery = false;
      if (btnExecute) {
        btnExecute.disabled = false;
        btnExecute.innerHTML = '<svg class="component-icon" style="width: 16px; height: 16px;" aria-hidden="true"><use href="/icons.svg#play_arrow"></use></svg><span>Ejecutar Consulta</span><kbd style="font-size: 10px; background: rgba(255, 255, 255, 0.2); padding: 2px 5px; border-radius: 4px; margin-left: 4px;">Ctrl+Enter</kbd>';
        renderIcons(btnExecute);
      }
    }
  }

  private renderSqlResults(result: SqlQueryResult): void {
    const metaBox = this.container.querySelector<HTMLElement>('[data-ref="sql-results-meta"]');
    const metaRows = this.container.querySelector<HTMLElement>('[data-ref="sql-meta-rows"]');
    const metaTime = this.container.querySelector<HTMLElement>('[data-ref="sql-meta-time"]');
    const metaCols = this.container.querySelector<HTMLElement>('[data-ref="sql-meta-cols"]');

    const rowCount = result.totalRows ?? result.rowCount ?? result.rows?.length ?? 0;
    const executionTime = result.executionTimeMs ?? 0;

    if (metaBox) metaBox.style.display = 'flex';
    if (metaRows) metaRows.textContent = String(rowCount) + (result.truncated ? ' (máx. 500)' : '');
    if (metaTime) metaTime.textContent = `${executionTime.toFixed(2)} ms`;
    if (metaCols) metaCols.textContent = String(result.columns?.length || 0);

    const thead = this.container.querySelector<HTMLElement>('[data-ref="sql-thead"]');
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="sql-tbody"]');

    if (!thead || !tbody) return;

    if (!result.columns || result.columns.length === 0 || !result.rows || result.rows.length === 0) {
      thead.innerHTML = '<tr style="background: var(--bg-card-subtle); border-bottom: 1px solid var(--border-color); text-align: left;"><th style="padding: 10px 12px; font-weight: 600; color: var(--text-secondary);">Resultado</th></tr>';
      tbody.innerHTML = '<tr><td style="padding: 30px; text-align: center; color: var(--text-secondary);">La consulta se ejecutó exitosamente pero no devolvió filas.</td></tr>';
      return;
    }

    thead.innerHTML = `
      <tr style="background: var(--bg-card-subtle); border-bottom: 1px solid var(--border-color); text-align: left;">
        <th style="padding: 8px 10px; font-weight: 600; color: var(--text-secondary); width: 40px; text-align: center;">#</th>
        ${result.columns.map((col) => `<th style="padding: 8px 12px; font-weight: 600; color: var(--text-primary); font-family: monospace; font-size: 11px;">${escapeHtml(col)}</th>`).join('')}
      </tr>
    `;

    tbody.innerHTML = result.rows.map((row, idx) => `
      <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s ease;">
        <td style="padding: 8px 10px; color: var(--text-secondary); font-size: 11px; text-align: center;">${idx + 1}</td>
        ${result.columns.map((col) => {
          const val = row[col];
          let formattedVal = '';
          if (val === null || val === undefined) {
            formattedVal = '<span style="color: var(--text-secondary); font-style: italic;">NULL</span>';
          } else if (typeof val === 'boolean') {
            formattedVal = val ? '<span class="component-badge component-badge--sm component-badge--success" style="font-size: 10px;">true</span>' : '<span class="component-badge component-badge--sm" style="font-size: 10px;">false</span>';
          } else if (typeof val === 'object') {
            formattedVal = `<code style="font-family: monospace; font-size: 11px;">${escapeHtml(JSON.stringify(val))}</code>`;
          } else {
            formattedVal = escapeHtml(String(val));
          }
          return `<td style="padding: 8px 12px; color: var(--text-primary); font-size: 12px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(String(val ?? ''))}">${formattedVal}</td>`;
        }).join('')}
      </tr>
    `).join('');
  }

  public exportSqlResultsCsv(): void {
    if (!this.lastQueryResult || this.lastQueryResult.rows.length === 0) {
      showToast('No hay filas para exportar.', 'warning');
      return;
    }

    const { columns, rows } = this.lastQueryResult;
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = columns.map(escapeCsv).join(',');
    const rowLines = rows.map((row) => columns.map((col) => escapeCsv(row[col])).join(','));
    const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sql_query_result_${Date.now()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    showToast('Resultado de consulta exportado en CSV', 'success');
  }

}
