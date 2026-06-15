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
    const autoOpenedViews = new Set<string>();

    function applyColumnSettings(columns: ColumnConfig[]) {
      if (!currentContext) return;

      for (const column of columns) {
        const match = currentContext.columns.find((c) => c.id === column.id);
        if (!match) continue;
        const el = match.element;

        if (!column.visible) {
          el.style.setProperty('display', 'none', 'important');
          el.style.removeProperty('order');
        } else {
          el.style.removeProperty('display');
          el.style.setProperty('order', String(column.order));
        }
      }
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

      panelRoot.render(
        <FloatingPanel
          context={currentContext}
          columns={columnSettings}
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
              columnSettings
            );
          }}
          onReset={() => {
            columnSettings = buildDefaultColumns();
            applyColumnSettings(columnSettings);
            syncNativeCollapse(columnSettings);
            renderFloatingPanel();
          }}
          onMinimize={() => {
            panelMinimized = true;
            panelOpen = false;
            getPanelSlot().style.display = 'none';
            renderTriggerButton();
          }}
          onClose={() => {
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
