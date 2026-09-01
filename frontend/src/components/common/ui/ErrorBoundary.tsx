import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}






export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
            gap: 16,
            textAlign: "center",
            color: "var(--foreground)",
          }}
        >
          <h2 style={{ margin: 0 }}>Algo salió mal</h2>
          <p style={{ color: "var(--muted-foreground)", maxWidth: 400 }}>
            Ocurrió un error inesperado. Podés recargar la página o volver a intentar.
          </p>
          <pre
            style={{
              fontSize: 11,
              color: "var(--muted-foreground)",
              maxWidth: "100%",
              overflow: "auto",
              padding: 12,
              background: "var(--surface)",
              borderRadius: 5,
            }}
          >
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 24px",
              borderRadius: 5,
              border: "1px solid var(--border)",
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
