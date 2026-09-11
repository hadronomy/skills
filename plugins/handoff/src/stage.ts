import { Cause, Effect } from "effect"

/**
 * Convert every non-interrupt failure into the stage error. Host domains type
 * some operations as infallible and `Effect.promise` rejections surface as
 * defects, so mapping typed errors alone would let transport faults escape as
 * fiber breaks instead of the declared error union. Interruption passes
 * through untouched: a cancelled transfer must stay cancelled.
 *
 * @category combinators
 * @since 0.1.0
 */
export const orStageFailure = <A, E, TE>(
  fx: Effect.Effect<A, E>,
  make: () => TE,
): Effect.Effect<A, TE> =>
  fx.pipe(
    Effect.mapError(make),
    Effect.catchCauseIf(
      (cause) => !Cause.hasInterruptsOnly(cause),
      () => Effect.fail(make()),
    ),
  )

/**
 * Recover to a value from every non-interrupt outcome. Use where a failed
 * step has a worse but honest substitute, and the substitute serves the
 * caller better than refusing the whole operation. Interruption passes
 * through untouched, for the same reason as above.
 *
 * @category combinators
 * @since 0.5.0
 */
export const orFallback = <A, E>(
  fx: Effect.Effect<A, E>,
  make: () => A,
): Effect.Effect<A> =>
  fx.pipe(
    Effect.catch(() => Effect.sync(make)),
    Effect.catchCauseIf(
      (cause) => !Cause.hasInterruptsOnly(cause),
      () => Effect.sync(make),
    ),
  )
