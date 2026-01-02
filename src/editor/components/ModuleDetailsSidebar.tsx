import { Info, FolderTree, Shield, Filter, Database, Target, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModuleDetailsSection } from '@/shared/module-type-schemas';

interface ModuleDetailsSidebarProps {
  activeSection: ModuleDetailsSection;
  onSectionChange: (section: ModuleDetailsSection) => void;
  sections: ModuleDetailsSection[];
  dirtySections?: Set<string>;
}

interface SectionItem {
  id: ModuleDetailsSection;
  label: string;
  icon: typeof Info;
}

export function ModuleDetailsSidebar({
  activeSection,
  onSectionChange,
  sections,
  dirtySections = new Set(),
}: ModuleDetailsSidebarProps) {
  const sectionMetadata: Record<ModuleDetailsSection, SectionItem> = {
    basic: { id: 'basic', label: 'Basic Info', icon: Info },
    organization: { id: 'organization', label: 'Organization', icon: FolderTree },
    access: { id: 'access', label: 'Access', icon: Shield },
    appliesTo: { id: 'appliesTo', label: 'Applies To', icon: Filter },
    activeDiscovery: { id: 'activeDiscovery', label: 'Active Discovery', icon: Target },
    datapoints: { id: 'datapoints', label: 'Datapoints', icon: Database },
    configChecks: { id: 'configChecks', label: 'Config Checks', icon: Database },
    alertSettings: { id: 'alertSettings', label: 'Alert Settings', icon: Bell },
  };

  return (
    <div className="w-64 shrink-0 border-r border-border bg-muted/20 flex flex-col">
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {sections.map((sectionId) => {
          const section = sectionMetadata[sectionId];
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          
          return (
            <button
              key={sectionId}
              onClick={() => onSectionChange(sectionId)}
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
