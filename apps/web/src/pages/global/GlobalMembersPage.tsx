import { ShieldCheck, Users } from "lucide-react";

import {
  Badge,
  Card,
  IconBox,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
} from "../../components/ui";


/* =========================================================
   MEMBER DATA
========================================================= */

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


/* =========================================================
   COMPONENT
========================================================= */

export function GlobalMembersPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <PageHeader>
          <div>
            <PageHeaderTitle>Members</PageHeaderTitle>
            <PageHeaderDescription>
              People who can access the selected organization.
            </PageHeaderDescription>
          </div>

          <PageHeaderActions>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Users size={14} />
              {members.length} members
            </div>
          </PageHeaderActions>
        </PageHeader>


        {/* Member Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {members.map((member) => (
            <Card key={member.name} className="p-5 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                  {member.initials}
                </div>

                <div>
                  <p className="text-sm font-semibold">{member.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {member.role}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <Badge variant="success" size="sm">
                  <ShieldCheck size={12} className="mr-1" />
                  {member.status}
                </Badge>
                <span>Organization member</span>
              </div>
            </Card>
          ))}
        </div>

      </div>
    </main>
  );
}
