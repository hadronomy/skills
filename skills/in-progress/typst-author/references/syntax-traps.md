# Syntax traps

Each trap below is a place where habits from other languages break Typst code. Check the trap list before writing, not after the compiler complains.

## Data structures

- **Arrays** use parentheses: `(item1, item2)`. A one-item array needs a trailing comma: `(item,)`.
- **Dictionaries** use parentheses with colons: `(key: value, key2: value2)`.
- **Content blocks** use square brackets: `[markup content]`. They are not arrays.
- Typst has no tuples. Any guide that says "tuple" means array.
- Index with `.at()`: `arr.at(0)`. `arr[0]` is a content-block lookup and fails on arrays.

## Code versus markup

- `#` enters code mode inside markup: `#let x = 1` then `The value is #x`.
- Inside a code block (`{ }`), no `#` prefix is needed.
- Define functions as `#let name(params) = { ... }`.
- `[ ]` holds markup, `{ }` holds code. Mixing them is the most common failure.

## State and styling

- `set` changes defaults for everything after it: `#set text(size: 12pt)`.
- `show` rewrites how an element renders: `#show heading: set text(blue)`.
- Read document state only inside `context`: `#context counter(page).get()`.
- A `context` value used outside `context` freezes at the wrong value. Keep the read and the use together.

## Functions

- Call with parentheses: `#func(arg)`. Content after the call in brackets becomes trailing content: `#func(arg)[body]`.
- Named arguments use colons: `#box(fill: red, inset: 8pt)[text]`.
- Lengths need units: `8pt`, `1em`, `80%`. A bare number is a count, not a length.
