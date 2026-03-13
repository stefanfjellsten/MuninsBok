import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

// Mock AuthContext with controllable state
let mockAuth = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

describe("ProtectedRoute", () => {
  it("shows loading indicator while auth is loading", () => {
    mockAuth = { ...mockAuth, isLoading: true, isAuthenticated: false };
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText("Laddar…")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("redirects to /login when not authenticated", () => {
    mockAuth = { ...mockAuth, isLoading: false, isAuthenticated: false };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ProtectedRoute>
          <div>Protected content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.queryByText("Laddar…")).not.toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    mockAuth = { ...mockAuth, isLoading: false, isAuthenticated: true };
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
