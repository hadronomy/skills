# Bibliography

## Sources

- Hayagriva `.yml` files are the native format. BibTeX `.bib` files also work.
- Keep the bibliography source beside the document and version it with the document.

## Cite and render

- Cite inline: `@key` or `#cite(<key>)`.
- Render the list once per bibliography: `#bibliography("refs.yml")`.
- Typst 0.15 renders multiple bibliographies natively (one per chapter, for example). Earlier guides that claim one global list are stale.

## Verify

- An unknown key is a compile warning, not an error. Search diagnostics for the key name after each compile.
- After the build passes, open the rendered pages and confirm each entry shows full data (author, year, venue). A resolved key with empty fields means the source record is thin, not that the cite failed.
