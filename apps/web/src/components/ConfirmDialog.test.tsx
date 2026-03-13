import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

vi.mock("./Dialog.module.css", () => ({
  default: {
    overlay: "overlay",
    dialogSm: "dialogSm",
    header: "header",
    description: "description",
    actions: "actions",
  },
}));

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    title: "Radera?",
    message: "Vill du verkligen radera detta?",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    defaultProps.onConfirm.mockClear();
    defaultProps.onCancel.mockClear();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title and message when open", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Radera?")).toBeInTheDocument();
    expect(screen.getByText("Vill du verkligen radera detta?")).toBeInTheDocument();
  });

  it("has correct ARIA attributes", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-dialog-title");
  });

  it("uses default confirmLabel 'Bekräfta'", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Bekräfta")).toBeInTheDocument();
  });

  it("uses custom confirmLabel", () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Ta bort" />);
    expect(screen.getByText("Ta bort")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} />);

    await user.click(screen.getByText("Bekräfta"));
    expect(defaultProps.onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} />);

    await user.click(screen.getByText("Avbryt"));
    expect(defaultProps.onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} />);

    await user.click(screen.getByLabelText("Stäng"));
    expect(defaultProps.onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel when overlay is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} />);

    // The overlay is the outermost div
    const overlay = screen.getByRole("dialog").parentElement!;
    await user.click(overlay);
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("calls onCancel on Escape key", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} />);

    await user.keyboard("{Escape}");
    expect(defaultProps.onCancel).toHaveBeenCalledOnce();
  });

  it("disables confirm button when isPending", () => {
    render(<ConfirmDialog {...defaultProps} isPending />);
    expect(screen.getByText("Vänta...")).toBeDisabled();
  });

  it("shows 'Vänta...' text when isPending", () => {
    render(<ConfirmDialog {...defaultProps} isPending />);
    expect(screen.getByText("Vänta...")).toBeInTheDocument();
  });
});
