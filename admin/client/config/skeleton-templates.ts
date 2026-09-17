function renderTableRowsHtml(count = 6): string {
  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    rows.push(`
      <tr class="skeleton-table-row" data-ref="skeleton-table-row" style="--row-index: ${i};">
        <td><div class="skeleton-cell" data-ref="skeleton-cell" style="width: 25%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-cell" style="width: 35%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-cell" style="width: 15%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-cell" style="width: 15%;"></div></td>
        <td><div class="skeleton-cell" data-ref="skeleton-cell" style="width: 10%;"></div></td>
      </tr>
    `);
  }
  return rows.join('');
}

const SKELETON_RAIL_HTML = `
  <div class="layout-rail" data-ref="skeleton-rail" style="width: auto; min-width: 68px; max-width: 76px; height: 100%; background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 12px 6px 12px 6px; gap: 12px; box-sizing: border-box; flex-shrink: 0;">
    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%;">
      <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
    </div>
    <div class="rail-divider" style="width: 36px; height: 1px; background: var(--border-color); margin: 0;"></div>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
        <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
        <div class="skeleton" style="width: 36px; height: 8px; border-radius: 4px;"></div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
        <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
        <div class="skeleton" style="width: 32px; height: 8px; border-radius: 4px;"></div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
        <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
        <div class="skeleton" style="width: 38px; height: 8px; border-radius: 4px;"></div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
        <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
        <div class="skeleton" style="width: 36px; height: 8px; border-radius: 4px;"></div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
        <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
        <div class="skeleton" style="width: 34px; height: 8px; border-radius: 4px;"></div>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; margin-top: auto; padding-bottom: 4px;">
      <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
      <div class="skeleton skeleton--avatar" style="width: 36px; height: 36px; border-radius: 50%;"></div>
    </div>
  </div>
`;

