import { useEffect, useMemo, useRef } from 'react';
import { ArrowUpRight, BookOpen, Layers, Play, Sparkles, Target, Pin, Puzzle } from 'lucide-react';

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

export function OnboardingApp() {
  const launchEditor = useMemo(
    () => () => {
      const url = chrome.runtime.getURL('src/editor/index.html');
      chrome.tabs.create({ url, active: true });
    },
    []
  );

  const themeRef = useRef<'light' | 'dark' | 'system'>('dark');

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
      themeRef.current = theme === 'light' || theme === 'system' ? theme : 'dark';
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[oklch(0.8_0.15_60/0.35)] blur-3xl dark:bg-[oklch(0.55_0.18_60/0.25)]" />
        <div className="absolute top-40 -left-24 h-72 w-72 rounded-full bg-[oklch(0.75_0.12_220/0.35)] blur-3xl dark:bg-[oklch(0.45_0.12_220/0.3)]" />
        <div className="absolute bottom-0 right-1/3 h-48 w-48 rounded-full bg-[oklch(0.78_0.1_30/0.3)] blur-3xl dark:bg-[oklch(0.5_0.12_30/0.25)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-8">
        <div className="fixed right-40 top-3 z-10 hidden sm:block">
          <div className="relative animate-[pulse_2.4s_ease-in-out_infinite] rounded-xl border border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground shadow-sm">
            <span className="flex items-center gap-2">
              <Puzzle className="size-3.5 text-foreground" />
              Pin the composer, to quickly launch it
              <Pin className="size-3.5 text-foreground" />
            </span>
            <span className="absolute right-6 -top-2 h-3 w-3 rotate-45 border-l border-t border-border bg-card/90" />
          </div>
        </div>
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              LMDA Composer
              <span className="block text-xl text-muted-foreground md:text-2xl">
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
              className="rounded-md bg-foreground px-5 py-3 text-sm font-medium text-background shadow-sm hover:bg-foreground/90"
            >
              Open Composer
            </button>
            <a
              href="https://www.logicmonitor.com/"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border bg-card/70 px-5 py-3 text-sm font-medium text-foreground hover:border-border/70"
            >
              Go to LogicMonitor
            </a>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="rounded-xl border border-border bg-card/80 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-foreground">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <step.icon className="size-4" />
                </span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
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

          <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
            <h2 className="text-xl font-semibold">What You Can Do</h2>
            <ul className="mt-4 grid gap-2 text-sm text-muted-foreground">
              {features.map((feature) => (
                <li key={feature.label} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-foreground">
                    <feature.icon className="size-3.5" />
                  </span>
                  <span>{feature.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-foreground p-5 text-background shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Launch from LogicMonitor</h2>
              <p className="mt-1 text-sm text-background/80">
                Use “Open in LMDA Composer” in a resource’s Manage menu or from the LMX module tab
                to launch the composer with portal and device details pre-filled.
              </p>
            </div>
            <button
              onClick={launchEditor}
              className="rounded-md bg-background px-5 py-3 text-sm font-medium text-foreground hover:bg-background/90"
            >
              Start Editing
            </button>
          </div>
        </section>

        <footer className="mt-6 space-y-3">
          <div className="rounded-lg border border-border/50 bg-card/50 p-3 text-xs text-muted-foreground">
            <p>
              <span className="font-semibold text-amber-600 dark:text-amber-500">Independent Project:</span>{' '}
              LMDA Composer is an independent project created and maintained by LogicMonitor users. While not an official LogicMonitor product, it&apos;s designed by people who use and understand the platform. We hope you find this tool valuable for your LogicMonitor scripting workflows!
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            This page shows on first install only. You can always reopen the composer from the extension icon.
          </p>
        </footer>
      </div>
    </div>
  );
}
