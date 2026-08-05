import { Bell, Moon, Settings, Shield, SlidersHorizontal } from "lucide-react";

const settingsCards = [
  { title: "Theme", description: "Use the dark dashboard palette", icon: Moon },
  { title: "Notifications", description: "Show analysis and gate alerts", icon: Bell },
  { title: "Privacy", description: "Keep tenant data scoped to the selected org", icon: Shield },
];

export function SettingsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Settings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Basic workspace controls for the dashboard.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal size={16} className="text-primary" />
              Preferences
            </div>
            <div className="mt-4 space-y-3">
              {settingsCards.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-xl border border-border/70 bg-background p-4">
                    <div className="flex items-center gap-2 font-medium">
                      <Icon size={14} className="text-primary" />
                      {item.title}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Settings size={16} className="text-primary" />
              Workspace controls
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              These settings are intentionally lightweight for the current project stage.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
