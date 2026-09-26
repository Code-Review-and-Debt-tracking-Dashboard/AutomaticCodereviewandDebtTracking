import { useCallback, useEffect, useState } from "react";
import {
  Crown,
  Eye,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import {
  DebtIcon,
  QualityGateIcon,
} from "../../components/icons";
import { useParams } from "react-router-dom";

import { api } from "../../lib/apiClient";
import { apiErrorMessage } from "../../lib/apiError";

import {
  BackLink,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  PageHeader,
  PageHeaderBadge,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
  Select,
} from "../../components/ui";

interface RepoMember {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  addedAt: string;
}

const ROLES = [
  {
    value: "TEAM_LEAD",
    label: "Team lead",
    icon: QualityGateIcon,
    help: "Can view everything and make changes, including running an analysis and managing members.",
  },
  {
    value: "DEVELOPER",
    label: "Developer",
    icon: DebtIcon,
    help: "Can view everything about this repository.",
  },
  {
    value: "VIEWER",
    label: "Viewer",
    icon: Eye,
    help: "Can view everything about this repository. Intended for people who do not work in the code.",
  },
] as const;

function roleMeta(role: string) {
  return ROLES.find((r) => r.value === role);
}

export function RepositoryMembersPage() {
  const { repoId } = useParams();
  const [members, setMembers] = useState<RepoMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<string>("VIEWER");
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!repoId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<{ data: RepoMember[] }>(`/api/repos/${repoId}/members`);
      setMembers(response?.data ?? []);
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to load members."));
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const submitMember = async () => {
    if (!username.trim()) return;

    setIsSubmitting(true);
    setAddError(null);
    try {
      await api.post(`/api/repos/${repoId}/members`, { username: username.trim(), role });
      setUsername("");
      setRole("VIEWER");
      setIsAdding(false);
      await loadMembers();
    } catch (err: any) {
      setAddError(apiErrorMessage(err, "Could not add that person."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeMember = async (member: RepoMember) => {
    setRemovingId(member.userId);
    try {
      await api.delete(`/api/repos/${repoId}/members/${member.userId}`);
      await loadMembers();
    } catch (err: any) {
      setError(apiErrorMessage(err, "Could not remove that person."));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>

      <BackLink to={`/repositories/${repoId}`} label="Back to repository" />

      <PageHeader>
        <div>
          <PageHeaderBadge>
            <Users size={13} />
            Access
          </PageHeaderBadge>

          <PageHeaderTitle>Members</PageHeaderTitle>

          <PageHeaderDescription>
            People who can see this repository in CodePulse. They must already belong to the
            organization on GitHub.
          </PageHeaderDescription>
        </div>

        <PageHeaderActions>
          <Button onClick={() => setIsAdding((open) => !open)}>
            <UserPlus size={17} />
            Add member
          </Button>
        </PageHeaderActions>
      </PageHeader>

      {isAdding && (
        <Card className="mt-6 p-5">
          <p className="text-sm font-semibold">Add someone to this repository</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="GitHub username"
              aria-label="GitHub username"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none sm:max-w-xs"
            />
            <Select
              value={role}
              onChange={setRole}
              options={ROLES.map((r) => ({ label: r.label, value: r.value }))}
            />
            <Button size="sm" disabled={isSubmitting || !username.trim()} onClick={submitMember}>
              {isSubmitting ? "Adding…" : "Add"}
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">{roleMeta(role)?.help}</p>

          {addError && (
            <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {addError}
            </p>
          )}
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Repository Members</CardTitle>
            <CardDescription>
              {isLoading
                ? "Loading…"
                : `${members.length} ${members.length === 1 ? "person has" : "people have"} access.`}
            </CardDescription>
          </div>
        </CardHeader>

        <div className="divide-y divide-border/60">
          {!isLoading &&
            members.map((member) => {
              const meta = roleMeta(member.role);
              const RoleIcon = meta?.icon ?? Crown;

              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-4 p-5 transition hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.username}
                        className="h-11 w-11 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div>
                      <p className="font-semibold">{member.username}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Added {new Date(member.addedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span title={meta?.help} className="cursor-help">
                      <Badge variant="muted" size="lg">
                        <RoleIcon size={13} className="text-primary" />
                        {meta?.label ?? member.role}
                      </Badge>
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${member.username}`}
                      disabled={removingId === member.userId}
                      onClick={() => removeMember(member)}
                    >
                      <Trash2 size={17} />
                    </Button>
                  </div>
                </div>
              );
            })}

          {!isLoading && members.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {error ?? "No one has been added yet. The repository owner always has access."}
            </div>
          )}
        </div>
      </Card>

    </>
  );
}
