import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

// Mock AuthContext
const mockLogin = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

import { Login } from "./Login";

describe("Login", () => {
  beforeEach(() => {
    mockLogin.mockClear();
  });

  it("renders login form with email and password fields", () => {
    renderWithProviders(<Login />);
    expect(screen.getByLabelText("E-postadress")).toBeInTheDocument();
    expect(screen.getByLabelText("Lösenord")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logga in" })).toBeInTheDocument();
  });

  it("renders app title and subtitle", () => {
    renderWithProviders(<Login />);
    expect(screen.getByText("Munins bok")).toBeInTheDocument();
    expect(screen.getByText("Logga in för att fortsätta")).toBeInTheDocument();
  });

  it("renders link to registration", () => {
    renderWithProviders(<Login />);
    expect(screen.getByText("Skapa konto")).toBeInTheDocument();
  });

  it("submits form with email and password", async () => {
    mockLogin.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText("E-postadress"), "test@example.com");
    await user.type(screen.getByLabelText("Lösenord"), "password123");
    await user.click(screen.getByRole("button", { name: "Logga in" }));

    expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
  });

  it("shows button text 'Loggar in…' while submitting", async () => {
    // Make login hang so we can observe the pending state
    mockLogin.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText("E-postadress"), "test@example.com");
    await user.type(screen.getByLabelText("Lösenord"), "password123");
    await user.click(screen.getByRole("button", { name: "Logga in" }));

    expect(screen.getByText("Loggar in…")).toBeInTheDocument();
  });

  it("shows API error message on login failure", async () => {
    // Import ApiError to throw a proper instance
    const { ApiError } = await import("../api");
    mockLogin.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Felaktigt lösenord"));
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText("E-postadress"), "test@example.com");
    await user.type(screen.getByLabelText("Lösenord"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: "Logga in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Felaktigt lösenord");
  });

  it("shows generic error for unexpected failures", async () => {
    mockLogin.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText("E-postadress"), "test@example.com");
    await user.type(screen.getByLabelText("Lösenord"), "password123");
    await user.click(screen.getByRole("button", { name: "Logga in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ett oväntat fel uppstod");
  });
});
