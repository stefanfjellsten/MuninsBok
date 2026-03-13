import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./ToastContext";

vi.mock("./Toast.module.css", () => ({
  default: {
    toastContainer: "toastContainer",
    toastSuccess: "toastSuccess",
    toastError: "toastError",
    toastInfo: "toastInfo",
    toastClose: "toastClose",
  },
}));

function TestConsumer() {
  const { addToast } = useToast();
  return (
    <div>
      <button onClick={() => addToast("Sparat!")}>Add success</button>
      <button onClick={() => addToast("Något gick fel", "error")}>Add error</button>
    </div>
  );
}

describe("ToastContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders no toasts initially", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );
    expect(screen.queryByText("Sparat!")).not.toBeInTheDocument();
  });

  it("shows a toast when addToast is called", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Add success"));
    expect(screen.getByText("Sparat!")).toBeInTheDocument();
  });

  it("shows error toast with correct type", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Add error"));
    expect(screen.getByText("Något gick fel")).toBeInTheDocument();
  });

  it("auto-dismisses toast after 4 seconds", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Add success"));
    expect(screen.getByText("Sparat!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText("Sparat!")).not.toBeInTheDocument();
  });

  it("removes toast when close button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Add success"));
    expect(screen.getByText("Sparat!")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Stäng"));
    expect(screen.queryByText("Sparat!")).not.toBeInTheDocument();
  });

  it("throws when useToast is used outside provider", () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow("useToast must be used within ToastProvider");
    spy.mockRestore();
  });

  it("has an accessible toast container", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
