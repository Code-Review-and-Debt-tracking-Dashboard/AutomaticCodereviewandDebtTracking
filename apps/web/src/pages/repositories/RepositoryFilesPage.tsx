import { ChevronLeft, FileCode } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

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

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Files
        </h1>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card p-12 text-center">
          <FileCode
            size={28}
            className="text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">
            Repository file browser is not implemented yet.
          </p>
        </div>
      </div>
    </main>
  );
}
