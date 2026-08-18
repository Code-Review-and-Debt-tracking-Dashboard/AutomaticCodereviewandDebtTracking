import { CheckCircle2, Mail, User, Users } from "lucide-react";

import {
  Badge,
  Card,
  CardContent,
  CardTitle,
  IconBox,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
} from "../../components/ui";


/* =========================================================
   PROFILE DATA
========================================================= */

const profileStats = [
  { label: "Organizations", value: "2", icon: Users },
  { label: "Repositories", value: "14", icon: CheckCircle2 },
  { label: "Email", value: "nethmi@example.com", icon: Mail },
];


/* =========================================================
   COMPONENT
========================================================= */

export function ProfilePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <PageHeader>
          <div>
            <PageHeaderTitle>Profile</PageHeaderTitle>
            <PageHeaderDescription>
              Account details and workspace identity.
            </PageHeaderDescription>
          </div>

          <PageHeaderActions>
            <Badge variant="outline" size="lg">
              <User size={14} />
              Nethmi Bhagya
            </Badge>
          </PageHeaderActions>
        </PageHeader>

        <div className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">

          {/* Avatar Card */}
          <Card className="p-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
              NB
            </div>
            <h2 className="mt-4 text-xl font-semibold">Nethmi Bhagya</h2>
            <p className="mt-1 text-sm text-muted-foreground">Frontend engineer</p>
          </Card>

          {/* Profile Details Card */}
          <Card className="p-6">
            <CardTitle>Profile details</CardTitle>

            <CardContent className="mt-4 grid gap-3 p-0 sm:grid-cols-3">
              {profileStats.map((stat) => (
                <article key={stat.label} className="rounded-xl border border-border/70 bg-background p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <IconBox icon={stat.icon} color="primary" size="sm" className="h-5 w-5 rounded-md" />
                    {stat.label}
                  </div>
                  <p className="mt-2 text-sm font-semibold">{stat.value}</p>
                </article>
              ))}
            </CardContent>
          </Card>

        </div>
      </div>
    </main>
  );
}
