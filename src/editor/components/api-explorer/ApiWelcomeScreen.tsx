import {
  Braces,
  ExternalLink,
  AlertCircle,
  Gauge,
  BookOpen,
  Code,
  ChevronRight,
  Calculator,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import { COLORS } from '@/editor/constants/colors';
import logoIcon from '@/assets/icon128.png';

// ============================================================================
// Constants - API Reference Data
// ============================================================================

const ERROR_CODES = [
  { http: 202, lm: 1202, description: 'Request accepted, processing incomplete' },
  { http: 400, lm: 1400, description: 'Bad request (resource dependency conflict)' },
  { http: 401, lm: 1401, description: 'Authentication failed' },
  { http: 403, lm: 1403, description: 'Permission denied' },
  { http: 404, lm: 1404, description: 'Resource not found' },
  { http: 409, lm: 1409, description: 'Resource already exists' },
  { http: 412, lm: 1412, description: 'Two-factor auth precondition not met' },
  { http: 413, lm: 1413, description: 'Request entity too large' },
  { http: 429, lm: 1429, description: 'Rate limit exceeded' },
  { http: 500, lm: 1500, description: 'Internal server error' },
] as const;

const RATE_LIMITS = [
  { method: 'GET' as const, limit: '500/min' },
  { method: 'POST' as const, limit: '200/min' },
  { method: 'PUT' as const, limit: '200/min' },
  { method: 'PATCH' as const, limit: '250/min' },
  { method: 'DELETE' as const, limit: '300/min' },
];

const EXTERNAL_LINKS = [
  {
    title: 'REST API Authentication',
    description: 'Learn how to authenticate with LMv1 or Bearer tokens',
    url: 'https://www.logicmonitor.com/support/rest-api-authentication',
  },
  {
    title: 'Rate Limits Guide',
    description: 'Understand rate limiting and how to handle 429 responses',
    url: 'https://www.logicmonitor.com/support/rest-api-developers-guide/overview/rest-api-rate-limit',
  },
  {
    title: 'Swagger API Reference (v3)',
    description: 'Browse the complete API specification with examples',
    url: 'https://www.logicmonitor.com/swagger-ui-master/api-v3/dist/',
  },
] as const;

// ============================================================================
// Visual Components
// ============================================================================

function GradientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Purple accent glow - top right */}
      <div className="
        absolute -top-24 -right-24 size-64 rounded-full bg-purple-400/25
        blur-3xl
        dark:bg-purple-500/15
      " />
      {/* Teal accent glow - left side */}
      <div className="
        absolute top-40 -left-24 size-72 rounded-full bg-teal-400/25 blur-3xl
        dark:bg-teal-500/15
      " />
      {/* Cyan accent glow - bottom */}
      <div className="
        absolute right-1/3 bottom-0 size-48 rounded-full bg-cyan-400/20 blur-3xl
        dark:bg-cyan-500/10
      " />
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface ActionRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

