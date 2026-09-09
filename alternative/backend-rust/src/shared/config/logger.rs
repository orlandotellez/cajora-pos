use tracing_subscriber::{EnvFilter, fmt, fmt::format::FmtSpan};

pub fn init() {
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .pretty()
        .with_target(false)
        .with_span_events(FmtSpan::NONE)
        .init();
}
