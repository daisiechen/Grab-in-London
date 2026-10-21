# Source this file to put Node 24/pnpm and PostgreSQL 17 binaries on PATH when
# they are not installed system-wide: `source infra/dev-env.sh`.
# Override locations with FANCY_NODE_DIR / FANCY_PNPM_DIR / FANCY_PG_BIN.
if ! command -v node >/dev/null 2>&1; then
  _node_dir="${FANCY_NODE_DIR:-$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin}"
  [ -x "$_node_dir/node" ] && export PATH="$_node_dir:$PATH"
fi
if ! command -v pnpm >/dev/null 2>&1; then
  _pnpm_dir="${FANCY_PNPM_DIR:-$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback}"
  [ -x "$_pnpm_dir/pnpm" ] && export PATH="$_pnpm_dir:$PATH"
fi
if [ -z "${FANCY_PG_BIN:-}" ] && [ -x "$HOME/.local/share/fancy-pg17/pgsql/bin/postgres" ]; then
  export FANCY_PG_BIN="$HOME/.local/share/fancy-pg17/pgsql/bin"
fi
# If /usr/bin/git is unusable (e.g. Xcode installed but its license not yet accepted, exit 69),
# fall back to the Command Line Tools git without touching xcode-select or licenses.
if ! git --version >/dev/null 2>&1 && [ -x /Library/Developer/CommandLineTools/usr/bin/git ]; then
  export PATH="/Library/Developer/CommandLineTools/usr/bin:$PATH"
fi