function ActionRow({
  icon,
  title,
  description,
  onClick,
  disabled,
  disabledReason,
}: ActionRowProps) {
  const button = (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        `
          flex w-full items-center gap-3 rounded-md border px-3.5 py-2.5
          text-left transition-all
        `,
        `
          focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 focus-visible:outline-none
        `,
        disabled
          ? "cursor-not-allowed border-border/40 bg-muted/20 opacity-50"
          : `
            border-border/60 bg-card/40
            hover:border-primary/40 hover:bg-accent/50 hover:shadow-sm
          `
      )}
    >
      <div
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-md transition-colors",
          disabled ? "bg-muted/30 text-muted-foreground" : `
            bg-primary/10 text-primary
            group-hover:bg-primary/20
          `
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            "text-sm font-medium tracking-tight",
            disabled ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {title}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {description}
        </div>
      </div>
    </button>
  );

  if (disabled && disabledReason) {
    return (
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

interface ExternalLinkRowProps {
  title: string;
  description: string;
  url: string;
}

function ExternalLinkRow({ title, description, url }: ExternalLinkRowProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        `
          group flex w-full items-center gap-3 rounded-md border px-3.5 py-2.5
          text-left transition-all
        `,
        `
          border-border/60 bg-card/40
          hover:border-primary/40 hover:bg-accent/50 hover:shadow-sm
        `,
        `
          focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 focus-visible:outline-none
        `
      )}
    >
      <div className="
        grid size-9 shrink-0 place-items-center rounded-md bg-primary/10
        text-primary transition-colors
        group-hover:bg-primary/20
      ">
        <ExternalLink className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="
          text-sm font-medium tracking-tight text-foreground transition-colors
          group-hover:text-primary
        ">
          {title}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {description}
        </div>
      </div>
    </a>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ApiWelcomeScreen() {
  const {
    selectedPortalId,
    openApiExplorerTab,
    setActiveWorkspace,
  } = useEditorStore();

  const handleBackToComposer = () => {
    setActiveWorkspace('script');
  };

  return (
    <div className="relative flex h-full flex-col overflow-auto bg-background select-none" tabIndex={-1}>
      <GradientBackground />
      
      <div className="relative z-10 flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-5xl space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-2 select-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={logoIcon} alt="LMDA Composer" className="
                  size-10 drop-shadow-sm
                " draggable={false} />
                <div className="leading-tight">
                  <h1 className="
                    text-2xl font-semibold tracking-tight text-foreground
                  ">
                    API Explorer
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Explore the LogicMonitor REST API with your active session
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToComposer}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Code className="size-4" />
                  Script Editor
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveWorkspace('collector-sizing')}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Calculator className="size-4" />
                  Collector Sizing
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="
            grid grid-cols-1 gap-6
            lg:grid-cols-2
          ">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Quick Start */}
              <Card size="sm" className="
                border-border/60 bg-card/60 shadow-sm backdrop-blur-sm
              ">
                <CardHeader className="pb-0">
                  <CardTitle className="
                    text-xs font-medium tracking-wide text-muted-foreground
                    uppercase
                  ">
                    Quick Start
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <ActionRow
                    icon={<Braces className="size-4" />}
                    title="New API Request"
                    description={selectedPortalId 
                      ? "Create a new request to explore the LM REST API" 
                      : "Connect to a portal first"}
                    onClick={openApiExplorerTab}
                    disabled={!selectedPortalId}
                    disabledReason="Connect to a LogicMonitor portal to send API requests"
                  />
                </CardContent>
              </Card>

              {/* Rate Limits */}
              <Card size="sm" className="
                border-border/60 bg-card/60 shadow-sm backdrop-blur-sm
              ">
                <CardHeader className="pb-0">
                  <CardTitle className="
                    flex items-center gap-2 text-xs font-medium tracking-wide
                    text-muted-foreground uppercase
                  ">
                    <Gauge className="size-3.5" />
                    Default Rate Limits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2">
                    {RATE_LIMITS.map(({ method, limit }) => {
                      const methodStyle = COLORS.METHOD[method];
                      return (
                        <div
                          key={method}
                          className={cn(
                            `
                              flex flex-col items-center justify-center
                              rounded-md border border-border/50 p-2.5
                            `,
                            methodStyle.bgSubtle
                          )}
                        >
                          <span className={cn("font-mono text-xs font-semibold", methodStyle.text)}>
                            {method}
                          </span>
                          <span className="
                            mt-0.5 text-[10px] text-muted-foreground
                          ">
                            {limit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="
                    mt-2 text-center text-[10px] text-muted-foreground
                  ">
                    Limits are per portal, not per user. Check response headers for remaining quota.
                  </p>
                </CardContent>
              </Card>

              {/* Resources */}
              <Card size="sm" className="
                border-border/60 bg-card/60 shadow-sm backdrop-blur-sm
              ">
                <CardHeader className="pb-0">
                  <CardTitle className="
                    flex items-center gap-2 text-xs font-medium tracking-wide
                    text-muted-foreground uppercase
                  ">
                    <BookOpen className="size-3.5" />
                    Resources
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {EXTERNAL_LINKS.map((link) => (
                    <ExternalLinkRow
                      key={link.url}
                      title={link.title}
                      description={link.description}
                      url={link.url}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Error Codes Reference */}
            <Card size="sm" className="
              border-border/60 bg-card/60 shadow-sm backdrop-blur-sm
            ">
              <CardHeader className="pb-0">
                <CardTitle className="
                  flex items-center gap-2 text-xs font-medium tracking-wide
                  text-muted-foreground uppercase
                ">
                  <AlertCircle className="size-3.5" />
                  API Error Codes (v3)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="
                  overflow-hidden rounded-md border border-border/50
                  bg-background/50
                ">
                  {/* Table Header */}
                  <div className="
                    grid grid-cols-[60px_60px_1fr] border-b border-border/50
                    bg-muted/40 px-3 py-1.5
                  ">
                    <span className="
                      text-[10px] font-medium tracking-wide
                      text-muted-foreground uppercase
                    ">
                      HTTP
                    </span>
                    <span className="
                      text-[10px] font-medium tracking-wide
                      text-muted-foreground uppercase
                    ">
                      LM Code
                    </span>
                    <span className="
                      text-[10px] font-medium tracking-wide
                      text-muted-foreground uppercase
                    ">
                      Description
                    </span>
                  </div>
                  {/* Table Body */}
                  <div className="
                    scrollbar-thin scrollbar-thumb-border
                    scrollbar-track-transparent max-h-[350px] divide-y
                    divide-border/30 overflow-y-auto
                  ">
                    {ERROR_CODES.map(({ http, lm, description }) => (
                      <div
                        key={http}
                        className="
                          grid grid-cols-[60px_60px_1fr] px-3 py-2
                          transition-colors
                          hover:bg-muted/20
                        "
                      >
                        <span className={cn(
                          "font-mono text-xs font-medium",
                          http >= 500 ? "text-red-500" :
                          http >= 400 ? "text-yellow-500" :
                          http >= 200 ? "text-teal-500" : `
                            text-muted-foreground
                          `
                        )}>
                          {http}
                        </span>
                        <span className="
                          font-mono text-xs text-muted-foreground
                        ">
                          {lm}
                        </span>
                        <span className="text-xs text-foreground">
                          {description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="
                  mt-2 text-center text-[10px] text-muted-foreground
                ">
                  The <code className="rounded-sm bg-muted/50 px-1 font-mono">errorCode</code> field appears in the response body for failed requests.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Footer Tip */}
          <div className="flex w-full items-center justify-center select-none">
            <div className="
              flex items-center gap-2 text-xs text-muted-foreground
            ">
              <span>Tip</span>
              <div className="flex items-center gap-0.5">
                <Kbd>⌘</Kbd>
                <Kbd>⇧</Kbd>
                <Kbd>P</Kbd>
              </div>
              <span>opens the command palette</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
