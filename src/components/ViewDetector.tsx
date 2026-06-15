import { List, Eye, LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BoardContext } from '@/lib/sharepoint';

interface ViewDetectorProps {
  context: BoardContext | null;
}

export function ViewDetector({ context }: ViewDetectorProps) {
  if (!context) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          No SharePoint board view detected on this tab.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutGrid className="h-4 w-4" />
          Detected Board View
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <List className="h-4 w-4" />
          <span className="font-medium text-foreground">{context.listName}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span className="font-medium text-foreground">{context.viewName}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {context.columns.length} column{context.columns.length === 1 ? '' : 's'} found
        </div>
      </CardContent>
    </Card>
  );
}
