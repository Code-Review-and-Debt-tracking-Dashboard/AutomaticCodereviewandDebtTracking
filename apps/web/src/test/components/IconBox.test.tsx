import { render } from "@testing-library/react";
import { Code2 } from "lucide-react";
import { describe, expect, it } from "vitest";
import { IconBox } from "../../components/ui/IconBox";

describe("IconBox Component", () => {
  it("renders icon element without crashing", () => {
    const { container } = render(<IconBox icon={Code2} color="primary" size="md" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
