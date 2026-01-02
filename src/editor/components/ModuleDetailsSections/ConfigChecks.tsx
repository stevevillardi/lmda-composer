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

interface ModuleDetailsConfigChecksProps {
  tabId: string;
  moduleId: number;
  moduleType: LogicModuleType;
}

export function ModuleDetailsConfigChecks({ tabId, moduleId, moduleType }: ModuleDetailsConfigChecksProps) {
  const { portals, selectedPortalId, moduleDetailsDraftByTabId } = useEditorStore();
  const draft = moduleDetailsDraftByTabId[tabId];
  const configChecks = draft?.draft?.configChecks || [];

  const handleOpenPortal = () => {
    if (!selectedPortalId) return;

    const portal = portals.find(p => p.id === selectedPortalId);
    if (!portal) return;

    const url = buildPortalEditUrl(portal.hostname, moduleType, moduleId);
    window.open(url, '_blank');
  };

  const alertLevelLabels: Record<number, string> = {
    1: 'No Alert',
    2: 'Warn',
    3: 'Error',
    4: 'Critical',
  };

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
            Config Checks
          </CardTitle>
          <CardDescription>
            View config checks configured for this module (read-only). Config check editing is not currently supported in LMDA Composer. Edit in Portal to make changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configChecks.length === 0 ? (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span>No config checks found. Config check editing is not currently supported in LMDA Composer. Edit in Portal to make changes.</span>
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
                  {configChecks.length} config check{configChecks.length !== 1 ? 's' : ''} configured
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
                      <TableHead>Alert Level</TableHead>
                      <TableHead>ACK Clear</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configChecks.map((check) => {
                      const description = check.description;
                      const truncatedDesc = truncateDescription(description);
                      const isTruncated = description && description.length > 60;
                      const alertLabel = alertLevelLabels[check.alertLevel as number] || `Level ${check.alertLevel}`;

                      return (
                        <TableRow key={check.id}>
                          <TableCell className="font-medium">{check.name}</TableCell>
                          <TableCell className="text-muted-foreground">{check.type || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{alertLabel}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {check.ackClearAlert ? 'Yes' : 'No'}
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
