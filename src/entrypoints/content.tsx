import React from 'react';
import ReactDOM from 'react-dom/client';
import cssText from '@/assets/content.css?inline';
import { FloatingPanel } from '@/components/FloatingPanel';
import { debounce, slugify } from '@/lib/utils';
import {
  getViewSettings,
  saveViewSettings,
  type ColumnConfig,
} from '@/lib/storage';
import {
  detectColumns,
  extractContext,
  findBoardRoot,
  type BoardContext,
} from '@/lib/sharepoint';

export default defineContentScript({
  matches: [
    '*://*.sharepoint.com/*Lists/*',
    '*://*.sharepoint.com/*lists/*',
    '*://*.sharepoint.com/sites/*/Lists/*',
    '*://*.sharepoint.com/sites/*/lists/*',
    '*://lists.live.com/*',
  ],
  main() {
    let currentContext: BoardContext | null = null;
    let columnSettings: ColumnConfig[] = [];
    let shadowHost: HTMLDivElement | null = null;
    let shadowRoot: ShadowRoot | null = null;
    let panelRoot: ReactDOM.Root | null = null;
    let triggerButton: HTMLButtonElement | null = null;
    let panelOpen = false;
    let panelMinimized = false;
    let isSyncingNativeCollapse = false;
    let compactMode = false;
    let compactStyleEl: HTMLStyleElement | null = null;
    const autoOpenedViews = new Set<string>();

    const COMPACT_CSS = `
      [data-automation-id="board-view"] [role="listitem"],
      [data-automation-id="board-view"] [class*="board"] [class*="card"],
      [data-automation-id="board-view"] [class*="board"] [class*="Card"] {
        padding: 6px 8px !important;
        min-height: unset !important;
        margin: 2px 0 !important;
      }
      [data-automation-id="board-view"] [role="listitem"] *,
      [data-automation-id="board-view"] [class*="board"] [class*="card"] *,
      [data-automation-id="board-view"] [class*="board"] [class*="Card"] * {
        font-size: 12px !important;
        line-height: 1.3 !important;
      }
    `;

    function applyCardFilter(query: string) {
      const root = findBoardRoot();
      if (!root) return;
      const normalized = query.toLowerCase().trim();
      const cards = root.querySelectorAll<HTMLElement>(
        '[aria-label*="Bucket"] [role="listitem"], [aria-label*="Bucket"] [class*="card"], [aria-label*="Bucket"] [class*="Card"]'
      );
      cards.forEach((card) => {
        if (!normalized) {
          card.style.removeProperty('display');
          return;
        }
        const text = card.textContent?.toLowerCase() ?? '';
        card.style.setProperty('display', text.includes(normalized) ? '' : 'none', 'important');
      });
    }

    function applyWipWarnings(columns: ColumnConfig[], context: BoardContext) {
      for (const column of columns) {
        if (!column.visible || column.wipLimit === undefined || column.wipLimit <= 0) {
          const match = context.columns.find((c) => c.id === column.id);
          if (match) {
            match.element.style.removeProperty('box-shadow');
          }
          continue;
        }
        const match = context.columns.find((c) => c.id === column.id);
        if (!match) continue;
        const overLimit = match.count > column.wipLimit;
        match.element.style.setProperty(
          'box-shadow',
          overLimit ? 'inset 4px 0 0 0 #ef4444' : 'none',
          'important'
        );
      }
    }

    function applyCompactMode(enabled: boolean) {
      if (enabled && !compactStyleEl) {
        compactStyleEl = document.createElement('style');
        compactStyleEl.id = 'betterkanban-compact';
        compactStyleEl.textContent = COMPACT_CSS;
        document.head.appendChild(compactStyleEl);
      } else if (!enabled && compactStyleEl) {
        compactStyleEl.remove();
        compactStyleEl = null;
      }
    }

    function applyColumnSettings(columns: ColumnConfig[]) {
      if (!currentContext) return;

      for (const column of columns) {
        const match = currentContext.columns.find((c) => c.id === column.id);
        if (!match) continue;
        const el = match.element;

        if (!column.visible) {
          el.style.setProperty('display', 'none', 'important');
          el.style.removeProperty('order');
          el.style.removeProperty('box-shadow');
        } else {
          el.style.removeProperty('display');
          el.style.setProperty('order', String(column.order));
        }
      }

      applyWipWarnings(columns, currentContext);
    }

    function findNativeCollapseButton(
      element: HTMLElement
    ): HTMLButtonElement | null {
      return element.querySelector(
        'button[aria-label^="Collapse bucket"], button[aria-label^="Expand bucket"]'
      );
    }

    function isNativeCollapsed(element: HTMLElement): boolean {
      const btn = findNativeCollapseButton(element);
      if (!btn) return false;
      const label = btn.getAttribute('aria-label') ?? '';
      return label.startsWith('Expand bucket');
    }

    function clickNativeCollapse(element: HTMLElement, collapsed: boolean) {
      const btn = findNativeCollapseButton(element);
      if (!btn) return;
      const currentlyCollapsed = isNativeCollapsed(element);
      if (currentlyCollapsed !== collapsed) {
        btn.click();
      }
    }

    function syncNativeCollapse(columns: ColumnConfig[]) {
      if (!currentContext) return;
      isSyncingNativeCollapse = true;
      try {
        for (const column of columns) {
          if (!column.visible) continue;
          const match = currentContext.columns.find((c) => c.id === column.id);
          if (match) {
            clickNativeCollapse(match.element, column.collapsed);
          }
        }
      } finally {
        isSyncingNativeCollapse = false;
      }
    }

    function onNativeCollapseClick(event: MouseEvent) {
      if (isSyncingNativeCollapse) return;

      const target = event.target as HTMLElement;
      const btn = target.closest(
        'button[aria-label^="Collapse bucket"], button[aria-label^="Expand bucket"]'
      ) as HTMLButtonElement | null;
      if (!btn || !currentContext) return;

      const label = btn.getAttribute('aria-label') ?? '';
      const match = label.match(/(?:Collapse|Expand) bucket\s+(.+)$/i);
      if (!match) return;

      const bucketLabel = match[1].trim();
      const id = slugify(bucketLabel);
      const isCollapsed = label.startsWith('Expand');

      columnSettings = columnSettings.map((col) =>
        col.id === id ? { ...col, collapsed: isCollapsed } : col
      );

      applyColumnSettings(columnSettings);
      renderFloatingPanel();
    }

    function buildDefaultColumns(): ColumnConfig[] {
      if (!currentContext) return [];
      return currentContext.columns.map((col, index) => ({
        id: col.id,
        label: col.label,
        visible: true,
        collapsed: isNativeCollapsed(col.element),
        order: index,
      }));
    }

    async function loadAndApplySettings() {
      if (!currentContext) return;

      const saved = await getViewSettings({
        siteUrl: currentContext.siteUrl,
        listName: currentContext.listName,
        viewId: currentContext.viewId,
      });

      if (saved?.columns?.length) {
        columnSettings = saved.columns;
      } else {
        columnSettings = buildDefaultColumns();
      }

      if (saved?.compactMode) {
        compactMode = true;
        applyCompactMode(true);
      }

      applyColumnSettings(columnSettings);
      syncNativeCollapse(columnSettings);
    }

    function getShadowHost(): HTMLDivElement {
      if (shadowHost) return shadowHost;

      shadowHost = document.createElement('div');
      shadowHost.id = 'sp-kanban-sorter-host';
      shadowHost.className = 'sp-kanban-sorter';
      document.body.appendChild(shadowHost);

      shadowRoot = shadowHost.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = cssText;
      shadowRoot.appendChild(style);

      return shadowHost;
    }

    function getPanelSlot(): HTMLDivElement {
      getShadowHost();
      let slot = shadowRoot?.getElementById(
        'sp-kanban-sorter-panel'
      ) as HTMLDivElement | null;
      if (slot) return slot;

      slot = document.createElement('div');
      slot.id = 'sp-kanban-sorter-panel';
      slot.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        pointer-events: none;
        display: none;
      `;
      shadowRoot?.appendChild(slot);
      return slot;
    }

    function getTriggerSlot(): HTMLDivElement {
      getShadowHost();
      let slot = shadowRoot?.getElementById(
        'sp-kanban-sorter-trigger-slot'
      ) as HTMLDivElement | null;
      if (slot) return slot;

      slot = document.createElement('div');
      slot.id = 'sp-kanban-sorter-trigger-slot';
      shadowRoot?.appendChild(slot);
      return slot;
    }

    function renderFloatingPanel() {
      if (!currentContext) return;

      const slot = getPanelSlot();
      slot.style.display = 'block';

      if (!panelRoot) {
        panelRoot = ReactDOM.createRoot(slot);
      }

      const counts: Record<string, number> = {};
      for (const col of currentContext.columns) {
        counts[col.id] = col.count;
      }

      panelRoot.render(
        <FloatingPanel
          context={currentContext}
          columns={columnSettings}
          counts={counts}
          compactMode={compactMode}
          onChange={(columns) => {
            columnSettings = columns;
            applyColumnSettings(columns);
            syncNativeCollapse(columns);
            renderFloatingPanel();
          }}
          onSave={async () => {
            if (!currentContext) return;
            await saveViewSettings(
              {
                siteUrl: currentContext.siteUrl,
                listName: currentContext.listName,
                viewId: currentContext.viewId,
              },
              columnSettings,
              compactMode
            );
          }}
          onToggleCompact={() => {
            compactMode = !compactMode;
            applyCompactMode(compactMode);
            renderFloatingPanel();
          }}
          onFilter={(query) => {
            applyCardFilter(query);
          }}
          onReset={() => {
            columnSettings = buildDefaultColumns();
            compactMode = false;
            applyCompactMode(false);
            applyColumnSettings(columnSettings);
            syncNativeCollapse(columnSettings);
            applyCardFilter('');
            renderFloatingPanel();
          }}
          onMinimize={() => {
            applyCardFilter('');
            panelMinimized = true;
            panelOpen = false;
            getPanelSlot().style.display = 'none';
            renderTriggerButton();
          }}
          onClose={() => {
            applyCardFilter('');
            panelOpen = false;
            panelMinimized = false;
            getPanelSlot().style.display = 'none';
            renderTriggerButton();
          }}
        />
      );
    }

    function renderTriggerButton() {
      if (triggerButton) return;

      const slot = getTriggerSlot();
      triggerButton = document.createElement('button');
      triggerButton.id = 'sp-kanban-sorter-trigger';
      triggerButton.textContent = '📋';
      triggerButton.title = 'BetterKanban';
      triggerButton.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #0078d4;
        color: white;
        border: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        cursor: pointer;
        font-size: 20px;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      triggerButton.addEventListener('click', () => {
        panelOpen = true;
        panelMinimized = false;
        renderFloatingPanel();
        if (triggerButton) {
          triggerButton.remove();
          triggerButton = null;
        }
      });

      slot.appendChild(triggerButton);
    }

    function removeUI() {
      if (panelRoot) {
        panelRoot.unmount();
        panelRoot = null;
      }
      if (shadowHost) {
        shadowHost.remove();
        shadowHost = null;
        shadowRoot = null;
      }
      triggerButton = null;
      panelOpen = false;
      panelMinimized = false;
      currentContext = null;
      columnSettings = [];
    }

    async function initialize() {
      const partial = extractContext();
      if (!partial) {
        removeUI();
        return;
      }

      const root = findBoardRoot();
      if (!root) {
        removeUI();
        return;
      }

      const columns = detectColumns(root);
      if (columns.length === 0) {
        removeUI();
        return;
      }

      currentContext = {
        siteUrl: partial.siteUrl ?? '',
        listName: partial.listName ?? '',
        viewId: partial.viewId ?? '',
        viewName: partial.viewName ?? 'Board',
        columns,
      };

      // Only load saved settings on first detection for this view.
      // If the user has made unsaved changes (panel open, toggles clicked),
      // reloading from storage would revert them on the next SPA re-render.
      if (columnSettings.length === 0) {
        await loadAndApplySettings();
      }

      root.removeEventListener('click', onNativeCollapseClick, true);
      root.addEventListener('click', onNativeCollapseClick, true);

      const shouldAutoOpen =
        !columnSettings.some((c) => c.collapsed) &&
        columnSettings.every((c) => c.visible) &&
        columnSettings.every((c, i) => c.order === i) &&
        !autoOpenedViews.has(currentContext.viewId);

      if (shouldAutoOpen) {
        panelOpen = true;
        autoOpenedViews.add(currentContext.viewId);
      }

      if (panelOpen) {
        renderFloatingPanel();
      } else if (!triggerButton) {
        renderTriggerButton();
      }
    }

    const debouncedInitialize = debounce(initialize, 300);

    function observePage() {
      const observer = new MutationObserver(() => {
        debouncedInitialize();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      const originalPushState = history.pushState;
      history.pushState = function (...args) {
        originalPushState.apply(this, args);
        debouncedInitialize();
      };

      window.addEventListener('popstate', () => {
        debouncedInitialize();
      });
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'GET_BOARD_CONTEXT') {
        sendResponse({
          success: !!currentContext,
          context: currentContext,
        });
        return true;
      }

      if (message.type === 'OPEN_FLOATING_PANEL') {
        panelOpen = true;
        panelMinimized = false;
        renderFloatingPanel();
        if (triggerButton) {
          triggerButton.remove();
          triggerButton = null;
        }
        sendResponse({ success: true });
        return true;
      }

      return false;
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initialize();
        observePage();
      });
    } else {
      initialize();
      observePage();
    }
  },
});
