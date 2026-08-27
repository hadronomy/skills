# Performance

Two levers, in order: **allocate less memory** and **use fewer CPU cycles**.
Everything below is one of those two.

## Measure first

Never optimize from a guess. The `oxc` team abandoned a perfect-hash keyword
matcher after profiling showed LLVM already switched on string length and the
whole path cost 1–2%.

| Tool | Question it answers |
|---|---|
| `samply` | Where does wall time go? (sampling, opens in Firefox Profiler) |
| `cargo flamegraph` | Same, as a flamegraph |
| Instruments / `perf` | Cache misses, branch misses, syscalls |
| `dhat` | How many allocations, and where? |
| `divan` / `criterion2` | Micro-benchmark with statistics |
| `hyperfine` | End-to-end binary timing |
| CodSpeed | Benchmark regression gate in CI |
| `cargo-show-asm` | What machine code did this become? |
| `cargo llvm-lines` | Which generic function is bloating the build? |

Build benchmarks with a `profiling` profile — release settings, `lto = false`,
`debug = "full"`, `strip = false`. Fat LTO makes the profile loop unusable.

Record the number before and after. "Faster" without two numbers is not a
result.

## Allocation

- **Arena allocation** for a graph or tree with one lifetime: `bumpalo`. Bump a
  pointer to allocate, drop the whole arena at once. This gave `oxc` about 20%,
  and it makes traversal order match allocation order, so the CPU cache sees
  linear access.
- **Reuse buffers** across iterations. `buf.clear()` keeps the capacity;
  `String::new()` in a loop does not.
- **`Vec::with_capacity`** whenever the size is known or bounded.
- **`Cow<'_, str>`** for "usually borrowed, occasionally owned". `oxc`'s string
  unescaping returns the original slice 99.9% of the time and allocates only
  when it finds an escape.
- **Avoid `format!` on a hot path.** `s.push_str(&format!(..))` builds a whole
  `String` to throw away; use `write!(&mut s, ..)`. The `format_push_string`
  lint finds these.
- **Return `Box<[T]>`** rather than `Vec<T>` from anything cached long-term, so
  you do not retain spare capacity.

## Type size

The size of a hot type multiplies by every instance and every cache line.

- **Box the large variant.** An enum is as large as its biggest arm. `oxc` keeps
  `Expression` and `Statement` at 16 bytes by boxing, worth about 10%.
- **Assert the size**, so nobody regresses it:

```rust
const _: () = assert!(size_of::<Expression>() == 16);
```

- **Use `u32` for offsets and indices.** `Span { start: u32, end: u32 }` is half
  of the `usize` version and gave `oxc` about 5% on large files.
- **Exploit niches.** `NonZeroU32`, `nonmax::NonMaxU32`, and `&T` all let
  `Option<T>` be the same size as `T`.
- **Order struct fields** large to small when you use `#[repr(C)]`; the default
  `repr(Rust)` already reorders for you, so do not fight it without a reason.

## Strings

| Type | Use |
|---|---|
| `&'a str` | Borrowed from source or arena. Always first choice. |
| `Box<str>` | Owned, immutable, no spare capacity. |
| `compact_str::CompactString` | Owned, inline up to 24 bytes, `String`-like API. |
| `smol_str::SmolStr` | Owned, inline, cheap `Clone` (`Arc` past the inline limit). |
| `ecow::EcoString` | Inline plus refcounted growth. |
| `String` | You genuinely mutate and grow it. |

Interning is a trap under parallelism. `string-cache`'s global mutex capped
`oxc` at 50% CPU across threads; removing it gained about 30% on parallel
parsing. If you intern, shard the table or give each thread its own.

## Hashing

`std`'s `HashMap` uses SipHash, which is DoS-resistant and slow.

- **Internal keys you control**: `rustc_hash::FxHashMap` (or `FxHashSet`). This
  is what `rustc`, `oxc`, `ruff`, and `uv` all use.
