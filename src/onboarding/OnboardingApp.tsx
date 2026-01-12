import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, ExternalLink, Layers, Play, Sparkles, Target, Pin, Puzzle, Terminal, X, Check, History } from 'lucide-react';
import { getLatestRelease } from '@/shared/release-notes';
import { DOCS_URLS, LMDA_MODULE_DOCS_URLS } from '@/shared/app-config';

const steps = [
  {
    title: 'Open the Composer',
    body: 'Click the extension icon, or use the “Open in LMDA Composer” link in the resource menu or LMX module tab.',
    icon: ArrowUpRight,
  },
  {
    title: 'Choose a target',
    body: 'Pick a portal and collector. Select a device if your script needs host properties.',
    icon: Target,
  },
  {
    title: 'Run and validate',
    body: 'Pick a mode (Freeform, AD, Collection, Batch) to validate output and see parsed results.',
    icon: Play,
  },
];

const features = [
  { label: 'Run Groovy and PowerShell against any collector', icon: Sparkles },
  { label: 'Switch between Freeform, AD, Collection, and Batch modes', icon: Layers },
  { label: 'Browse modules, compare lineage, and commit back', icon: BookOpen },
  { label: 'Use snippets and templates to move faster', icon: Sparkles },
  { label: 'Review execution history and parsed output', icon: Layers },
  { label: 'Open and save local script files', icon: BookOpen },
];

