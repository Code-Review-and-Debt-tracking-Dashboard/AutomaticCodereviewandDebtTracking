import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyButton } from "../../components/ui";

describe("CopyButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("says so when the browser blocks the clipboard", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });

    render(<CopyButton label="Copy 2 findings" getText={() => "text"} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy 2 findings" }));

    expect(await screen.findByText("Couldn't copy")).toBeInTheDocument();
  });
});
