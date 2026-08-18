import { FolderOpen, Search } from "lucide-react";
import { useParams } from "react-router-dom";

import {
  BackLink,
  Card,
  CardTitle,
  CardContent,
  IconBox,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from "../../components/ui";


/* =========================================================
   DATA
========================================================= */

const files = [
  "src/api/users.ts",
  "src/services/analyzer.ts",
  "src/components/Table.tsx",
  "src/utils/format.ts",
];


/* =========================================================
   COMPONENT
========================================================= */

export function RepositoryFilesPage() {
  const { repoId } = useParams();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        <BackLink to={`/repositories/${repoId}`} label="Back to repository" />

        {/* Header */}
        <PageHeader>
          <div>
            <PageHeaderTitle>Files</PageHeaderTitle>
            <PageHeaderDescription>
              A compact file browser for the latest analysis snapshot.
            </PageHeaderDescription>
          </div>
        </PageHeader>

        <div className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">

          {/* Snapshot Files Card */}
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <IconBox icon={FolderOpen} color="primary" size="sm" />
              <CardTitle>Snapshot files</CardTitle>
            </div>

            <CardContent className="mt-4 space-y-2 p-0">
              {files.map((file) => (
                <div key={file} className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
                  {file}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* File Preview Card */}
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <IconBox icon={Search} color="primary" size="sm" />
              <CardTitle>File preview</CardTitle>
            </div>

            <CardContent className="mt-4 p-0">
              <div className="rounded-xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                Select a file to inspect line-level findings for repository {repoId}.
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </main>
  );
}
