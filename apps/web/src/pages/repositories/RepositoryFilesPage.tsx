import { ChevronLeft, FileCode, FolderOpen, Search } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

const files = [
  "src/api/users.ts",
  "src/services/analyzer.ts",
  "src/components/Table.tsx",
  "src/utils/format.ts",
];

export function RepositoryFilesPage() {
  const { repoId } = useParams();
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        <button
          onClick={() => navigate(`/repositories/${repoId}`)}
          className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={16} />
          Back to repository
        </button>

        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Files
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A compact file browser for the latest analysis snapshot.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FolderOpen size={16} className="text-primary" />
              Snapshot files
            </div>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              {files.map((file) => (
                <div key={file} className="rounded-xl border border-border/70 bg-background px-3 py-2">
                  {file}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Search size={16} className="text-primary" />
              File preview
            </div>
            <div className="mt-4 rounded-xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
              Select a file to inspect line-level findings for repository {repoId}.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
