import { useEffect, useState } from 'react';
import { LayoutGrid, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ViewDetector } from '@/components/ViewDetector';
import { ConfigExporter } from '@/components/ConfigExporter';
import type { BoardContext } from '@/lib/sharepoint';

export default function Popup() {
  const [context, setContext] = useState<BoardContext | null>(null);

  useEffect(() => {
    async function detect() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'GET_BOARD_CONTEXT',
        });
        if (response?.success) {
          setContext(response.context);
        }
      } catch {
        setContext(null);
      }
    }

    detect();
  }, []);

  async function openManager() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_FLOATING_PANEL' });
      window.close();
    }
  }

  return (
    <div className="w-[380px] space-y-4 p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <LayoutGrid className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-base font-semibold">BetterKanban</h1>
          <p className="text-xs text-muted-foreground">
            Sort & hide SharePoint board columns
          </p>
        </div>
      </div>

      <ViewDetector context={context} />

      {context && (
        <Button className="w-full" onClick={openManager}>
          <Settings2 className="mr-2 h-4 w-4" />
          Open Column Manager
        </Button>
      )}

      <ConfigExporter onImport={() => window.location.reload()} />

      <div className="text-center text-xs text-muted-foreground">
        v{chrome.runtime.getManifest().version}
      </div>
    </div>
  );
}
