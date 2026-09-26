import { describe, expect, it } from "vitest";

import { apiErrorMessage } from "../../lib/apiError";

describe("apiErrorMessage", () => {
  it("uses the message the API sent", () => {
    const err = { response: { data: { error: { message: "Repository not found" } } } };
    expect(apiErrorMessage(err, "Something went wrong")).toBe("Repository not found");
  });

  it("falls back when there is no API message", () => {
    expect(apiErrorMessage(new Error("Network Error"), "Something went wrong")).toBe("Something went wrong");
  });
});
