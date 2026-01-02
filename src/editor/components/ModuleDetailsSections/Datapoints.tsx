import { Database, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { buildPortalEditUrl } from '@/shared/module-type-schemas';
import { useEditorStore } from '../../stores/editor-store';
import type { LogicModuleType } from '@/shared/types';

interface ModuleDetailsDatapointsProps {
  tabId: string;
  moduleId: number;
  moduleType: LogicModuleType;
}

export function ModuleDetailsDatapoints({ tabId, moduleId, moduleType }: ModuleDetailsDatapointsProps) {
  const { portals, selectedPortalId, moduleDetailsDraftByTabId } = useEditorStore();
  const draft = moduleDetailsDraftByTabId[tabId];
  const datapoints = draft?.draft?.dataPoints || [];

  const handleOpenPortal = () => {
    if (!selectedPortalId) return;
    
    const portal = portals.find(p => p.id === selectedPortalId);
    if (!portal) return;

    const url = buildPortalEditUrl(portal.hostname, moduleType, moduleId);
    window.open(url, '_blank');
  };

  // Data type labels
  const dataTypeLabels: Record<number, string> = {
    0: 'Unknown',
    1: 'Counter',
    2: 'Gauge',
    3: 'Derive',
    5: 'Status',
    6: 'Compute',
    7: 'Counter32',
    8: 'Counter64',
  };

  // Truncate description helper
  const truncateDescription = (description: string | undefined, maxLength: number = 60): string => {
    if (!description) return '-';
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5" />
            Datapoints
          </CardTitle>
          <CardDescription>
            View datapoints configured for this module (read-only)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {datapoints.length === 0 ? (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span>No datapoints found. Datapoint editing is not currently supported in LMDA Composer.</span>
                <Button
                  onClick={handleOpenPortal}
                  disabled={!selectedPortalId}
                  variant="outline"
                  size="sm"
                  className="gap-2 ml-4"
                >
                  <ExternalLink className="size-4" />
                  Edit in Portal
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {datapoints.length} datapoint{datapoints.length !== 1 ? 's' : ''} configured
                </p>
                <Button
                  onClick={handleOpenPortal}
                  disabled={!selectedPortalId}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <ExternalLink className="size-4" />
                  Edit in Portal
                </Button>
              </div>
              
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Post Processor</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datapoints.map((dp) => {
                      const description = dp.description;
                      const truncatedDesc = truncateDescription(description);
                      const isTruncated = description && description.length > 60;
                      const postProcessor = (() => {
                        const method = dp.postProcessorMethod;
                        const param = (dp as { postProcessorParam?: string }).postProcessorParam;
                        if (!method || method === 'none') {
                          return 'none';
                        }
                        if (param) {
                          return `${method}(${param})`;
                        }
                        return method;
                      })();

                      return (
                        <TableRow key={dp.id}>
                          <TableCell className="font-medium">{dp.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {dataTypeLabels[dp.type as number] || `Type ${dp.type}`}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">
                            {postProcessor}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-left">
                            {isTruncated ? (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <span className="cursor-help text-left">{truncatedDesc}</span>
                                  }
                                />
                                <TooltipContent className="max-w-md">
                                  <p className="whitespace-pre-wrap">{description}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-left">{truncatedDesc}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

