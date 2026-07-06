---
project: projects/useknockout-cli
type: services
---

# Services — useknockout-cli

Hosted / third-party services this CLI depends on.

## API

| Service | Role | Auth |
|---|---|---|
| **useknockout API** (`https://useknockout--api.modal.run`, hosted on **Modal**) | The background-removal / image-processing backend. Every CLI command wraps a method of the bundled `@useknockout/node` client; all HTTP goes through that client. Base URL overridable via `--base-url`. | Bearer token via `--token`, `KNOCKOUT_TOKEN` env var, or a bundled public beta token. |

Underlying models (server-side): BiRefNet (background removal), Swin2SR / Real-ESRGAN (upscale), GFPGAN (face restore), DDColor (colorize), LaMa (inpaint).

## Distribution

| Service | Role |
|---|---|
| **npm registry** | Publishes the `@useknockout/cli` package (public). Binaries: `useknockout`, `knockout`. |

No database, auth provider, or other hosted infrastructure. No LLM services.
