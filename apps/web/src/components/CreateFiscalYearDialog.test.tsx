import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: { ...actual.api, createFiscalYear: vi.fn(), createOpeningBalances: vi.fn() },
  };
});

vi.mock("../hooks/useDialogFocus", () => ({
  useDialogFocus: () => ({ current: null }),
}));

vi.mock("./Dialog.module.css", () => ({ default: {} }));

import { CreateFiscalYearDialog } from "./CreateFiscalYearDialog";

describe("CreateFiscalYearDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
    organization: {
      id: "org-1",
      name: "Test AB",
      orgNumber: "5501011234",
      fiscalYearStartMonth: 1,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
    fiscalYears: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = renderWithProviders(
      <CreateFiscalYearDialog {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog when open", () => {
    renderWithProviders(<CreateFiscalYearDialog {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Nytt räkenskapsår")).toBeInTheDocument();
  });

  it("renders date fields", () => {
    renderWithProviders(<CreateFiscalYearDialog {...defaultProps} />);
    expect(screen.getByLabelText("Startdatum")).toBeInTheDocument();
    expect(screen.getByLabelText("Slutdatum")).toBeInTheDocument();
  });

  it("renders organization name in description", () => {
    renderWithProviders(<CreateFiscalYearDialog {...defaultProps} />);
    expect(screen.getByText("Test AB")).toBeInTheDocument();
  });

  it("renders submit and cancel buttons", () => {
    renderWithProviders(<CreateFiscalYearDialog {...defaultProps} />);
    expect(screen.getByText("Skapa räkenskapsår")).toBeInTheDocument();
    expect(screen.getByText("Avbryt")).toBeInTheDocument();
  });

  it("shows carry-over checkbox when closed years exist", () => {
    const props = {
      ...defaultProps,
      fiscalYears: [
        {
          id: "fy-1",
          startDate: "2023-01-01",
          endDate: "2023-12-31",
          isClosed: true,
          organizationId: "org-1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ],
    };
    renderWithProviders(<CreateFiscalYearDialog {...props} />);
    expect(screen.getByText(/Överför ingående balanser/)).toBeInTheDocument();
  });
});
