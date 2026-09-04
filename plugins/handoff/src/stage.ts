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
    Effect.mapError(() => make()),
    Effect.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause) ? Effect.failCause(cause) : Effect.fail(make())
    ),
  )
