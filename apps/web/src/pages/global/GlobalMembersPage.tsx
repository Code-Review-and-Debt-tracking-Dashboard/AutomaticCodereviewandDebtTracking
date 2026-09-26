import { useEffect, useState } from "react";
import { ShieldCheck, Users } from "lucide-react";

import { useOrg } from "../../contexts/OrgContext";
import { api } from "../../lib/apiClient";

import {
  Badge,
  Card,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
} from "../../components/ui";


export function GlobalMembersPage() {
  const { selectedOrg } = useOrg();
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!selectedOrg) {
      setIsLoading(false);
      return;
    }

    const loadMembers = async () => {
      try {
        const response = await api.get<{ data: any[] }>(`/api/orgs/${selectedOrg.id}/members`);
        setMembers(response?.data ?? []);
      } catch (error) {
        console.error("Failed to load members", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMembers();
  }, [selectedOrg]);

  return (
    <>

      {/* Header */}
      <PageHeader>
        <div>
          <PageHeaderTitle>Members</PageHeaderTitle>
          <PageHeaderDescription>
            People who belong to this organization on GitHub. Membership is synced from
            GitHub, so it is changed there rather than here. To give someone access to a
            single repository, open that repository and use its Members page.
          </PageHeaderDescription>
        </div>

        <PageHeaderActions>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Users size={14} />
            {isLoading ? "…" : `${members.length} members`}
          </div>
        </PageHeaderActions>
      </PageHeader>


      {/* Member Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {!isLoading && members.map((member) => (
          <Card key={member.userId} className="p-5 transition hover:border-primary/40">
            <div className="flex items-center gap-4">
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt={member.username}
                  className="h-11 w-11 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                  {member.username?.charAt(0)?.toUpperCase() || "U"}
                </div>
              )}

              <div>
                <p className="text-sm font-semibold">{member.username}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {member.role}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <Badge variant="success" size="sm">
                <ShieldCheck size={12} className="mr-1" />
                Active
              </Badge>
              <span>Organization member</span>
            </div>
          </Card>
        ))}

        {!isLoading && members.length === 0 && (
          <p className="text-sm text-muted-foreground md:col-span-3">
            No members found for this organization. Membership is synced from GitHub when you
            sign in.
          </p>
        )}
      </div>

    </>
  );
}
