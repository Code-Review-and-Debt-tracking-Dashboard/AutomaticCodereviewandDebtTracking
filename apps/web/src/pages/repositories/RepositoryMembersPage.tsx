import {
  Crown,
  MoreHorizontal,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useParams } from "react-router-dom";

import {
  BackLink,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  PageHeader,
  PageHeaderBadge,
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
    email: "nethmi@example.com",
    role: "Owner",
    joined: "Jun 12, 2026",
    avatar: "NB",
  },
  {
    name: "Kasun Perera",
    email: "kasun@example.com",
    role: "Developer",
    joined: "Jun 18, 2026",
    avatar: "KP",
  },
  {
    name: "Amaya Silva",
    email: "amaya@example.com",
    role: "Reviewer",
    joined: "Jun 22, 2026",
    avatar: "AS",
  },
];


/* =========================================================
   COMPONENT
========================================================= */

export function RepositoryMembersPage() {
  const { repoId } = useParams();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">

        <BackLink to={`/repositories/${repoId}`} label="Back to repository" />

        {/* Header */}
        <PageHeader>
          <div>
            <PageHeaderBadge>
              <Users size={13} />
              Repository access
            </PageHeaderBadge>

            <PageHeaderTitle>Members</PageHeaderTitle>

            <PageHeaderDescription>
              Manage the people who can access and collaborate on this
              repository.
            </PageHeaderDescription>
          </div>

          <PageHeaderActions>
            <Button>
              <UserPlus size={17} />
              Add member
            </Button>
          </PageHeaderActions>
        </PageHeader>


        {/* Member List Card */}
        <Card>
          <CardHeader className="border-b border-border/70">
            <div>
              <CardTitle>Repository Members</CardTitle>
              <CardDescription>
                {members.length} people currently have access.
              </CardDescription>
            </div>
          </CardHeader>

          <div className="divide-y divide-border/60">
            {members.map((member) => (
              <div
                key={member.email}
                className="flex flex-col gap-4 p-5 transition hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                    {member.avatar}
                  </div>

                  <div>
                    <p className="font-semibold">
                      {member.name}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {member.email}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Joined {member.joined}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Badge variant="muted" size="lg">
                    {member.role === "Owner" ? (
                      <Crown size={13} className="text-warning" />
                    ) : (
                      <ShieldCheck size={13} className="text-primary" />
                    )}
                    {member.role}
                  </Badge>

                  <Button variant="ghost" size="icon">
                    <MoreHorizontal size={18} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </main>
  );
}