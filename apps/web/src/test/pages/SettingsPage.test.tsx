import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { SettingsPage } from "../../pages/global/SettingsPage";

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("replays the tutorial from the dashboard", () => {
    localStorage.setItem("toursDone", "dashboard");

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dashboard" element={<p>dashboard page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /replay tutorial/i }));

    expect(localStorage.getItem("toursDone")).toBe("");
    expect(screen.getByText("dashboard page")).toBeInTheDocument();
  });
});
