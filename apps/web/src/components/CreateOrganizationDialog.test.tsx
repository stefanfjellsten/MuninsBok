import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

const { mockCreateOrganization } = vi.hoisted(() => ({
  mockCreateOrganization: vi.fn(),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: { ...actual.api, createOrganization: mockCreateOrganization },
  };
});

vi.mock("../hooks/useDialogFocus", () => ({
  useDialogFocus: () => ({ current: null }),
}));

vi.mock("./Dialog.module.css", () => ({ default: {} }));

import { CreateOrganizationDialog } from "./CreateOrganizationDialog";

describe("CreateOrganizationDialog", () => {
  const onClose = vi.fn();
  const onCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = renderWithProviders(
      <CreateOrganizationDialog open={false} onClose={onClose} onCreated={onCreated} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog when open", () => {
    renderWithProviders(
      <CreateOrganizationDialog open={true} onClose={onClose} onCreated={onCreated} />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Skapa ny organisation")).toBeInTheDocument();
  });

  it("renders form fields", () => {
    renderWithProviders(
      <CreateOrganizationDialog open={true} onClose={onClose} onCreated={onCreated} />,
    );
    expect(screen.getByLabelText("Organisationsnummer")).toBeInTheDocument();
    expect(screen.getByLabelText("Namn")).toBeInTheDocument();
    expect(screen.getByLabelText("Räkenskapsårets startmånad")).toBeInTheDocument();
  });

  it("renders submit and cancel buttons", () => {
    renderWithProviders(
      <CreateOrganizationDialog open={true} onClose={onClose} onCreated={onCreated} />,
    );
    expect(screen.getByText("Skapa organisation")).toBeInTheDocument();
    expect(screen.getByText("Avbryt")).toBeInTheDocument();
  });

  it("shows validation error for invalid org number", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateOrganizationDialog open={true} onClose={onClose} onCreated={onCreated} />,
    );
    await user.type(screen.getByLabelText("Organisationsnummer"), "123");
    await user.type(screen.getByLabelText("Namn"), "Test AB");
    await user.click(screen.getByText("Skapa organisation"));
    expect(screen.getByText(/Organisationsnumret måste vara 10 siffror/)).toBeInTheDocument();
  });

  it("lists all 12 months in dropdown", () => {
    renderWithProviders(
      <CreateOrganizationDialog open={true} onClose={onClose} onCreated={onCreated} />,
    );
    expect(screen.getByText("Januari")).toBeInTheDocument();
    expect(screen.getByText("December")).toBeInTheDocument();
  });
});
