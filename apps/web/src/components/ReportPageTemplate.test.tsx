import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportPageTemplate } from "./ReportPageTemplate";

describe("ReportPageTemplate", () => {
  const baseProps = {
    title: "Råbalans",
    isLoading: false,
    error: null as unknown,
    isEmpty: false,
    loadingText: "Hämtar rapport…",
    children: <p>Report data</p>,
  };

  it("shows loading state", () => {
    render(<ReportPageTemplate {...baseProps} isLoading={true} />);
    expect(screen.getByText("Hämtar rapport…")).toBeInTheDocument();
    expect(screen.queryByText("Report data")).not.toBeInTheDocument();
  });

  it("shows error state", () => {
    render(<ReportPageTemplate {...baseProps} error={new Error("Nätverksfel")} />);
    expect(screen.getByText(/Nätverksfel/)).toBeInTheDocument();
    expect(screen.queryByText("Report data")).not.toBeInTheDocument();
  });

  it("shows empty state with default message", () => {
    render(<ReportPageTemplate {...baseProps} isEmpty={true} />);
    expect(screen.getByText("Råbalans")).toBeInTheDocument();
    expect(screen.getByText("Inga bokförda transaktioner ännu.")).toBeInTheDocument();
  });

  it("shows empty state with custom message", () => {
    render(<ReportPageTemplate {...baseProps} isEmpty={true} emptyText="Ingen budget skapad." />);
    expect(screen.getByText("Ingen budget skapad.")).toBeInTheDocument();
  });

  it("renders children when data is available", () => {
    render(<ReportPageTemplate {...baseProps} />);
    expect(screen.getByText("Report data")).toBeInTheDocument();
    expect(screen.getByText("Råbalans")).toBeInTheDocument();
  });

  it("renders actions in header", () => {
    render(<ReportPageTemplate {...baseProps} actions={<button>Exportera CSV</button>} />);
    expect(screen.getByText("Exportera CSV")).toBeInTheDocument();
  });

  it("renders filters", () => {
    render(<ReportPageTemplate {...baseProps} filters={<div>Filter section</div>} />);
    expect(screen.getByText("Filter section")).toBeInTheDocument();
  });

  it("renders titleExtra content", () => {
    render(<ReportPageTemplate {...baseProps} titleExtra={<span>2025-01-01 – 2025-12-31</span>} />);
    expect(screen.getByText("2025-01-01 – 2025-12-31")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<ReportPageTemplate {...baseProps} className="wide-report" />);
    expect(container.firstChild).toHaveClass("card", "wide-report");
  });

  it("prioritises loading over error and empty", () => {
    render(
      <ReportPageTemplate
        {...baseProps}
        isLoading={true}
        error={new Error("err")}
        isEmpty={true}
      />,
    );
    expect(screen.getByText("Hämtar rapport…")).toBeInTheDocument();
    expect(screen.queryByText(/err/)).not.toBeInTheDocument();
  });

  it("prioritises error over empty", () => {
    render(<ReportPageTemplate {...baseProps} error={new Error("Serverfel")} isEmpty={true} />);
    expect(screen.getByText(/Serverfel/)).toBeInTheDocument();
    expect(screen.queryByText("Inga bokförda transaktioner ännu.")).not.toBeInTheDocument();
  });
});
