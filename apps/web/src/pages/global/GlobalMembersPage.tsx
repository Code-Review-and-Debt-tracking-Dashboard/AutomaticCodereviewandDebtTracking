import { Crown, ShieldCheck, Users } from "lucide-react";

const members = [
  {
    name: "Nethmi Bhagya",
    role: "Owner",
    status: "Active",
    initials: "NB",
  },
  {
    name: "Rumesh Perera",
    role: "Admin",
    status: "Active",
    initials: "RP",
  },
  {
    name: "Vidushi Silva",
    role: "Member",
    status: "Active",
    initials: "VS",
  },
];

export function GlobalMembersPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Members
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              People who can access the selected organization.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Users size={14} />
            {members.length} members
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {members.map((member) => (
            <article key={member.name} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                  {member.initials}
                </div>
                <div>
                  <p className="font-semibold">{member.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{member.role}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-success">
                  <ShieldCheck size={12} />
                  {member.status}
                </span>
                <span>
                  Organization member
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
