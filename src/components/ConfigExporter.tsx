import { Download, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { clearAllSettings, getAllSettings, SCHEMA_VERSION } from '@/lib/storage';

interface ConfigExporterProps {
  onImport?: () => void;
}

export function ConfigExporter({ onImport }: ConfigExporterProps) {
  async function handleExport() {
    const settings = await getAllSettings();
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schemaVersion: SCHEMA_VERSION,
            exportedAt: Date.now(),
            settings,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `betterkanban-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.settings || typeof data.settings !== 'object') {
        throw new Error('Invalid config file');
      }
      // Could validate schemaVersion here in the future
      await chrome.storage.sync.set(data.settings);
      onImport?.();
    } catch (error) {
      alert('Failed to import config: ' + (error as Error).message);
    } finally {
      event.target.value = '';
    }
  }

  async function handleClear() {
    if (!confirm('Clear all saved board layouts? This cannot be undone.')) return;
    await clearAllSettings();
    onImport?.();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Config</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pt-0">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>

        <Button variant="outline" size="sm" asChild>
          <label className="cursor-pointer">
            <Upload className="mr-2 h-4 w-4" />
            Import
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={handleImport}
            />
          </label>
        </Button>

        <Button variant="destructive" size="sm" onClick={handleClear}>
          <Trash2 className="mr-2 h-4 w-4" />
          Reset All
        </Button>
      </CardContent>
    </Card>
  );
}
