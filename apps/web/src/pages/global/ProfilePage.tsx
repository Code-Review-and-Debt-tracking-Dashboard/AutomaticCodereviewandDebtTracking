import { useEffect, useState } from "react";
import { Mail, User, Users } from "lucide-react";

import {
  CheckIcon,
} from "../../components/icons";

import { useAuth } from "../../contexts/AuthContext";
import { useOrg } from "../../contexts/OrgContext";
import { api } from "../../lib/apiClient";

import {
  Badge,
  Card,
  CardTitle,
  CardContent,
  IconBox,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
} from "../../components/ui";

export function ProfilePage() {
  const { user } = useAuth();
  const { orgs, selectedOrg } = useOrg();
  const [repoCount, setRepoCount] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedOrg) {
      setRepoCount(0);
      return;
    }

    const loadData = async () => {
      try {
        const repos = await api.get<any>(`/api/orgs/${selectedOrg.id}/repos`);
        setRepoCount(Array.isArray(repos) ? repos.length : (repos?.data ?? []).length);
      } catch (error) {
        console.error("Failed to load repo count", error);
        setRepoCount(0);
      }
    };

    loadData();
  }, [selectedOrg]);

  if (!user) return null;

  const profileStats = [
    { label: "Organizations", value: orgs.length.toString(), icon: Users },
    { label: "Repositories", value: repoCount !== null ? repoCount.toString() : "…", icon: CheckIcon },
    { label: "Email", value: user.email ?? "", icon: Mail },
  ];

  return (
    <>

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
            {user.username}
          </Badge>
        </PageHeaderActions>
      </PageHeader>

      <div className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">

        {/* Avatar Card */}
        <Card className="p-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <h2 className="mt-4 text-xl font-semibold">{user.username}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{user.platformRole}</p>
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
    </>
  );
}