export const SKELETON_TEMPLATES: Record<string, string> = {
  'centered-form': `
    <div class="layout-content" data-ref="skeleton-centered-form-view">
      <div class="login-container" data-ref="skeleton-centered-form-container">
        <div class="login-header-logo" data-ref="skeleton-centered-form-logo" style="pointer-events: none;">
          <div class="skeleton skeleton--circle" style="width: 38px; height: 38px;"></div>
        </div>
        <div class="card card--w-400" data-ref="skeleton-centered-form-card">
          <div class="card__header" data-ref="skeleton-centered-form-header">
            <div class="skeleton skeleton--title" style="width: 200px; height: 28px; margin: 0;"></div>
            <div class="skeleton skeleton--subtitle" style="width: 320px; max-width: 100%; height: 16px; margin: 0;"></div>
          </div>
          <div class="card__body" data-ref="skeleton-centered-form-body">
            <div class="skeleton skeleton--input" style="height: 55px; border-radius: var(--radius-md); margin: 0;"></div>
            <div class="skeleton skeleton--input" style="height: 55px; border-radius: var(--radius-md); margin: 0;"></div>
            <div class="skeleton skeleton--button" style="height: 55px; border-radius: var(--radius-md); margin: 0;"></div>
          </div>
        </div>
      </div>
    </div>
  `,

  'dashboard-layout': `
    <div class="layout-root" data-ref="skeleton-dashboard-root" style="width: 100%; height: 100%; display: flex; flex-direction: row; overflow: hidden;">
      ${SKELETON_RAIL_HTML}
      <div class="layout-content skeleton-container" data-ref="skeleton-dashboard-view">
        <div class="view-wrapper component-wrapper component-wrapper--full" data-ref="skeleton-dashboard-wrapper">
          <div class="view-header" data-ref="skeleton-floating-top">
            <div class="skeleton skeleton--title" style="width: 180px; height: 24px; margin: 0;"></div>
            <div style="display: flex; gap: 8px;">
              <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
            </div>
          </div>
          <div class="layout-body layout-body--scrollable layout-scrollable view-scrollable" data-ref="skeleton-dashboard-scrollable">
            <div class="view-body" style="padding: 24px; display: flex; flex-direction: column; gap: 24px;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
                <div class="skeleton" style="height: 110px; border-radius: 16px;"></div>
                <div class="skeleton" style="height: 110px; border-radius: 16px;"></div>
                <div class="skeleton" style="height: 110px; border-radius: 16px;"></div>
                <div class="skeleton" style="height: 110px; border-radius: 16px;"></div>
              </div>
              <div class="skeleton" style="height: 280px; border-radius: 16px;"></div>
              <div class="skeleton" style="height: 220px; border-radius: 16px;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'dashboard-layout-bottom': `
    <div class="layout-content skeleton-container" data-ref="skeleton-dashboard-view">
      <div class="view-wrapper component-wrapper component-wrapper--full" data-ref="skeleton-dashboard-wrapper">
        <div class="view-header" data-ref="skeleton-floating-top">
          <div class="skeleton skeleton--title" style="width: 180px; height: 24px; margin: 0;"></div>
          <div style="display: flex; gap: 8px;">
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
          </div>
        </div>
        <div class="layout-body layout-body--scrollable layout-scrollable view-scrollable" data-ref="skeleton-dashboard-scrollable">
          <div class="view-body" style="padding: 24px; display: flex; flex-direction: column; gap: 24px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
              <div class="skeleton" style="height: 110px; border-radius: 16px;"></div>
              <div class="skeleton" style="height: 110px; border-radius: 16px;"></div>
              <div class="skeleton" style="height: 110px; border-radius: 16px;"></div>
              <div class="skeleton" style="height: 110px; border-radius: 16px;"></div>
            </div>
            <div class="skeleton" style="height: 280px; border-radius: 16px;"></div>
            <div class="skeleton" style="height: 220px; border-radius: 16px;"></div>
          </div>
        </div>
      </div>
    </div>
  `,

  'grouped-layout': `
    <div class="layout-root" data-ref="skeleton-grouped-view" style="width: 100%; height: 100%; display: flex; flex-direction: row; overflow: hidden;">
      ${SKELETON_RAIL_HTML}
      <div class="layout-content" data-ref="skeleton-content-area">
        <div class="component-wrapper component-wrapper--full view-wrapper" data-ref="skeleton-grouped-wrapper">
          <div class="layout-body layout-body--scrollable layout-scrollable view-scrollable" data-ref="skeleton-body-area">
            <div class="grouped-flow-layout" data-ref="skeleton-grouped-layout">
              <div class="grouped-header-card" data-ref="skeleton-grouped-header">
                <div class="skeleton skeleton--title" style="width: 220px; height: 24px; margin: 0 auto;"></div>
                <div class="skeleton skeleton--subtitle" style="width: 380px; max-width: 90%; height: 14px; margin: 8px auto 0 auto;"></div>
              </div>
              <div class="grouped-items-card" data-ref="skeleton-grouped-card-1">
                <div class="grouped-row-item--stacked" data-ref="skeleton-grouped-item-1">
                  <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                    <div class="skeleton skeleton--title" style="width: 160px; height: 18px; margin: 0;"></div>
                    <div class="skeleton skeleton--text" style="width: 320px; max-width: 90%; height: 13px; margin: 0;"></div>
                  </div>
                  <div class="skeleton" style="width: 100%; max-width: 265px; height: 42px; border-radius: var(--radius-md); margin-top: 4px;"></div>
                </div>
              </div>
              <div class="grouped-items-card" data-ref="skeleton-grouped-card-2">
                <div class="grouped-row-item" data-ref="skeleton-grouped-item-2">
                  <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                    <div class="skeleton skeleton--title" style="width: 180px; height: 18px; margin: 0;"></div>
                    <div class="skeleton skeleton--text" style="width: 300px; max-width: 90%; height: 13px; margin: 0;"></div>
                  </div>
                  <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'grouped-layout-bottom': `
    <div class="layout-content skeleton-container" data-ref="skeleton-content-area">
      <div class="component-wrapper component-wrapper--full view-wrapper" data-ref="skeleton-grouped-wrapper">
        <div class="layout-body layout-body--scrollable layout-scrollable view-scrollable" data-ref="skeleton-body-area">
          <div class="grouped-flow-layout" data-ref="skeleton-grouped-layout">
            <div class="grouped-header-card" data-ref="skeleton-grouped-header">
              <div class="skeleton skeleton--title" style="width: 220px; height: 24px; margin: 0 auto;"></div>
              <div class="skeleton skeleton--subtitle" style="width: 380px; max-width: 90%; height: 14px; margin: 8px auto 0 auto;"></div>
            </div>
            <div class="grouped-items-card" data-ref="skeleton-grouped-card-1">
              <div class="grouped-row-item--stacked" data-ref="skeleton-grouped-item-1">
                <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                  <div class="skeleton skeleton--title" style="width: 160px; height: 18px; margin: 0;"></div>
                  <div class="skeleton skeleton--text" style="width: 320px; max-width: 90%; height: 13px; margin: 0;"></div>
                </div>
                <div class="skeleton" style="width: 100%; max-width: 265px; height: 42px; border-radius: var(--radius-md); margin-top: 4px;"></div>
              </div>
            </div>
            <div class="grouped-items-card" data-ref="skeleton-grouped-card-2">
              <div class="grouped-row-item" data-ref="skeleton-grouped-item-2">
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <div class="skeleton skeleton--title" style="width: 180px; height: 18px; margin: 0;"></div>
                  <div class="skeleton skeleton--text" style="width: 300px; max-width: 90%; height: 13px; margin: 0;"></div>
                </div>
                <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'table-layout': `
    <div class="layout-root" data-ref="skeleton-table-root" style="width: 100%; height: 100%; display: flex; flex-direction: row; overflow: hidden;">
      ${SKELETON_RAIL_HTML}
      <div class="layout-content skeleton-container" data-ref="skeleton-table-view">
        <div class="view-wrapper component-wrapper component-wrapper--full" data-ref="skeleton-table-wrapper">
          <div class="view-header" data-ref="skeleton-floating-top">
            <div class="skeleton skeleton--title" style="width: 180px; height: 24px; margin: 0;"></div>
            <div style="display: flex; gap: 8px;">
              <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
              <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
            </div>
          </div>
          <div class="layout-body layout-body--scrollable layout-scrollable view-scrollable" data-ref="skeleton-table-scrollable">
            <div style="padding: 20px 24px 0 24px; display: flex; gap: 12px;">
              <div class="skeleton" style="width: 260px; height: 40px; border-radius: 10px;"></div>
              <div class="skeleton" style="width: 120px; height: 40px; border-radius: 10px;"></div>
            </div>
            <div class="component-table-wrapper" data-ref="skeleton-table-wrapper-inner" style="padding: 16px 24px;">
              <table class="component-table" data-ref="skeleton-table-element">
                <thead class="component-table__head">
                  <tr>
                    <th style="width: 25%;"><div class="skeleton" style="width: 70px; height: 16px; border-radius: 4px;"></div></th>
                    <th style="width: 35%;"><div class="skeleton" style="width: 90px; height: 16px; border-radius: 4px;"></div></th>
                    <th style="width: 15%;"><div class="skeleton" style="width: 60px; height: 16px; border-radius: 4px;"></div></th>
                    <th style="width: 15%;"><div class="skeleton" style="width: 60px; height: 16px; border-radius: 4px;"></div></th>
                    <th style="width: 10%;"><div class="skeleton" style="width: 40px; height: 16px; border-radius: 4px;"></div></th>
                  </tr>
                </thead>
                <tbody class="component-table__body">
                  ${renderTableRowsHtml(7)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'table-layout-bottom': `
    <div class="layout-content skeleton-container" data-ref="skeleton-table-view">
      <div class="view-wrapper component-wrapper component-wrapper--full" data-ref="skeleton-table-wrapper">
        <div class="view-header" data-ref="skeleton-floating-top">
          <div class="skeleton skeleton--title" style="width: 180px; height: 24px; margin: 0;"></div>
          <div style="display: flex; gap: 8px;">
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
          </div>
        </div>
        <div class="layout-body layout-body--scrollable layout-scrollable view-scrollable" data-ref="skeleton-table-scrollable">
          <div style="padding: 20px 24px 0 24px; display: flex; gap: 12px;">
            <div class="skeleton" style="width: 260px; height: 40px; border-radius: 10px;"></div>
            <div class="skeleton" style="width: 120px; height: 40px; border-radius: 10px;"></div>
          </div>
          <div class="component-table-wrapper" data-ref="skeleton-table-wrapper-inner" style="padding: 16px 24px;">
            <table class="component-table" data-ref="skeleton-table-element">
              <thead class="component-table__head">
                <tr>
                  <th style="width: 25%;"><div class="skeleton" style="width: 70px; height: 16px; border-radius: 4px;"></div></th>
                  <th style="width: 35%;"><div class="skeleton" style="width: 90px; height: 16px; border-radius: 4px;"></div></th>
                  <th style="width: 15%;"><div class="skeleton" style="width: 60px; height: 16px; border-radius: 4px;"></div></th>
                  <th style="width: 15%;"><div class="skeleton" style="width: 60px; height: 16px; border-radius: 4px;"></div></th>
                  <th style="width: 10%;"><div class="skeleton" style="width: 40px; height: 16px; border-radius: 4px;"></div></th>
                </tr>
              </thead>
              <tbody class="component-table__body">
                ${renderTableRowsHtml(7)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,

  'viewer-layout': `
    <div class="layout-root" data-ref="skeleton-viewer-root" style="width: 100%; height: 100%; display: flex; flex-direction: row; overflow: hidden;">
      ${SKELETON_RAIL_HTML}
      <div class="layout-content skeleton-container" data-ref="skeleton-viewer-view">
        <div class="view-wrapper component-wrapper component-wrapper--full" data-ref="skeleton-viewer-wrapper">
          <div class="view-header" data-ref="skeleton-floating-top">
            <div class="skeleton skeleton--title" style="width: 200px; height: 24px; margin: 0;"></div>
            <div style="display: flex; gap: 8px;">
              <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
              <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
              <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
            </div>
          </div>
          <div class="layout-body layout-body--scrollable layout-scrollable view-scrollable" data-ref="skeleton-viewer-scrollable">
            <div style="padding: 12px 24px; display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color);">
              <div style="display: flex; gap: 16px;">
                <div class="skeleton" style="width: 90px; height: 16px; border-radius: 4px;"></div>
                <div class="skeleton" style="width: 70px; height: 16px; border-radius: 4px;"></div>
                <div class="skeleton" style="width: 70px; height: 16px; border-radius: 4px;"></div>
              </div>
              <div style="display: flex; gap: 16px;">
                <div class="skeleton" style="width: 80px; height: 16px; border-radius: 4px;"></div>
                <div class="skeleton" style="width: 120px; height: 16px; border-radius: 4px;"></div>
              </div>
            </div>
            <div style="padding: 20px 24px; display: flex; flex-direction: column; gap: 14px;">
              <div class="skeleton" style="height: 16px; width: 75%; border-radius: 4px;"></div>
              <div class="skeleton" style="height: 16px; width: 90%; border-radius: 4px;"></div>
              <div class="skeleton" style="height: 16px; width: 60%; border-radius: 4px;"></div>
              <div class="skeleton" style="height: 16px; width: 85%; border-radius: 4px;"></div>
              <div class="skeleton" style="height: 16px; width: 50%; border-radius: 4px;"></div>
              <div class="skeleton" style="height: 16px; width: 95%; border-radius: 4px;"></div>
              <div class="skeleton" style="height: 16px; width: 70%; border-radius: 4px;"></div>
              <div class="skeleton" style="height: 16px; width: 80%; border-radius: 4px;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'viewer-layout-bottom': `
    <div class="layout-content skeleton-container" data-ref="skeleton-viewer-view">
      <div class="view-wrapper component-wrapper component-wrapper--full" data-ref="skeleton-viewer-wrapper">
        <div class="view-header" data-ref="skeleton-floating-top">
          <div class="skeleton skeleton--title" style="width: 200px; height: 24px; margin: 0;"></div>
          <div style="display: flex; gap: 8px;">
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
          </div>
        </div>
        <div class="layout-body layout-body--scrollable layout-scrollable view-scrollable" data-ref="skeleton-viewer-scrollable">
          <div style="padding: 12px 24px; display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; gap: 16px;">
              <div class="skeleton" style="width: 90px; height: 16px; border-radius: 4px;"></div>
              <div class="skeleton" style="width: 70px; height: 16px; border-radius: 4px;"></div>
              <div class="skeleton" style="width: 70px; height: 16px; border-radius: 4px;"></div>
            </div>
            <div style="display: flex; gap: 16px;">
              <div class="skeleton" style="width: 80px; height: 16px; border-radius: 4px;"></div>
              <div class="skeleton" style="width: 120px; height: 16px; border-radius: 4px;"></div>
            </div>
          </div>
          <div style="padding: 20px 24px; display: flex; flex-direction: column; gap: 14px;">
            <div class="skeleton" style="height: 16px; width: 75%; border-radius: 4px;"></div>
            <div class="skeleton" style="height: 16px; width: 90%; border-radius: 4px;"></div>
            <div class="skeleton" style="height: 16px; width: 60%; border-radius: 4px;"></div>
            <div class="skeleton" style="height: 16px; width: 85%; border-radius: 4px;"></div>
            <div class="skeleton" style="height: 16px; width: 50%; border-radius: 4px;"></div>
            <div class="skeleton" style="height: 16px; width: 95%; border-radius: 4px;"></div>
            <div class="skeleton" style="height: 16px; width: 70%; border-radius: 4px;"></div>
            <div class="skeleton" style="height: 16px; width: 80%; border-radius: 4px;"></div>
          </div>
        </div>
      </div>
    </div>
  `,

  'split-layout': `
    <div class="layout-root" data-ref="skeleton-split-root" style="width: 100%; height: 100%; display: flex; flex-direction: row; overflow: hidden;">
      ${SKELETON_RAIL_HTML}
      <div class="layout-content skeleton-container" data-ref="skeleton-split-view">
        <div class="view-wrapper component-wrapper component-wrapper--full" data-ref="skeleton-split-wrapper">
          <div class="view-header" data-ref="skeleton-floating-top">
            <div class="skeleton skeleton--title" style="width: 200px; height: 24px; margin: 0;"></div>
            <div style="display: flex; gap: 8px;">
              <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
            </div>
          </div>
          <div class="layout-body layout-body--scrollable layout-scrollable view-scrollable" data-ref="skeleton-split-scrollable">
            <div style="display: flex; height: 100%;">
              <div style="width: 340px; border-right: 1px solid var(--border-color); padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                <div class="skeleton" style="height: 40px; border-radius: 10px;"></div>
                <div style="display: flex; gap: 6px;">
                  <div class="skeleton" style="height: 24px; width: 60px; border-radius: 12px;"></div>
                  <div class="skeleton" style="height: 24px; width: 80px; border-radius: 12px;"></div>
                  <div class="skeleton" style="height: 24px; width: 70px; border-radius: 12px;"></div>
                </div>
                <div class="skeleton" style="height: 70px; border-radius: 12px;"></div>
                <div class="skeleton" style="height: 70px; border-radius: 12px;"></div>
                <div class="skeleton" style="height: 70px; border-radius: 12px;"></div>
              </div>
              <div style="flex: 1; padding: 24px; display: flex; flex-direction: column; gap: 16px;">
                <div class="skeleton" style="height: 48px; border-radius: 12px;"></div>
                <div class="skeleton" style="height: 120px; border-radius: 12px;"></div>
                <div class="skeleton" style="height: 80px; border-radius: 12px;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  'split-layout-bottom': `
    <div class="layout-content skeleton-container" data-ref="skeleton-split-view">
      <div class="view-wrapper component-wrapper component-wrapper--full" data-ref="skeleton-split-wrapper">
        <div class="view-header" data-ref="skeleton-floating-top">
          <div class="skeleton skeleton--title" style="width: 200px; height: 24px; margin: 0;"></div>
          <div style="display: flex; gap: 8px;">
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
          </div>
        </div>
        <div class="layout-body layout-body--scrollable layout-scrollable view-scrollable" data-ref="skeleton-split-scrollable">
          <div style="display: flex; height: 100%;">
            <div style="width: 340px; border-right: 1px solid var(--border-color); padding: 16px; display: flex; flex-direction: column; gap: 12px;">
              <div class="skeleton" style="height: 40px; border-radius: 10px;"></div>
              <div style="display: flex; gap: 6px;">
                <div class="skeleton" style="height: 24px; width: 60px; border-radius: 12px;"></div>
                <div class="skeleton" style="height: 24px; width: 80px; border-radius: 12px;"></div>
                <div class="skeleton" style="height: 24px; width: 70px; border-radius: 12px;"></div>
              </div>
              <div class="skeleton" style="height: 70px; border-radius: 12px;"></div>
              <div class="skeleton" style="height: 70px; border-radius: 12px;"></div>
              <div class="skeleton" style="height: 70px; border-radius: 12px;"></div>
            </div>
            <div style="flex: 1; padding: 24px; display: flex; flex-direction: column; gap: 16px;">
              <div class="skeleton" style="height: 48px; border-radius: 12px;"></div>
              <div class="skeleton" style="height: 120px; border-radius: 12px;"></div>
              <div class="skeleton" style="height: 80px; border-radius: 12px;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};

export function getSkeletonTemplate(name: string): string {
  return SKELETON_TEMPLATES[name] || SKELETON_TEMPLATES['dashboard-layout'];
}

export default SKELETON_TEMPLATES;
