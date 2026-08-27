# Async and concurrency

## Choose sync by default

Async pays for itself when you wait on many I/O operations at once. It costs you
`Send + 'static` bounds, coloured functions, harder stack traces, and a runtime.
A CLI that reads files and shells out does not need it; `rayon` gives you
parallelism without any of that.

Reach for async when the work is network-bound and concurrent: a package
resolver fetching hundreds of indexes, a server, a proxy.

## Runtime

`tokio` is the default. Pick the flavour deliberately:

```rust
#[tokio::main(flavor = "current_thread")]     // CLI: one thread, no work stealing
#[tokio::main]                                // server: multi-thread
```

A CLI usually wants `current_thread` — it removes the `Send` bound on most
futures and starts faster.

## Never block the runtime

A blocking call inside an async task stalls every other task on that worker
thread. That includes `std::fs`, `std::net`, `Mutex::lock` under contention, and
any CPU-heavy loop.

```rust
let parsed = tokio::task::spawn_blocking(move || parse_huge_file(&bytes)).await?;
```

Two things about `spawn_blocking`:

- A started blocking task **cannot be aborted**. Runtime shutdown waits for it;
  `shutdown_timeout` returns but the thread keeps running. Keep the work bounded.
- Each call holds a thread from the blocking pool. Gate CPU-heavy work behind a
  `Semaphore`, or hand it to `rayon` and bridge back with a `oneshot` channel.

`block_in_place` is only available on the multi-thread runtime and moves the
other tasks off the thread; it does not make blocking free.

## Cancellation safety

`tokio::select!` drops the losing futures. If a dropped future had already
consumed input, that input is gone.

```rust
loop {
    tokio::select! {
        // Cancellation safe: documented as such.
        Some(msg) = rx.recv() => handle(msg),

        // NOT safe: a partial read is lost on drop.
        // Buffer outside the select instead.
        result = &mut pending_read => { /* ... */ }

        _ = token.cancelled() => break,
    }
}
```

Rules:

- Check each method's "Cancel safety" section in the tokio docs. `recv`,
  `accept`, and `sleep` are safe; `read`/`write` on a stream and `AsyncReadExt`
  helpers generally are not.
- Store an unsafe future in a variable outside the loop and poll `&mut` it, so a
  loss does not restart it.
- **Locking inside `select!` is not cancellation safe.** You lose your place in
  the queue and can starve.

## Structured concurrency

Own every task you spawn. A detached `tokio::spawn` is a leak with a delayed
panic.

```rust
let mut set = JoinSet::new();
for url in urls {
    set.spawn(fetch(client.clone(), url));
}
while let Some(result) = set.join_next().await {
    handle(result??);
}
```

- `JoinSet` for a bounded batch with results.
- `tokio_util::task::TaskTracker` plus `CancellationToken` for a service that
  must drain on shutdown: cancel the token, close the tracker, await it.
- Bound concurrency explicitly — `stream.buffer_unordered(16)` or a `Semaphore`.
  Unbounded fan-out is how a client DoSes a server.

## Channels

| Channel | Use |
|---|---|
| `mpsc::channel(n)` | Work queue with backpressure. Always bounded. |
| `mpsc::unbounded_channel` | Only when the producer is provably bounded. |
| `oneshot` | One reply, including bridging from `spawn_blocking` or rayon. |
| `watch` | Latest-value config or shutdown signal. |
| `broadcast` | Fan-out where a slow receiver may lag. |
| `flume`, `crossbeam-channel` | Synchronous code, or bridging sync and async. |

Prefer passing a message over sharing a lock. A task that owns its state needs
no synchronization at all.

## Shared state

- `std::sync::Mutex` or `parking_lot::Mutex` for state **never held across an
  await**. They are faster, and holding one across an await is a deadlock
  waiting to happen.
- `tokio::sync::Mutex` only when the lock must be held across an await.
- `Arc<RwLock<T>>` for read-heavy state; `arc-swap` when reads dominate
  completely and writes replace the whole value.
- Scope every guard: `let value = { let g = lock.lock(); g.field.clone() };` so
  the guard drops before the next await.

## Traits

`async fn` in a trait works, but the returned future is anonymous, so:

- You cannot make it `dyn`-safe.
- You cannot add a `Send` bound at the call site.

For a `dyn` trait, use `#[async_trait]` or return
`Pin<Box<dyn Future<Output = T> + Send + '_>>` explicitly. For a generic trait,
plain `async fn` is fine.

## Timeouts and retries

Every network call gets a timeout. Set it on the client and again per request
where the budget differs.

```rust
let response = tokio::time::timeout(Duration::from_secs(10), client.get(url).send()).await??;
```

Retry only transient failures — connection reset, timeout, 5xx, 429 — with
exponential backoff **and jitter** (`backon`). Retrying a 400 is a bug. Build
one `reqwest::Client` and clone it; a new client per request throws away the
connection pool.

## Tracing

`tracing` replaces `log` for anything async: spans survive across await points
where a call stack does not.

```rust
#[tracing::instrument(skip(client), fields(url = %url))]
async fn fetch(client: &Client, url: Url) -> Result<Bytes, FetchError> { /* ... */ }
```

Instrument a future you spawn with `.instrument(span)` so it keeps its parent.
Use `EnvFilter` for runtime control, and `tracing-error` to attach a `SpanTrace`
to errors.

## Testing async

```rust
#[tokio::test(start_paused = true)]
async fn retries_with_backoff() {
    let handle = tokio::spawn(operation_that_retries());
    tokio::time::advance(Duration::from_secs(60)).await;
    assert!(handle.await.unwrap().is_ok());
}
```

`start_paused` makes time virtual, so a test of a 60-second backoff runs
instantly. `turmoil` simulates a network with partitions and latency. `loom`
exhaustively checks lock-free code under every interleaving — use it on any
hand-written atomic sequence.
