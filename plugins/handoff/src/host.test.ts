import { it } from "@effect/vitest"
import { Effect, Ref } from "effect"
import { describe, expect } from "vitest"
import { Host } from "./host.js"

// The real layer composes the prompt, so the fake sits at the host boundary
// and keeps what it was asked. Testing the composition anywhere else tests a
// copy of it.
const asked = (request: Partial<Host.CondenseRequest> = {}) =>
  Effect.gen(function* () {
    const sent = yield* Ref.make("")
    const generate = {
      text: (input: { prompt: string }) =>
        Ref.set(sent, input.prompt).pipe(Effect.as({ text: "a handover" })),
    }
    const summarizer = yield* Host.Summarizer.pipe(
      Effect.provide(Host.SummarizerLive(generate as never)),
    )
    yield* summarizer.condense({
      transcript: "User: fix the parser",
      goal: "finish the parser fix",
      stated: true,
      artifacts: [],
      model: undefined,
      ...request,
    })
    return yield* Ref.get(sent)
  })

describe("the summarizer prompt", () => {
  it.effect("fences the transcript, so the work reads apart from the ask", () =>
    Effect.gen(function* () {
      const prompt = yield* asked()
      expect(prompt).toContain("--- transcript starts ---\nUser: fix the parser\n--- transcript ends ---")
    }))

  it.effect("puts the instruction after the transcript", () =>
    Effect.gen(function* () {
      const prompt = yield* asked()
      // A model answers the last thing it reads, and a long body pushes an
      // opening instruction out of reach.
      expect(prompt.indexOf("--- transcript ends ---"))
        .toBeLessThan(prompt.indexOf("Answer with the two paragraphs alone."))
    }))

  it.effect("writes for a stated purpose", () =>
    Effect.gen(function* () {
      const prompt = yield* asked()
      expect(prompt).toContain("The next session exists to: finish the parser fix")
      expect(prompt).toContain("Carry what it needs in full")
    }))

  it.effect("spreads the handover evenly when the purpose is a guess", () =>
    Effect.gen(function* () {
      const prompt = yield* asked({ stated: false, goal: "Weekly review" })
      expect(prompt).toContain("Nobody named what the next session is for.")
      expect(prompt).toContain("Cover the whole session evenly.")
    }))

  it.effect("names the artifacts the brief already lists", () =>
    Effect.gen(function* () {
      const prompt = yield* asked({ artifacts: ["src/x.ts", "#18"] })
      expect(prompt).toContain("The brief lists these artifacts: src/x.ts, #18")
      expect(prompt).toContain("The next agent opens them.")
    }))

  it.effect("says nothing about artifacts when there are none", () =>
    Effect.gen(function* () {
      expect(yield* asked()).not.toContain("The brief lists these artifacts")
    }))

  it.effect("asks for the shape it wants, and names no shape it refuses", () =>
    Effect.gen(function* () {
      const prompt = yield* asked()
      expect(prompt).toContain("Write two paragraphs of plain prose.")
      // A ban spends attention on the thing it forbids. `structured` in
      // render.ts holds the floor instead.
      for (const banned of ["JSON", "heading", "bullet", "Do not"]) {
        expect(prompt).not.toContain(banned)
      }
    }))
})
