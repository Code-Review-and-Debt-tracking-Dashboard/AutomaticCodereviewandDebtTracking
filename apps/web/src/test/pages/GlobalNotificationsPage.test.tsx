import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalNotificationsPage } from "../../pages/global/GlobalNotificationsPage";
import { api } from "../../lib/apiClient";

vi.mock("../../lib/apiClient", () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const mockedApi = vi.mocked(api);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/notifications"]}>
      <Routes>
        <Route path="/notifications" element={<GlobalNotificationsPage />} />
        <Route path="/repositories/:repoId/findings" element={<p>findings page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

// same shape the API sends
const apiNotifications = [
  {
    id: "n-1",
    type: "CRITICAL_FINDING",
    title: "Critical finding in api",
    body: "Hardcoded secret in src/config.ts",
    readAt: null,
    createdAt: new Date().toISOString(),
    repository: { id: "repo-1", name: "api", fullName: "acme/api" },
    snapshot: { id: "snap-1" },
  },
  {
    id: "n-2",
    type: "ANALYSIS_COMPLETED",
    title: "Analysis finished for web",
    body: "Health score 91",
    readAt: null,
    createdAt: new Date().toISOString(),
    repository: { id: "repo-2", name: "web", fullName: "acme/web" },
    snapshot: { id: "snap-2" },
  },
];

describe("GlobalNotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists notifications without a load-more button that does nothing", async () => {
    mockedApi.get.mockResolvedValue({
      data: [
        {
          id: "n-1",
          type: "ANALYSIS_COMPLETED",
          title: "Analysis completed",
          body: "api-gateway scored 82",
          readAt: null,
          createdAt: new Date().toISOString(),
          repository: null,
        },
      ],
    } as any);

    renderPage();

    expect(await screen.findByText("Analysis completed")).toBeInTheDocument();
    expect(screen.queryByText(/Load \d+ earlier notifications/i)).not.toBeInTheDocument();
  });

  it("shows the error the API sent", async () => {
    mockedApi.get.mockRejectedValue({
      response: { data: { error: { message: "Session expired" } } },
    });

    renderPage();

    expect(await screen.findByText("Session expired")).toBeInTheDocument();
  });

  it("filters by repository and shows only critical findings on the Critical tab", async () => {
    mockedApi.get.mockResolvedValue({ data: apiNotifications } as any);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Critical finding in api");

    const [repoSelect] = screen.getAllByRole("combobox");
    await user.selectOptions(repoSelect, "web");
    expect(screen.queryByText("Critical finding in api")).not.toBeInTheDocument();
    expect(screen.getByText("Analysis finished for web")).toBeInTheDocument();

    await user.selectOptions(repoSelect, "All");
    await user.click(screen.getByRole("button", { name: /^Critical/ }));
    expect(screen.getByText("Critical finding in api")).toBeInTheDocument();
    expect(screen.queryByText("Analysis finished for web")).not.toBeInTheDocument();
  });

  it("opens the repo's findings and marks it read when a critical finding is clicked", async () => {
    mockedApi.get.mockResolvedValue({ data: apiNotifications } as any);
    mockedApi.put.mockResolvedValue({} as any);
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByText("Critical finding in api"));

    expect(screen.getByText("findings page")).toBeInTheDocument();
    expect(mockedApi.put).toHaveBeenCalledWith("/api/notifications/n-1/read");
  });

  it("deletes a notification on the server before removing it", async () => {
    mockedApi.get.mockResolvedValue({ data: apiNotifications } as any);
    mockedApi.delete.mockResolvedValue({} as any);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Critical finding in api");
    await user.click(screen.getAllByTitle("Delete")[0]);

    expect(mockedApi.delete).toHaveBeenCalledWith("/api/notifications/n-1");
    expect(screen.queryByText("Critical finding in api")).not.toBeInTheDocument();
  });

  it("keeps everything and shows the error when clearing fails", async () => {
    mockedApi.get.mockResolvedValue({ data: apiNotifications } as any);
    mockedApi.delete.mockRejectedValue({ response: { data: { error: { message: "Server busy" } } } });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Critical finding in api");
    await user.click(screen.getByRole("button", { name: /clear all/i }));

    expect(mockedApi.delete).toHaveBeenCalledWith("/api/notifications");
    expect(await screen.findByText("Server busy")).toBeInTheDocument();
    expect(screen.getByText("Critical finding in api")).toBeInTheDocument();
  });
});
