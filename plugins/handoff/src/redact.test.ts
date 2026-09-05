import { Option } from "effect"
import { describe, expect, it } from "vitest"
import { findFirstSensitive } from "./redact.js"
import { fakeKey, userMsg } from "./test-support.js"

describe("findFirstSensitive", () => {
  it("returns none for clean messages", () => {
    expect(findFirstSensitive([userMsg("hello", "msg_1")], "secrets")).toEqual(Option.none())
    expect(findFirstSensitive([userMsg("contact jane@example.com", "msg_1")], "secrets")).toEqual(
      Option.none(),
    )
  })

  it("names the matched rule and message index", () => {
    expect(
      findFirstSensitive(
        [userMsg("hello", "msg_1"), userMsg("deploy with " + fakeKey, "msg_2")],
        "secrets",
      ),
    ).toEqual(Option.some({ index: 1, label: "Anthropic API key" }))
  })

  it("finds mail addresses only under the all scan depth", () => {
    const messages = [userMsg("contact jane@example.com", "msg_1")]
    expect(findFirstSensitive(messages, "all")).toEqual(
      Option.some({ index: 0, label: "mail address" }),
    )
  })
})
