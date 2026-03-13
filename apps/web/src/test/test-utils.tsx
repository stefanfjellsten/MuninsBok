import { type ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider } from "../context/LocaleContext";

/**
 * Creates a fresh QueryClient for each test — prevents shared cache leaks.
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/**
 * Wraps component in the providers needed for most component tests:
 * MemoryRouter + QueryClientProvider + LocaleProvider.
 *
 * Usage:
 *   renderWithProviders(<MyComponent />, { route: "/dashboard" })
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    route = "/",
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: RenderOptions & { route?: string; queryClient?: QueryClient } = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </QueryClientProvider>
      </LocaleProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient };
}
