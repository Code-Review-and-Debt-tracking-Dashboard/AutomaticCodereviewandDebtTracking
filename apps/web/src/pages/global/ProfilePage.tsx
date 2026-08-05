import { CheckCircle2, Mail, User, Users } from "lucide-react";

const profileStats = [
  { label: "Organizations", value: "2", icon: Users },
  { label: "Repositories", value: "14", icon: CheckCircle2 },
  { label: "Email", value: "nethmi@example.com", icon: Mail },
];

export function ProfilePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Profile
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Account details and workspace identity.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <User size={14} />
            Nethmi Bhagya
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-2xl border border-border/70 bg-card p-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
              NB
            </div>
            <h2 className="mt-4 text-xl font-semibold">Nethmi Bhagya</h2>
            <p className="mt-1 text-sm text-muted-foreground">Frontend engineer</p>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-6">
            <p className="font-semibold">Profile details</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {profileStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <article key={stat.label} className="rounded-xl border border-border/70 bg-background p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon size={13} />
                      {stat.label}
                    </div>
                    <p className="mt-2 text-sm font-semibold">{stat.value}</p>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
