import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetPendingApprovals, mockAddToast } = vi.hoisted(() => ({
  mockGetPendingApprovals: vi.fn(),
  mockAddToast: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
  }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getPendingApprovals: mockGetPendingApprovals,
      decideApprovalStep: vi.fn(),
    },
  };
});

import { PendingApprovals } from "./PendingApprovals";

const baseSteps = {
  data: [
    {
      id: "step-1",
      voucherId: "voucher-1234-abcd",
      stepOrder: 1,
      requiredRole: "ADMIN",
      createdAt: "2024-06-15",
    },
    {
      id: "step-2",
      voucherId: "voucher-5678-efgh",
      stepOrder: 2,
      requiredRole: "OWNER",
      createdAt: "2024-06-16",
    },
  ],
};

describe("PendingApprovals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetPendingApprovals.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<PendingApprovals />);
    expect(screen.getByText("Laddar…")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetPendingApprovals.mockRejectedValue(new Error("Serverfel"));
    renderWithProviders(<PendingApprovals />);
    expect(await screen.findByText("Serverfel")).toBeInTheDocument();
  });

  it("renders heading", async () => {
    mockGetPendingApprovals.mockResolvedValue(baseSteps);
    renderWithProviders(<PendingApprovals />);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Väntande attester" }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no pending approvals", async () => {
    mockGetPendingApprovals.mockResolvedValue({ data: [] });
    renderWithProviders(<PendingApprovals />);
    expect(await screen.findByText("Inga väntande attester.")).toBeInTheDocument();
  });

  it("renders table with approval steps", async () => {
    mockGetPendingApprovals.mockResolvedValue(baseSteps);
    renderWithProviders(<PendingApprovals />);
    await screen.findByText("Administratör");
    expect(screen.getByText("Ägare")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "/vouchers/voucher-1234-abcd")).toBe(true);
  });

  it("renders table headers", async () => {
    mockGetPendingApprovals.mockResolvedValue(baseSteps);
    renderWithProviders(<PendingApprovals />);
    await screen.findByText("Administratör");
    expect(screen.getByText("Verifikat")).toBeInTheDocument();
    // "Steg" translated from approval.step
    expect(screen.getByText("Steg")).toBeInTheDocument();
    expect(screen.getByText("Roll som krävs")).toBeInTheDocument();
    expect(screen.getByText("Datum")).toBeInTheDocument();
  });

  it("renders decision buttons per step", async () => {
    mockGetPendingApprovals.mockResolvedValue(baseSteps);
    renderWithProviders(<PendingApprovals />);
    await screen.findByText("Administratör");
    const buttons = screen.getAllByText("Godkänn / Avvisa");
    expect(buttons.length).toBe(2);
  });
});
