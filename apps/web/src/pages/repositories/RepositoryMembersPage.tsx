import { motion } from "framer-motion";
import {
  ChevronLeft,
  Crown,
  MoreHorizontal,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

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

export function RepositoryMembersPage() {
  const { repoId } = useParams();
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">

        <button
          onClick={() => navigate(`/repositories/${repoId}`)}
          className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={16} />
          Back to repository
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
        >
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <Users size={13} />
              Repository access
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Members
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Manage the people who can access and collaborate on this
              repository.
            </p>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20">
            <UserPlus size={17} />
            Add member
          </button>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-border/70 bg-card"
        >
          <div className="border-b border-border/70 p-5 sm:p-6">
            <p className="font-semibold">
              Repository Members
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {members.length} people currently have access.
            </p>
          </div>

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
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium">
                    {member.role === "Owner" ? (
                      <Crown size={13} className="text-warning" />
                    ) : (
                      <ShieldCheck size={13} className="text-primary" />
                    )}

                    {member.role}
                  </span>

                  <button className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">
                    <MoreHorizontal size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </main>
  );
}