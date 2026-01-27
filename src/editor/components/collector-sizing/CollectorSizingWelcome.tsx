/**
 * CollectorSizingWelcome - Welcome/empty state for the collector sizing calculator.
 * Shown when no sites are configured yet.
 */

import { Server, Plus, Calculator, MapPin, CheckCircle2, ChevronRight, Code, Braces } from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// Constants
// ============================================================================

const FEATURES = [
  'Calculate collector requirements for polling, logs, and NetFlow',
  'Multi-site support for distributed environments',
  'Customizable method weights and load thresholds',
  'Visual recommendations with utilization indicators',
  'Persistent state - your data is saved automatically',
];

const STEPS = [
  {
    title: 'Add a Site',
    description: 'Create a site configuration for each datacenter or location',
    icon: MapPin,
  },
  {
    title: 'Enter Device Counts',
    description: 'Specify how many of each device type you have',
    icon: Server,
  },
  {
    title: 'Review Recommendations',
    description: 'See the optimal collector size and count for your environment',
    icon: Calculator,
  },
];

// ============================================================================
// Main Component
// ============================================================================

export function CollectorSizingWelcome() {
  const { addSite, setActiveWorkspace } = useEditorStore();

  const handleGetStarted = () => {
    addSite('Site 1');
  };

  return (
    <div className="flex h-full flex-col overflow-auto bg-background">
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-4xl animate-in space-y-8 duration-500 fade-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10">
              <Server className="size-7 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Collector Sizing Calculator
              </h1>
              <p className="mx-auto max-w-lg text-sm text-muted-foreground">
                Calculate the optimal LogicMonitor collector configuration for your environment.
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className={cn(
                  'flex flex-col gap-2 rounded-lg border border-border/40 bg-card/20 p-4',
                  'transition-colors hover:bg-card/40'
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {i + 1}
                  </div>
                  <step.icon className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{step.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <div className="flex justify-center">
            <Button onClick={handleGetStarted} size="lg" className="gap-2">
              <Plus className="size-4" />
              Create Your First Site
            </Button>
          </div>

          {/* Features */}
          <div className="rounded-lg border border-border/40 bg-card/20 p-4">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Features
            </h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {FEATURES.map((feature, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                  <span className="text-xs text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Switch to other workspaces */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveWorkspace('script')}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <Code className="size-4" />
              Script Editor
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveWorkspace('api')}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <Braces className="size-4" />
              API Explorer
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
