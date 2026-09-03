# Packages

Typst packages come from the Universe registry: https://typst.app/universe. The registry source is a plain repo: https://github.com/typst/packages. Trust those two over any secondary write-up.

## Find

- Browse https://typst.app/universe for the task area (diagrams: `fletcher`, `cetz`; tables: `tablex`; notes: `drafting`).
- For the file list of a package, read its repo or its Universe page. Do not guess entry points.

## Pin

- Import with an exact version: `#import "@preview/fletcher:0.5.8": *`.
- Record the compiler floor in `typst.toml` beside the document so the next run resolves the same set.
- First fetch of a new package needs network. Later compiles reuse the local cache.

## Start from a template

- List starter templates on Universe, then run `typst init @preview/<template>:<version>`.
- Read the template README before editing its files. Templates carry their own required inputs.

## Local overrides

- A package under test lives at `@local`: macOS `~/Library/Application Support/typst/packages/<namespace>/<name>/<version>`, Linux `~/.local/share/typst/packages/<namespace>/<name>/<version>`.
- The local copy wins over the cache. Remove it when the test ends, or later compiles keep using the draft.
- Run `typst info` to confirm the cache and data paths on the current host.
