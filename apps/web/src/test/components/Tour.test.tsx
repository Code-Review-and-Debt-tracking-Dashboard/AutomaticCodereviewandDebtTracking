import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { Tour } from "../../components/tour/Tour";

function renderAt(path: string, page?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {page}
      <Tour />
    </MemoryRouter>,
  );
}

function clickNext(times: number) {
  for (let i = 0; i < times; i++) {
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  }
}

// jsdom has no layout, so give the target a real-looking size
function sizedTarget(name: string) {
  return (
    <button
      data-tour={name}
      ref={(el) => {
        if (el) {
          el.getBoundingClientRect = () =>
            ({ top: 10, left: 10, width: 100, height: 30, bottom: 40, right: 110 }) as DOMRect;
        }
      }}
    >
      target
    </button>
  );
}

describe("Tour", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["/dashboard", /welcome/i],
    ["/repositories", /summary/i],
    ["/repositories/repo-1", /health score/i],
    ["/repositories/repo-1/findings", /severity/i],
    ["/analytics", /analytics/i],
  ])("starts the right tour on %s", (path, title) => {
    renderAt(path);

    expect(screen.getByRole("dialog")).toHaveTextContent(title);
  });

  it("does not start on pages without a tour", () => {
    renderAt("/settings");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not start a tour that was already finished", () => {
    localStorage.setItem("toursDone", "dashboard");
    renderAt("/dashboard");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves forward and back between steps", () => {
    renderAt("/dashboard");

    clickNext(1);
    expect(screen.getByText("2 of 7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("1 of 7")).toBeInTheDocument();
  });

  it("marks only this page done on finish", () => {
    renderAt("/analytics");

    clickNext(3);
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("toursDone")).toBe("analytics");
  });

  it("skips every tour at once", () => {
    renderAt("/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("toursDone")).toBe(
      "dashboard,repositories,repository,findings,analytics",
    );
  });

  it("skips every tour on Escape", () => {
    renderAt("/dashboard");

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("toursDone")).toContain("analytics");
  });

  it("waits for a click on the highlighted item", () => {
    renderAt("/dashboard", sizedTarget("repositories"));

    clickNext(6);
    expect(screen.queryByRole("button", { name: /next|finish/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("target"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("toursDone")).toBe("dashboard");
  });

  it("ends the repositories tour by sending the user to analytics", () => {
    renderAt("/repositories", sizedTarget("analytics"));

    clickNext(2);
    expect(screen.getByRole("dialog")).toHaveTextContent(/open a repository/i);

    clickNext(1);
    expect(screen.getByRole("dialog")).toHaveTextContent(/click analytics/i);

    fireEvent.click(screen.getByText("target"));
    expect(localStorage.getItem("toursDone")).toBe("repositories");
  });

  it("ends the findings tour with a finish button", () => {
    renderAt("/repositories/repo-1/findings");

    clickNext(1);
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(localStorage.getItem("toursDone")).toBe("findings");
  });

  it("falls back to a finish button when the click target is missing", () => {
    renderAt("/dashboard");

    clickNext(6);
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(localStorage.getItem("toursDone")).toBe("dashboard");
  });
});
