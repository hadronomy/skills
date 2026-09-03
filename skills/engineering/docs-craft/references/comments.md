# Comments: reason, contract, domain fact

Comments earn their place by saying what the code cannot. Worth writing: the
reason behind a non-obvious choice with the cost of the other path, the
contract for callers (behavior, units, nullability, order), domain facts
readers cannot know, and sync warnings for cases that change together.

Never write: restated lines, hedged corporate tone, orphan TODO markers, or
commented-out code. Never narrate history — no past faults, no fossils of
what was wrong before. History belongs in commits.

Safety and soundness comments name their invariant. Rust `unsafe` blocks
carry `// SAFETY:` with the depended-on invariant. Effect `Effect.fn`
wrappers need no comment: the span name already says the job.

One-line comments beat paragraphs where the reason fits one line. Dense
functions earn sparse signposts only — a comment easier to skip than its code
is dead weight.
