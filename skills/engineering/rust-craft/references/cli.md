# Command-line interfaces

## Structure

Put the CLI definition in its own crate and the logic in libraries. `uv` has
`uv-cli` holding nothing but `clap` structs; every command body lives in a crate
that a test can call without spawning a process.

```
crates/
  myapp-cli/      # the CLI declaration, arg parsing, help text. No logic.
  myapp-core/     # the actual work, returns values, takes a writer
apps/
  myapp/          # main.rs: parse, dispatch, render, exit
```

The test for "resolve picks the newest compatible version" then calls
`myapp_core::resolve(..)` directly. Only the arg-parsing and rendering tests
need a subprocess.

## Argument parsing

Reach for **`usage-rs`** first. It compiles one declaration into a typed parser
*and* a portable spec, so argument parsing, shell completions, `--help`,
markdown docs, and man pages all derive from the same source. Every other crate
here gives you the parser and leaves the rest to a second tool that drifts out
of sync.

| Crate | Choose it for |
|---|---|
| `usage-rs` | The default. Spec-first, zero-allocation parse, completions and docs from one declaration. |
| `clap` (derive) | The conservative pick. Largest ecosystem and the most examples to copy. Slow to compile. |
| `bpaf` | Close to clap's feature set at a much lower compile cost. `oxc` uses it. |
| `lexopt` | Tiny, zero-dependency, fully manual. Fastest builds. |
| `pico-args` | Small and lenient. Prototypes only. |

### usage-rs

```rust
use usage::Cli;

#[derive(Cli)]
#[usage(bin = "myapp", version)]
struct App {
    /// Print more detail.
    #[usage(short = 'v', long, count)]
    verbose: u8,

    /// Files to process.
    files: Vec<String>,
}

fn main() {
    let app = App::parse();
}
```

The derive vocabulary is clap-shaped on purpose — `#[derive(Cli)]`,
`#[derive(Args)]`, `#[derive(Subcommands)]`, `#[derive(ValueEnum)]`,
`#[derive(ArgGroup)]`, and attributes for `short`, `long`, `env`, `default`,
`count`, `negate`. Subcommands are enums, and `flatten` merges a set into its
parent.

`#[usage(run)]` generates the dispatch that you would otherwise hand-write as a
`match` over the subcommand enum. It routes to `Run` implementations, in sync or
async form, with a context value threaded through.

```rust
#[derive(Subcommands)]
#[usage(run)]
enum Command {
    Install(Install),
    List(List),
}

impl Run for Install {
    fn run(&self, ctx: &Ctx) -> Result<()> { /* ... */ }
}
```

Feature flags:

| Feature | On by default | Gives you |
|---|---|---|
| `spec` | yes | Spec metadata and KDL output |
| `help` | yes | Rendered help pages |
| `diagnostics` | yes | Error formatting |
| `completions` | no | bash, zsh, fish, PowerShell, nushell |
| `validation` | no | Portable `validate` expressions |
| `config` | no | Config-file resolution via `#[derive(Config)]` |
| `response-files` | no | `@file` argument expansion |
| `test` | no | Test helpers |

`mise` builds with `completions`, `diagnostics`, and `validation`.

**Why it wins.** usage-rs parses from compiler-emitted static tables and scans
only the current command's flags plus inherited globals. clap and bpaf construct
a parser before they can use one, and the cost scales with the whole command
tree. On the mise-scale benchmark — 211 commands, 711 flags:

| | Per parse | Heap allocations |
|---|---|---|
| `usage-rs` | 0.19 µs | 0 |
| `clap` | 480 µs | 6,560 |
| `bpaf` | 1,600 µs | — |

That is startup time a user feels on every invocation of a large CLI.

**The spec is the real payoff.** The same declaration emits a KDL spec that the
`usage` CLI turns into completions, markdown, and man pages, and that other
languages can consume — Go today, Python and JavaScript planned. One definition
covers a Rust binary and its documentation site.

```kdl
cmd "install" help="Install a tool" {
    flag "--force" short="f" help="Reinstall if present"
    arg "<tool>" help="Tool to install"
}
```

**Maturity.** The project labels the Rust framework experimental and says point
releases can break. It is at 6.4.1, released within the last week, MIT, MSRV
1.91, and jdx ships it in mise and the rest of his CLIs. Pin an exact version
and read the changelog on upgrade; that is the cost of the parse budget and the
single source of truth.

### clap

Use clap when you need the ecosystem — a third-party crate that takes a
`clap::Command`, an existing codebase, or a team that already knows it.

