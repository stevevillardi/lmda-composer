import {
  Braces,
  ExternalLink,
  AlertCircle,
  Gauge,
  BookOpen,
  ArrowLeft,
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
        "flex items-center gap-3 w-full px-3.5 py-2.5 rounded-md border transition-colors text-left",
        disabled
          ? "border-border/40 bg-muted/20 cursor-not-allowed opacity-50"
          : "border-border/70 bg-card/30 hover:bg-accent hover:border-primary/40"
      )}
    >
      <div
        className={cn(
          "size-9 rounded-md grid place-items-center shrink-0",
          disabled ? "bg-muted/30 text-muted-foreground" : "bg-primary/10 text-primary"
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
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
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
        "flex items-center gap-3 w-full px-3.5 py-2.5 rounded-md border transition-colors text-left group",
        "border-border/70 bg-card/30 hover:bg-accent hover:border-primary/40"
      )}
    >
      <div className="size-9 rounded-md grid place-items-center shrink-0 bg-primary/10 text-primary">
        <ExternalLink className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium tracking-tight text-foreground group-hover:text-primary">
          {title}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
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
    <div className="h-full flex flex-col bg-background overflow-auto" tabIndex={-1}>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-5xl space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={logoIcon} alt="LMDA Composer" className="size-10" />
                <div className="leading-tight">
                  <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                    API Explorer
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Explore the LogicMonitor REST API with your active session
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToComposer}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4 mr-1.5" />
                Back to Composer
              </Button>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Quick Start */}
              <Card size="sm" className="bg-card/40 border-border/70">
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    Quick Start
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <ActionRow
                    icon={<Braces className="size-4" />}
                    title="New API Request"
                    description="Create a new request to explore the LM REST API"
                    onClick={openApiExplorerTab}
                    disabled={!selectedPortalId}
                    disabledReason="Connect to a portal first to send API requests"
                  />
                </CardContent>
              </Card>

              {/* Rate Limits */}
              <Card size="sm" className="bg-card/40 border-border/70">
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-2">
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
                            "flex flex-col items-center justify-center p-2.5 rounded-md border border-border/50",
                            methodStyle.bgSubtle
                          )}
                        >
                          <span className={cn("text-xs font-semibold font-mono", methodStyle.text)}>
                            {method}
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {limit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    Limits are per portal, not per user. Check response headers for remaining quota.
                  </p>
                </CardContent>
              </Card>

              {/* Resources */}
              <Card size="sm" className="bg-card/40 border-border/70">
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-2">
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
            <Card size="sm" className="bg-card/40 border-border/70">
              <CardHeader className="pb-0">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-2">
                  <AlertCircle className="size-3.5" />
                  API Error Codes (v3)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border border-border/50 rounded-md overflow-hidden">
                  {/* Table Header */}
                  <div className="grid grid-cols-[60px_60px_1fr] bg-muted/30 border-b border-border/50 px-3 py-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      HTTP
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      LM Code
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Description
                    </span>
                  </div>
                  {/* Table Body */}
                  <div className="divide-y divide-border/30 max-h-[350px] overflow-y-auto">
                    {ERROR_CODES.map(({ http, lm, description }) => (
                      <div
                        key={http}
                        className="grid grid-cols-[60px_60px_1fr] px-3 py-2 hover:bg-muted/20 transition-colors"
                      >
                        <span className={cn(
                          "text-xs font-mono font-medium",
                          http >= 500 ? "text-red-500" :
                          http >= 400 ? "text-yellow-500" :
                          http >= 200 ? "text-teal-500" : "text-muted-foreground"
                        )}>
                          {http}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {lm}
                        </span>
                        <span className="text-xs text-foreground">
                          {description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  The <code className="font-mono bg-muted px-1 rounded">errorCode</code> field appears in the response body for failed requests.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Footer Tip */}
          <div className="w-full flex items-center justify-center">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
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

