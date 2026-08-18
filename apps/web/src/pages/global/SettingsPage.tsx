import { Bell, Moon, Settings, Shield, SlidersHorizontal } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from "../../components/ui";


/* =========================================================
   SETTINGS DATA
========================================================= */

const settingsCards = [
  {
    title: "Theme",
    description: "Use the dark dashboard palette",
    icon: Moon,
  },
  {
    title: "Notifications",
    description: "Show analysis and gate alerts",
    icon: Bell,
  },
  {
    title: "Privacy",
    description: "Keep tenant data scoped to the selected org",
    icon: Shield,
  },
];


/* =========================================================
   COMPONENT
========================================================= */

export function SettingsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <PageHeader>
          <div>
            <PageHeaderTitle>Settings</PageHeaderTitle>
            <PageHeaderDescription>
              Basic workspace controls for the dashboard.
            </PageHeaderDescription>
          </div>
        </PageHeader>


        {/* Settings Grid */}
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">

          {/* Preferences */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-primary" />
                <CardTitle>Preferences</CardTitle>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {settingsCards.map((item) => {
                  const Icon = item.icon;

                  return (
                    <article
                      key={item.title}
                      className="
                        rounded-xl border border-border/70 bg-background p-4
                        transition hover:border-primary/30 hover:bg-muted/30
                      "
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon size={14} className="text-primary" />
                        {item.title}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </article>
                  );
                })}
              </div>
            </CardContent>
          </Card>


          {/* Workspace Controls */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-primary" />
                <CardTitle>Workspace controls</CardTitle>
              </div>
            </CardHeader>

            <CardContent>
              <p className="text-sm text-muted-foreground">
                These settings are intentionally lightweight for the current
                project stage.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>
    </main>
  );
}
