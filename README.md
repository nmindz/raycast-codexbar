# CodexBar Raycast Extension

Raycast extension to manage and inspect CodexBar data directly from Raycast.

## Commands

- **Usage Report** (`usage_report`)
  - Shows usage windows for enabled providers only.
  - Displays primary/secondary/tertiary usage percentages.

- **Query Metrics** (`metrics_query`)
  - Filters by provider, source, and status.
  - Includes optional cost view from `codexbar cost`.

- **Manage Providers** (`providers_settings`)
  - Lists provider toggles from `codexbar config providers`.
  - Enables/disables providers via actions.

- **Set API Key** (`set_api_key`)
  - Securely sends API key through stdin to:
    - `codexbar config set-api-key --provider <id> --stdin`
  - No key is logged by the extension.

- **Validate Config** (`config_validate`)
  - Runs config validation.
  - Shows raw config dump.
  - Supports diagnostics per provider or all providers.

## CodexBar CLI Resolution

The extension resolves CodexBar in this order:

1. `~/.local/bin/codexbar`
2. `/opt/homebrew/bin/codexbar`
3. `/usr/local/bin/codexbar`
4. `/usr/bin/codexbar`
5. Fallback to `codexbar` from `PATH`

## Development

```bash
pnpm install
pnpm run lint
pnpm run build
```