function RecentChanges() {
  const latestRelease = getLatestRelease();
  
  if (!latestRelease) return null;
  
  return (
    <section className="
      mt-8 rounded-2xl border border-border bg-card/80 p-5 shadow-sm
    ">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="
            inline-flex size-8 items-center justify-center rounded-lg
            bg-purple-500/10 text-purple-500
          ">
            <History className="size-4" />
          </span>
          <h2 className="text-xl font-semibold">Recent Changes</h2>
        </div>
        <span className="
          rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium
          text-purple-500
        ">
          v{latestRelease.version}
        </span>
      </div>
      <ul className="mt-4 grid gap-2 text-sm text-muted-foreground">
        {latestRelease.highlights.map((highlight, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="
              mt-0.5 inline-flex size-5 shrink-0 items-center justify-center
              rounded-full bg-emerald-500/10 text-emerald-500
            ">
              <Check className="size-3" />
            </span>
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
      <a
        href={DOCS_URLS.changelog}
        target="_blank"
        rel="noreferrer"
        className="
          mt-4 inline-flex items-center gap-1.5 text-sm font-medium
          text-purple-500 transition-colors
          hover:text-purple-400
        "
      >
        View full changelog
        <ExternalLink className="size-3" />
      </a>
    </section>
  );
}

export function OnboardingApp() {
  const [showPsPromo, setShowPsPromo] = useState(true);

  const launchEditor = useMemo(
    () => () => {
      const url = chrome.runtime.getURL('src/editor/index.html');
      chrome.tabs.create({ url, active: true });
    },
    []
  );

  const themeRef = useRef<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const isDark =
        themeRef.current === 'dark' ||
        (themeRef.current === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', isDark);
    };

    chrome.storage.local.get('lm-ide-preferences').then((result) => {
      const stored = result as Record<string, { theme?: string } | undefined>;
      const theme = stored['lm-ide-preferences']?.theme;
      themeRef.current = theme === 'light' || theme === 'dark' ? theme : 'system';
      applyTheme();
    }).catch(() => {
      applyTheme();
    });

    const handleChange = () => applyTheme();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
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
          absolute right-1/3 bottom-0 size-48 rounded-full bg-cyan-400/20
          blur-3xl
          dark:bg-cyan-500/10
        " />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-4">
        <div className="
          fixed top-3 right-40 z-10 hidden
          sm:block
        ">
          <div className="
            relative animate-[pulse_2.4s_ease-in-out_infinite] rounded-xl border
            border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground
            shadow-sm
          ">
            <span className="flex items-center gap-2">
              <Puzzle className="size-3.5 text-foreground" />
              Pin the composer, to quickly launch it
              <Pin className="size-3.5 text-foreground" />
            </span>
            <span className="
              absolute -top-2 right-6 size-3 rotate-45 border-t border-l
              border-border bg-card/90
            " />
          </div>
        </div>
        {showPsPromo && (
          <div className="
            fixed right-4 bottom-4 z-20 max-w-xs animate-in duration-300 fade-in
            slide-in-from-bottom-4
          ">
            <div className="rounded-xl border border-border bg-card shadow-lg">
              <div className="flex items-start gap-3 p-4">
                <span className="
                  mt-0.5 inline-flex size-8 shrink-0 items-center justify-center
                  rounded-lg bg-cyan-500/10 text-cyan-500
                ">
                  <Terminal className="size-4" />
                </span>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground">Automate LM with PowerShell!</p>
                  <p className="text-xs text-muted-foreground">
                    Use the Logic.Monitor PowerShell module to manage your LM environment programmatically.
                  </p>
                  <a
                    href={LMDA_MODULE_DOCS_URLS.docs}
                    target="_blank"
                    rel="noreferrer"
                    className="
                      inline-flex items-center gap-1 text-xs font-medium
                      text-cyan-500 transition-colors
                      hover:text-cyan-400
                    "
                  >
                    Learn more
                    <ExternalLink className="size-3" />
                  </a>
                </div>
                <button
                  onClick={() => setShowPsPromo(false)}
                  className="
                    shrink-0 rounded-md p-1 text-muted-foreground
                    transition-colors
                    hover:bg-secondary hover:text-foreground
                  "
                  aria-label="Dismiss"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}
        <header className="
          flex flex-col gap-6
          md:flex-row md:items-end md:justify-between
        ">
          <div className="space-y-4">
            <h1 className="
              text-4xl font-semibold tracking-tight
              md:text-5xl
            ">
              LMDA Composer
              <span className="
                block text-xl text-muted-foreground
                md:text-2xl
              ">
                A focused workspace for LogicMonitor scripting.
              </span>
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              LMDA Composer replaces the native debug dialog with a dedicated editor tab for
              running Groovy and PowerShell. Use it to test modules faster, validate output,
              and keep scripts organized.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={launchEditor}
              className="
                rounded-md bg-foreground px-5 py-3 text-sm font-medium
                text-background shadow-sm
                hover:bg-foreground/90
              "
            >
              Open Composer
            </button>
            <a
              href="https://www.logicmonitor.com/"
              target="_blank"
              rel="noreferrer"
              className="
                rounded-md border border-border bg-card/70 px-5 py-3 text-sm
                font-medium text-foreground
                hover:border-border/70
              "
            >
              Go to LogicMonitor
            </a>
          </div>
        </header>

        <section className="
          mt-8 grid gap-4
          md:grid-cols-3
        ">
          {steps.map((step) => (
            <div key={step.title} className="
              rounded-xl border border-border bg-card/80 p-4 shadow-sm
            ">
              <div className="flex items-center gap-2 text-foreground">
                <span className="
                  inline-flex size-8 items-center justify-center rounded-lg
                  bg-secondary text-foreground
                ">
                  <step.icon className="size-4" />
                </span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </section>

        <section className="
          mt-8 grid gap-6
          md:grid-cols-2
        ">
          <div className="
            rounded-2xl border border-border bg-card/80 p-5 shadow-sm
          ">
            <h2 className="text-xl font-semibold">Before You Run</h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Portal</span> picks the LogicMonitor
                account you are connected to.
              </p>
              <p>
                <span className="font-semibold text-foreground">Collector</span> controls where scripts run.
              </p>
              <p>
                <span className="font-semibold text-foreground">Device</span> supplies properties for
                scripts that need host values.
              </p>
              <p>
                <span className="font-semibold text-foreground">Mode</span> tells the composer how to
                parse and validate output.
              </p>
            </div>
          </div>

          <div className="
            rounded-2xl border border-border bg-card/80 p-5 shadow-sm
          ">
            <h2 className="text-xl font-semibold">What You Can Do</h2>
            <ul className="mt-4 grid gap-2 text-sm text-muted-foreground">
              {features.map((feature) => (
                <li key={feature.label} className="flex items-start gap-2">
                  <span className="
                    mt-0.5 inline-flex size-6 items-center justify-center
                    rounded-md bg-secondary text-foreground
                  ">
                    <feature.icon className="size-3.5" />
                  </span>
                  <span>{feature.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Recent Changes Section */}
        <RecentChanges />

        <section className="
          mt-8 rounded-2xl border border-border bg-foreground p-5
          text-background shadow-sm
        ">
          <div className="
            flex flex-col gap-3
            md:flex-row md:items-center md:justify-between
          ">
            <div>
              <h2 className="text-xl font-semibold">Launch from LogicMonitor</h2>
              <p className="mt-1 text-sm text-background/80">
                Use “Open in LMDA Composer” in a resource’s Manage menu or from the LMX module tab
                to launch the composer with portal and device details pre-filled.
              </p>
            </div>
            <button
              onClick={launchEditor}
              className="
                rounded-md bg-background px-5 py-3 text-sm font-medium
                text-foreground
                hover:bg-background/90
              "
            >
              Start Editing
            </button>
          </div>
        </section>

        <footer className="mt-6 space-y-3">
          <div className="
            rounded-lg border border-border/50 bg-card/50 p-3 text-xs
            text-muted-foreground
          ">
            <p>
              <span className="
                font-semibold text-yellow-600
                dark:text-yellow-500
              ">Independent Project:</span>{' '}
              LMDA Composer is an independent project created and maintained by LogicMonitor users. While not an official LogicMonitor product, it&apos;s designed by people who use and understand the platform. We hope you find this tool valuable for your LogicMonitor scripting workflows!
            </p>
          </div>
          <div className="
            flex items-center justify-between text-xs text-muted-foreground
          ">
            <p>
              This page shows on first install only. You can always reopen the composer from the extension icon.
            </p>
            <a
              href={DOCS_URLS.home}
              target="_blank"
              rel="noreferrer"
              className="
                flex items-center gap-1.5 text-muted-foreground
                transition-colors
                hover:text-foreground
              "
            >
              <BookOpen className="size-3.5" />
              Documentation
              <ExternalLink className="size-3" />
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
