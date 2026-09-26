import { render, screen } from "@testing-library/react";
import { AlertCircle } from "lucide-react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "../../components/ui/EmptyState";

describe("EmptyState Component", () => {
  it("renders empty state title and description", () => {
    render(<EmptyState icon={AlertCircle} title="No items found" description="Try creating a new record." />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
    expect(screen.getByText("Try creating a new record.")).toBeInTheDocument();
  });
});
