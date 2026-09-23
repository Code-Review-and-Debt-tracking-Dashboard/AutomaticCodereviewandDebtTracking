import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import {
  FilesIcon,
} from "../../components/icons";
import { useParams } from "react-router-dom";

import { api } from "../../lib/apiClient";

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

export function RepositoryFilesPage() {
  const { repoId } = useParams();
  const [files, setFiles] = useState<{ filePath: string; debtMinutes: number; totalFindings: number }[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!repoId) return;
    const loadFiles = async () => {
      try {
        const response = await api.get<{ files: any[] }>(`/repos/${repoId}/hotspots`);
        setFiles(response?.files ?? []);
      } catch (error) {
        console.error("Failed to load files", error);
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadFiles();
  }, [repoId]);

  return (
    <>

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
            <IconBox icon={FilesIcon} color="primary" size="sm" />
            <CardTitle>Snapshot files</CardTitle>
          </div>

          <CardContent className="mt-4 space-y-2 p-0">
            {isLoading ? (
              <div className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
                Loading files…
              </div>
            ) : files === null || files.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
                No files found for this repository snapshot.
              </div>
            ) : (
              files.map((file) => (
                <div key={file.filePath} className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
                  {file.filePath}
                </div>
              ))
            )}
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
    </>
  );
}
