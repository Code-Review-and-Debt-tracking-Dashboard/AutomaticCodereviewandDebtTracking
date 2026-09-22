import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TabGroup } from "../../components/ui/TabGroup";

describe("TabGroup Component", () => {
  const tabs = [
    { id: "all", label: "All", count: 10 },
    { id: "unread", label: "Unread", count: 3 },
  ];

  it("renders tabs and counts", () => {
    render(<TabGroup tabs={tabs} activeTab="all" onTabChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Unread/i })).toBeInTheDocument();
  });

  it("triggers onTabChange when a tab is clicked", async () => {
    const handleTabChange = vi.fn();
    const user = userEvent.setup();

    render(<TabGroup tabs={tabs} activeTab="all" onTabChange={handleTabChange} />);
    await user.click(screen.getByRole("button", { name: /Unread/i }));

    expect(handleTabChange).toHaveBeenCalledWith("unread");
  });
});
