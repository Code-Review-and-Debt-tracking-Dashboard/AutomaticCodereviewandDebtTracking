import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";

describe("State Components", () => {
  describe("EmptyState", () => {
    it("renders title, description, and optional action button", () => {
      render(
        <EmptyState
          icon={(props: any) => <svg {...props} />}
          title="No repositories found"
          description="Try connecting a repository to get started."
          action={<button>Add Repo</button>}
        />,
      );

      expect(screen.getByText("No repositories found")).toBeInTheDocument();
      expect(screen.getByText("Try connecting a repository to get started.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add Repo" })).toBeInTheDocument();
    });
  });

  describe("ErrorState", () => {
    it("renders error title and message", () => {
      render(<ErrorState title="API Error" message="Failed to fetch items" />);

      expect(screen.getByText("API Error")).toBeInTheDocument();
      expect(screen.getByText("Failed to fetch items")).toBeInTheDocument();
    });

    it("triggers onRetry callback when retry button is clicked", async () => {
      const handleRetry = vi.fn();
      const user = userEvent.setup();

      render(<ErrorState onRetry={handleRetry} />);
      await user.click(screen.getByRole("button", { name: /Retry/i }));

      expect(handleRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("LoadingState", () => {
    it("renders loading message", () => {
      render(<LoadingState message="Fetching scan results..." />);

      expect(screen.getByText("Fetching scan results...")).toBeInTheDocument();
    });
  });
});
