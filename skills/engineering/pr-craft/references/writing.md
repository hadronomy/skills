# Writing the prose

Two demands pull against each other. The body must be unambiguous to a tired
reviewer who is not a native English speaker, and it must read like a person
wrote it. Simplified Technical English gives the first. Zinsser's fourth
quality — humanity — keeps the second.

For the full rule set, call the Skill tool with `simple-english` and use
**pragmatic** mode: domain vocabulary stays, structure tightens.

## Classify each section first

Every STE rule depends on this split, and a PR body contains both kinds.

| Section | Kind | Verb form | Limit |
|---|---|---|---|
| Opening, Problem, Change, Risks | Descriptive | Simple present or past | 25 words per sentence |
| Verifying, Reviewing this | Procedural | Imperative | 20 words per sentence |

Descriptive text explains; it never orders. Procedural text orders; it never
explains. Mixing them inside one section is what makes a body feel muddy.

## Tense

- **The problem**: simple past for what happened, simple present for what is
  still true. "Uploads were accepted and then rejected." "The check runs too
  late."
- **The change**: simple present, describing the code as it is after this PR.
  "The size check runs on the request stream." Not "I moved the size check" and
  not "This PR moves the size check" — the code is the subject, not you and not
  the PR.
- **Verifying**: imperative. "Run the suite." "Upload a 3 GB file."

## Modals

Three are allowed: **can**, **will**, **must**. The rest hedge.

| You wrote | Write |
|---|---|
| should fix | fixes — or `must`, when it is a requirement |
| may cause | can cause |
| might be worth | state it as a fact, or delete it |
| would break | If X happens, Y breaks |

"Should" is the worst offender in a PR body, because it reads as doubt about
your own change. "This should fix the panic" invites the reviewer to ask
whether it does. "This fixes the panic" is a claim you then back with a test.

## Condition before command

Every `if` and `when` goes at the front of its sentence.

- Wrong: "Increase the timeout if the upload is slow."
- Right: "If the upload is slow, increase the timeout."

The reader learns whether the sentence applies to them before they read the
instruction. This matters most in **Verifying**, where a reviewer skims for the
step that matches their situation.

## One word per concept

Pick one and hold it for the whole body:

- check / verify / confirm / validate → pick one
- error / issue / problem / failure → "error" for errors, "failure" for failed
  operations
- run / execute / invoke → pick one
- limit / cap / threshold / budget → pick one

Synonym rotation reads as variety to the writer and as three different things
to the reader. In a PR body it is worse than usual: a reviewer who thinks
`limit` and `threshold` are two mechanisms will look for the second one.

## Cut

Delete on sight. None of these carry a fact:

`simply`, `just`, `easily`, `seamlessly`, `basically`, `essentially`, `it is
worth noting that`, `it's important to`, `as we all know`, `obviously`,
`in order to` (write "to"), `prior to` (write "before"), `due to the fact that`
(write "because"), `leverage` and `utilize` (write "use"), `functionality`
(write "function" or "feature"), `robust`, `comprehensive`, `powerful`,
`seamless`, `gracefully handles` (say what it does), `under the hood` (write
"internally"), `out of the box` (write "by default").

Two that are specific to PR bodies:

- **"This PR ..."** — the reader knows what they are looking at. "This PR adds
  a size check" is "Adds a size check", or better, the code as subject: "The
  size check now runs on the stream."
- **"Small change, just ..."** — you do not know it is small until the reviewer
  agrees. It reads as pressure to approve quickly.

## Forbidden shapes

These read as machine-written whatever the words are:

- **The antithesis reframe.** "It's not a bug fix — it's a rethink of how
  uploads work." State the point once, directly.
- **Staccato triples.** "Faster. Safer. Simpler." Write one sentence that says
  the thing.
- **Rhetorical question openers.** "Why does this matter?" Just say why.
- **Significance inflation.** "This change is a cornerstone of..." No.
- **Backward references.** "As mentioned above", "building on this". If the
  logic follows, it follows without announcement.

## Sounding human

STE removes ambiguity; it does not require sounding like a machine. What keeps
a body human:

- **Say the awkward thing plainly.** "I could not reproduce the original report
  and this fixes a different, adjacent bug I found while looking." That
  sentence is worth more than a polished body that hides it.
- **Admit the limit in your own voice.** "I am not confident about the error
  type here" is better than an omission and better than false certainty.
- **Keep one aside if it earns its place.** A single sentence of genuine
  reaction — "this was much harder than it looks, the buffering is three layers
  deep" — orients a reviewer about where the difficulty lives.
- **Write to a named reader.** You are writing to the person who will review
  this, not to a template.

The test: read the body aloud. Where you would not say a sentence to that
person's face, rewrite it.

## Before you post

1. Count the three longest sentences. Over 25 words (or 20 in a procedural
   section) — split them.
2. Search for `should`, `may`, `might`, `could`, `simply`, `just`, `This PR`.
3. Search every `if` and `when`. Each starts its sentence.
4. Search for the synonyms you did not pick.
5. Read the rendered body on GitHub, not the markdown. Broken tables, unclosed
   `<details>`, and images that did not upload only show up rendered.