```rust
#[derive(Parser)]
#[command(name = "myapp", version, about, long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,

    /// Path to the configuration file.
    #[arg(long, global = true, value_name = "FILE")]
    pub config: Option<PathBuf>,

    #[command(flatten)]
    pub verbosity: clap_verbosity_flag::Verbosity,
}
```

### Rules for either

- Type the arguments: `PathBuf` for paths, an enum with `ValueEnum` for a fixed
  set, a newtype with `FromStr` for anything validated. Never take a `String`
  and parse it later.
- Keep subcommands sorted, and group shared arguments with `flatten`.
- Generate completions and man pages in a build step or an `xtask`, and commit
  the output. usage-rs emits both from the spec; with clap, use
  `clap_complete` and `clap_mangen`.

## Output

**stdout is data. stderr is everything else.** A user piping your output into
`jq` must not receive a progress bar.

Turn on `clippy::print_stdout` and `clippy::print_stderr` at the workspace level.
Every write then has to be deliberate, and library crates cannot print at all —
they take a `&mut dyn Write` or return a value.

```rust
pub fn render(report: &Report, out: &mut impl Write) -> io::Result<()> { /* ... */ }
```

That signature is also what makes the renderer testable without a subprocess.

## Colour

Use `anstream` plus `anstyle`. `anstream` strips or converts ANSI codes based on
the stream, so Windows consoles and pipes both work.

Respect, in order: `--color=never|always|auto`, then `NO_COLOR`, then
`CLICOLOR_FORCE`, then whether stdout is a terminal. Never colour a non-tty by
default.

## Progress and interaction

- `indicatif` for progress bars and spinners, drawn on **stderr**, hidden when
  stderr is not a tty and when `--quiet` is set.
- `inquire` or `demand` for prompts. Every prompt needs a non-interactive path:
  a flag, an env var, or a failure with a clear message. A CI run must never
  hang on a question.
- Handle `Ctrl-C`: install a handler, cancel the work, clean up partial files.
  With tokio, `tokio::signal::ctrl_c()` into a `CancellationToken`.

## Configuration

Precedence, highest first: command-line flag, environment variable, project
config file, user config file, built-in default. Implement it once, in one
place, and document it in `--help`.

- `figment` or `confique` for layering; plain `serde` plus a merge function when
  the shape is simple.
- `etcetera` or `directories` for platform paths. Never build
  `~/.config/myapp` by hand.
- Prefix every env var (`MYAPP_LOG`, not `LOG`).
- Print the resolved configuration under a `--verbose` flag or a `config show`
  subcommand. "Which file won?" is the most common support question.

## Logging

```rust
tracing_subscriber::fmt()
    .with_writer(std::io::stderr)
    .with_env_filter(EnvFilter::from_env("MYAPP_LOG"))
    .init();
```

Wire `-v`/`-q` to the filter from the verbosity count — `#[usage(short = 'v',
long, count)]`, or `clap-verbosity-flag` under clap. Use your own env var
rather than `RUST_LOG` when the binary is a user tool — `mise` uses
`MISE_DEBUG` for exactly this reason.

## Errors at the surface

Return `ExitCode` from `main`, render the error chain to stderr, and reserve
distinct codes for distinct outcomes. Use `miette` when the error points into a
file the user wrote. See [errors.md](errors.md).

## Speed

- Walk files with `ignore` (parallel, respects `.gitignore`), process with
  `rayon`, collect through a channel to one printing thread.
- Buffer stdout with `BufWriter` and flush once. See
  [performance.md](performance.md).
- Report startup time honestly: `hyperfine` against the previous release.

## Testing

Three layers, in order of preference:

1. **Library tests.** Call the core function. Fast, precise, no process.
2. **Snapshot tests of rendered output.** `insta` on the string a renderer
   produced. Still no process.
3. **End-to-end.** `trycmd` or `snapbox` for golden transcripts, `assert_cmd`
   with `assert_fs` for filesystem effects.

```toml
# tests/cli.toml — trycmd reads README.md and tests/cmd/*.trycmd
bin.name = "myapp"
```

`trycmd` cases double as documentation, since the transcript in `README.md` is
the test. Keep the count small; each one spawns a process.

Make the output deterministic before you snapshot it: no timestamps, no
absolute paths, no duration, no hash ordering. `insta`'s filters can redact what
you cannot remove.

## Distribution

- `dist` (formerly `cargo-dist`) builds and publishes installers, shell
  installers, and release archives from CI.
- Report `--version` with the crate version plus the commit hash.
- Build static musl binaries for Linux; cross-compile with `cross` or
  `cargo-zigbuild`.
- For a small binary, add a `minimal-size` profile: `opt-level = "z"`,
  `codegen-units = 1`, `panic = "abort"`, `strip = true`.
