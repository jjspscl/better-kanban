import { slugify } from './utils';

export const SCHEMA_VERSION = 'v1';
export const STORAGE_KEY_PREFIX = 'betterkanban';
export const STORAGE_META_KEY = `${STORAGE_KEY_PREFIX}::meta`;

export interface GlobalSettings {
  wipEnabled: boolean;
  autoRefreshOn403: boolean;
}

export const GLOBAL_SETTINGS_KEY = `${STORAGE_KEY_PREFIX}::settings`;

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  collapsed: boolean;
  order: number;
  wipLimit?: number;
}

export interface ViewSettings {
  schemaVersion: string;
  viewId: string;
  listName: string;
  siteUrl: string;
  columns: ColumnConfig[];
  lastUpdated: number;
  compactMode?: boolean;
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

function getStorageArea(): chrome.storage.StorageArea {
  return chrome.storage.local;
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
  columns: ColumnConfig[],
  compactMode?: boolean
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
    compactMode,
  };

  await area.set({ [key]: settings });
  await updateMeta(context, key);
}

export async function getGlobalSettings(): Promise<GlobalSettings> {
  const area = await getStorageArea();
  const result = await area.get(GLOBAL_SETTINGS_KEY);
  return result[GLOBAL_SETTINGS_KEY] ?? { wipEnabled: false, autoRefreshOn403: false };
}

export async function saveGlobalSettings(
  settings: GlobalSettings
): Promise<void> {
  const area = await getStorageArea();
  await area.set({ [GLOBAL_SETTINGS_KEY]: settings });
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
    if (
      key.startsWith(STORAGE_KEY_PREFIX) &&
      key !== STORAGE_META_KEY &&
      key !== GLOBAL_SETTINGS_KEY
    ) {
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
  const keysToRemove = Object.keys(all).filter(
    (key) =>
      key.startsWith(STORAGE_KEY_PREFIX) &&
      key !== GLOBAL_SETTINGS_KEY &&
      key !== STORAGE_META_KEY
  );
  await area.remove(keysToRemove);
}
