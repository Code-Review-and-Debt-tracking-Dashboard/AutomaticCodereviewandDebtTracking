import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalNotificationsPage } from "../../pages/global/GlobalNotificationsPage";
import { api } from "../../lib/apiClient";

vi.mock("../../lib/apiClient", () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const mockedApi = vi.mocked(api);

function renderPage() {
  return render(
    <MemoryRouter>
      <GlobalNotificationsPage />
    </MemoryRouter>,
  );
}

describe("GlobalNotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists notifications without a load-more button that does nothing", async () => {
    mockedApi.get.mockResolvedValue({
      data: [
        {
          id: "n-1",
          title: "Analysis completed",
          body: "api-gateway scored 82",
          readAt: null,
          createdAt: new Date().toISOString(),
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
});