- **Untrusted keys from the network or a file**: keep the default hasher.
- **Insertion order matters**: `indexmap::IndexMap`, which also iterates faster
  than a hash map.
- **Integer keys with a dense range**: skip hashing entirely and use a `Vec`
  indexed by the key.

## Indices instead of pointers

Replace `Rc<RefCell<Node>>` graphs with a `Vec<Node>` plus typed index newtypes.
You get linear memory, cheap `Copy` handles, no refcount traffic, and no
lifetime fight. `oxc`'s parent-pointing AST is built this way and runs 84×
faster than ESLint.

Crates: `oxc_index` and `index_vec` (typed indices), `la-arena`, `id_arena`,
`slotmap` (generational handles), `petgraph` (graphs).

## Iteration and bounds checks

- Iterators usually beat indexed loops because they elide bounds checks. Check
  the assembly before you reach for `get_unchecked`.
- `chunks_exact`, `array_windows`, and `zip` on equal-length slices give the
  optimizer the length proof it needs.
- Hoist the check yourself: `let slice = &data[..n];` once, then index `slice`.
- `memchr` for byte search, `bstr` for byte-string operations. Both are
  SIMD-accelerated and beat anything hand-written.
- `std::simd` (portable SIMD, nightly) or explicit intrinsics for whitespace
  and delimiter scanning — `oxc` gained a few percent this way. Always keep a
  scalar fallback.

## I/O

`println!` locks stdout and flushes at every newline. Printing thousands of
diagnostics that way is dominated by locking.

```rust
let stdout = io::stdout();
let mut out = BufWriter::new(stdout.lock());
for diagnostic in diagnostics {
    writeln!(out, "{diagnostic}")?;
}
out.flush()?;
```

Read with `BufReader`, or `fs::read_to_string` for a whole small file. Use
`memmap2` only for large files you scan once, and remember a mapped file can
change under you.

## Parallelism

- `rayon`'s `par_iter` converts a sequential pipeline in one line. Start there.
- Walk the filesystem with `ignore` (respects `.gitignore`, parallel walker);
  fall back to `walkdir` when you do not need ignore rules.
- **Keep output single-threaded.** Send results through a channel to one writer
  thread. Every worker holding the stdout lock is contention, and the order
  becomes nondeterministic.
- **Global locks destroy the gains.** Profile for `lock_slow` in the flamegraph.
  Shard the lock, or give each worker its own state and merge at the end.
- `parking_lot::Mutex` beats `std::sync::Mutex` under contention.
- `dashmap` for a general concurrent map, `papaya` for read-heavy, `arc-swap`
  for a config value read constantly and replaced rarely.
- `crossbeam-channel` or `flume` for synchronous channels; both beat `std::mpsc`.

## Inlining and code layout

- `#[inline]` matters only across crate boundaries; inside a crate LLVM decides.
  Put it on small generic wrappers, not on everything.
- `#[cold]` and `#[inline(never)]` on error and panic paths, so the hot path
  keeps its instruction-cache lines.
- Outline a cold branch into a separate `#[cold]` function rather than letting a
  large error-formatting block sit inline.
- `codegen-units = 1` and `lto = "fat"` in release let LLVM see across crates.
- `target-cpu=native` in `.cargo/config.toml` when you build for one machine;
  never in a distributed binary.

## Compile-time and binary size

`cargo llvm-lines` names the generic function producing the most IR. Usually the
fix is the thin-wrapper pattern from [api-design.md](api-design.md): a generic
public function delegating to one non-generic body. `cargo-bloat` does the same
for the shipped binary.

## What not to do

- Do not reach for `unsafe` to gain speed you have not measured. If you do,
  write the `// SAFETY:` comment and run it under Miri.
- Do not micro-optimize what LLVM already handles. Read the assembly.
- Do not optimize the parts a profile did not flag. `drop` costs, mutex waits,
  and allocation are the three that keep showing up; find yours before acting.
