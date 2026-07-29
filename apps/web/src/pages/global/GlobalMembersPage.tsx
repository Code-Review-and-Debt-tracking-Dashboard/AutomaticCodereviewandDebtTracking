import { Users } from "lucide-react";

export function GlobalMembersPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Members
        </h1>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card p-12 text-center">
          <Users
            size={28}
            className="text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">
            Organization member management is not implemented yet.
          </p>
        </div>
      </div>
    </main>
  );
}
