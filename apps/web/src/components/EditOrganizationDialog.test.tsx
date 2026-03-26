import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: { ...actual.api, updateOrganization: vi.fn() },
  };
});

vi.mock("../hooks/useDialogFocus", () => ({
  useDialogFocus: () => ({ current: null }),
}));

vi.mock("./Dialog.module.css", () => ({ default: {} }));

import { EditOrganizationDialog } from "./EditOrganizationDialog";

describe("EditOrganizationDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onUpdated: vi.fn(),
    organization: {
      id: "org-1",
      name: "Test AB",
      orgNumber: "5501011234",
      fiscalYearStartMonth: 1,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = renderWithProviders(
      <EditOrganizationDialog {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog when open", () => {
    renderWithProviders(<EditOrganizationDialog {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Redigera organisation")).toBeInTheDocument();
  });

  it("renders form fields with current values", () => {
    renderWithProviders(<EditOrganizationDialog {...defaultProps} />);
    expect(screen.getByLabelText("Organisationsnummer")).toHaveValue("5501011234");
    expect(screen.getByLabelText("Organisationsnummer")).toBeDisabled();
    expect(screen.getByLabelText("Namn")).toHaveValue("Test AB");
  });

  it("renders cancel button", () => {
    renderWithProviders(<EditOrganizationDialog {...defaultProps} />);
    expect(screen.getByText("Avbryt")).toBeInTheDocument();
  });

  it("shows note that org number cannot be changed", () => {
    renderWithProviders(<EditOrganizationDialog {...defaultProps} />);
    expect(screen.getByText("Kan inte ändras")).toBeInTheDocument();
  });
});
