import { Info, FolderTree, Shield, Filter, Database, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogicModuleType } from '@/shared/types';

interface ModuleDetailsSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  moduleType: LogicModuleType;
  enableAutoDiscovery: boolean;
  hasDatapoints: boolean;
  dirtySections?: Set<string>;
}

interface SectionItem {
  id: string;
  label: string;
  icon: typeof Info;
  available: boolean;
}

export function ModuleDetailsSidebar({
  activeSection,
  onSectionChange,
  enableAutoDiscovery,
  hasDatapoints,
  dirtySections = new Set(),
}: ModuleDetailsSidebarProps) {
  const sections: SectionItem[] = [
    { id: 'basic', label: 'Basic Info', icon: Info, available: true },
    { id: 'organization', label: 'Organization', icon: FolderTree, available: true },
    { id: 'access', label: 'Access', icon: Shield, available: true },
    { id: 'appliesTo', label: 'Applies To', icon: Filter, available: true },
    { id: 'activeDiscovery', label: 'Active Discovery', icon: Target, available: enableAutoDiscovery },
    { id: 'datapoints', label: 'Datapoints', icon: Database, available: hasDatapoints },
  ];

  const availableSections = sections.filter(s => s.available);

  return (
    <div className="w-64 shrink-0 border-r border-border bg-muted/20 flex flex-col">
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {availableSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all relative text-left',
                'hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{section.label}</span>
              {dirtySections.has(section.id) && (
                <span className="size-2 rounded-full bg-primary shrink-0" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

