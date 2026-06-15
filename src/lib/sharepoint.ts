import { slugify } from './utils';

export interface DetectedColumn {
  id: string;
  label: string;
  count: number;
  element: HTMLElement;
}

export interface BoardContext {
  siteUrl: string;
  listName: string;
  viewId: string;
  viewName: string;
  columns: DetectedColumn[];
}

export function extractContext(): Partial<BoardContext> | null {
  const url = new URL(window.location.href);
  const pathParts = url.pathname.split('/');
  const listsIndex = pathParts.findIndex(
    (p) => p.toLowerCase() === 'lists'
  );

  if (listsIndex === -1 || listsIndex + 1 >= pathParts.length) return null;

  const listName = decodeURIComponent(pathParts[listsIndex + 1]);
  const viewId = url.searchParams.get('viewid') ?? 'default';
  const viewName = document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? 'Board';

  return {
    siteUrl: `${url.protocol}//${url.host}`,
    listName,
    viewId,
    viewName,
  };
}

export function findBoardRoot(): HTMLElement | null {
  // Try multiple selectors for robustness
  const selectors = [
    '[data-automation-id="board-view"]',
    '[data-automation-id="CanvasLayout"] [role="grid"]',
    '[role="grid"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) return el;
  }

  return null;
}

export function detectColumns(root: HTMLElement): DetectedColumn[] {
  const columns: DetectedColumn[] = [];

  // Strategy 1: Look for bucket containers with aria-label
  const bucketEls = root.querySelectorAll<HTMLElement>('[aria-label*="Bucket"]');
  bucketEls.forEach((el) => {
    const match = el.getAttribute('aria-label')?.match(/Bucket\s+(.+?),\s*contains\s*(\d+)\s*items?/i);
    if (match) {
      const label = match[1].trim();
      columns.push({
        id: slugify(label),
        label,
        count: parseInt(match[2], 10),
        element: el,
      });
    }
  });

  if (columns.length > 0) return columns;

  // Strategy 2: Look for h2 headings paired with count headings
  const headings = root.querySelectorAll<HTMLHeadingElement>('h2');
  headings.forEach((heading) => {
    const text = heading.textContent?.trim();
    if (!text) return;

    const container = heading.closest('[class*="bucket"], [class*="column"], [role="listitem"]') as HTMLElement | null;
    if (!container) return;

    columns.push({
      id: slugify(text),
      label: text,
      count: 0,
      element: container,
    });
  });

  return columns;
}

export function findColumnElement(
  root: HTMLElement,
  columnId: string
): HTMLElement | null {
  const columns = detectColumns(root);
  const match = columns.find((c) => c.id === columnId);
  return match?.element ?? null;
}
