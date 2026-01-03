import { ExternalLink, Server } from 'lucide-react';
import { SectionCard } from '../SectionCard';
import { Badge } from '@/components/ui/badge';
import type { CollectorInfo } from '../types';

/** Format platform name with proper casing (linux -> Linux) */
function formatPlatform(platform: string): string {
  if (!platform) return 'N/A';
  return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
}

interface CollectorInfoCardProps {
  data: CollectorInfo;
}

export function CollectorInfoCard({ data }: CollectorInfoCardProps) {
  const links = data.portalLinks;

  return (
    <SectionCard title="Collector Details" icon={<Server className="size-4" />}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground select-none">Collector ID</p>
            <p className="font-mono font-medium">{data.id || 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground select-none">Hostname</p>
            <p className="font-mono font-medium">{data.hostname || 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground select-none">Display Name</p>
            <p className="font-medium">{data.displayName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground select-none">Description</p>
            <p className="font-medium">{data.description || 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground select-none">Version</p>
            <Badge variant="secondary" className="select-none">{data.version || 'N/A'}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground select-none">Platform</p>
            <Badge variant="outline" className="select-none">{formatPlatform(data.platform)}</Badge>
          </div>
        </div>

        {links && (
          <div className="pt-3 border-t">
            <p className="text-sm text-muted-foreground mb-2 select-none">Portal Links</p>
            <div className="flex flex-wrap gap-2">
              <a 
                href={links.configuration} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Configuration
                <ExternalLink className="size-3 ml-1" />
              </a>
              <a 
                href={links.events} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Events
                <ExternalLink className="size-3 ml-1" />
              </a>
              <a 
                href={links.logLevels} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Log Levels
                <ExternalLink className="size-3 ml-1" />
              </a>
              <a 
                href={links.status} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Status
                <ExternalLink className="size-3 ml-1" />
              </a>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
