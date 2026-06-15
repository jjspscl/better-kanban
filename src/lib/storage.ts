import { slugify } from './utils';

export const SCHEMA_VERSION = 'v1';
export const STORAGE_KEY_PREFIX = 'sp-kanban-sorter';
export const STORAGE_META_KEY = `${STORAGE_KEY_PREFIX}::meta`;

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  collapsed: boolean;
  order: number;
}

export interface ViewSettings {
  schemaVersion: string;
  viewId: string;
  listName: string;
  siteUrl: string;
  columns: ColumnConfig[];
  lastUpdated: number;
}

export interface StorageMeta {
  schemaVersion: string;
  views: Array<{
    key: string;
    viewId: string;
    listName: string;
    siteUrl: string;
    lastUpdated: number;
  }>;
}

export interface ViewContext {
  siteUrl: string;
  listName: string;
  viewId: string;
}

export function buildStorageKey(context: ViewContext): string {
  return [
    STORAGE_KEY_PREFIX,
    slugify(context.siteUrl),
    slugify(context.listName),
    context.viewId,
  ].join('::');
}

async function getStorageArea() {
  try {
    await chrome.storage.sync.get(null);
    return chrome.storage.sync;
  } catch {
    return chrome.storage.local;
  }
}

export async function getViewSettings(
  context: ViewContext
): Promise<ViewSettings | null> {
  const area = await getStorageArea();
  const key = buildStorageKey(context);
  const result = await area.get(key);
  return result[key] ?? null;
}

export async function saveViewSettings(
  context: ViewContext,
  columns: ColumnConfig[]
): Promise<void> {
  const area = await getStorageArea();
  const key = buildStorageKey(context);
  const settings: ViewSettings = {
    schemaVersion: SCHEMA_VERSION,
    viewId: context.viewId,
    listName: context.listName,
    siteUrl: context.siteUrl,
    columns,
    lastUpdated: Date.now(),
  };

  await area.set({ [key]: settings });
  await updateMeta(context, key);
}

export async function deleteViewSettings(context: ViewContext): Promise<void> {
  const area = await getStorageArea();
  const key = buildStorageKey(context);
  await area.remove(key);
  await removeFromMeta(key);
}

async function updateMeta(context: ViewContext, key: string): Promise<void> {
  const area = await getStorageArea();
  const meta = (await area.get(STORAGE_META_KEY))[STORAGE_META_KEY] as
    | StorageMeta
    | undefined;

  const entry = {
    key,
    viewId: context.viewId,
    listName: context.listName,
    siteUrl: context.siteUrl,
    lastUpdated: Date.now(),
  };

  const views = (meta?.views ?? []).filter((v) => v.key !== key);
  views.push(entry);

  await area.set({
    [STORAGE_META_KEY]: {
      schemaVersion: SCHEMA_VERSION,
      views,
    } satisfies StorageMeta,
  });
}

async function removeFromMeta(key: string): Promise<void> {
  const area = await getStorageArea();
  const meta = (await area.get(STORAGE_META_KEY))[STORAGE_META_KEY] as
    | StorageMeta
    | undefined;
  if (!meta) return;

  await area.set({
    [STORAGE_META_KEY]: {
      ...meta,
      views: meta.views.filter((v) => v.key !== key),
    } satisfies StorageMeta,
  });
}

export async function getAllSettings(): Promise<Record<string, ViewSettings>> {
  const area = await getStorageArea();
  const all = await area.get(null);
  const result: Record<string, ViewSettings> = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(STORAGE_KEY_PREFIX) && key !== STORAGE_META_KEY) {
      result[key] = value as ViewSettings;
    }
  }
  return result;
}

export async function importSettings(
  data: Record<string, ViewSettings>
): Promise<void> {
  const area = await getStorageArea();
  await area.set(data);
}

export async function clearAllSettings(): Promise<void> {
  const area = await getStorageArea();
  const all = await area.get(null);
  const keysToRemove = Object.keys(all).filter((key) =>
    key.startsWith(STORAGE_KEY_PREFIX)
  );
  await area.remove(keysToRemove);
}
