import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../lib/apiClient";
import { fetchAllFindings } from "../../lib/findings";

vi.mock("../../lib/apiClient", () => ({
  api: { get: vi.fn() },
}));

const mockedApi = vi.mocked(api);

describe("fetchAllFindings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("walks every page and joins the findings", async () => {
    const summary = { total: 3, new: 1, carryOver: 2, bySeverity: {}, byCategory: {} };
    mockedApi.get
      .mockResolvedValueOnce({ summary, data: [{ id: "a" }, { id: "b" }], pagination: { totalPages: 2 } })
      .mockResolvedValueOnce({ summary, data: [{ id: "c" }], pagination: { totalPages: 2 } });

    const res = await fetchAllFindings("snap-1");

    expect(mockedApi.get).toHaveBeenNthCalledWith(1, "/api/snapshots/snap-1/findings", { limit: 100, page: 1 });
    expect(mockedApi.get).toHaveBeenNthCalledWith(2, "/api/snapshots/snap-1/findings", { limit: 100, page: 2 });
    expect(res.data.map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(res.summary).toEqual(summary);
  });
});
