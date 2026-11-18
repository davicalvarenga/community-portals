---
name: solides-search
version: 1.0.0
description: >
  Search job listings on Sólides Vagas, the public job portal of the Sólides
  recruiting platform, used by thousands of Brazilian small and mid-sized companies
  to publish openings. Trigger phrases: sólides, solides vagas, buscar vagas,
  procurar emprego, job search Brazil, vaga de emprego, estágio, desenvolvedor,
  analista, vagas remotas.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/solides-search/cli/src/cli.ts *)
---

# Sólides Search Skill

Search live job listings from Sólides Vagas (vagas.solides.com.br), the Brazil-wide
portal that lists the openings of every company recruiting through Sólides. No
authentication, no API key, and **zero runtime dependencies**: it runs with just `bun`.

## Commands

### Search job listings

```bash
bun run .agents/skills/solides-search/cli/src/cli.ts search [flags]
```

Query syntax: plain words matched against the job title; the word order changes the results (`desenvolvedor java` and `java desenvolvedor` return different sets), a quoted phrase returns nothing, and `OR` is searched as a literal word, so send one plain term per call.

Key flags:
- `--query <text>` / `-q <text>`: words in the job title. Optional; without it the search
  covers every listing.
- `--location <text>` / `-l <text>`: city and state as `"Cidade - UF"`, e.g.
  `"Goiânia - GO"` (`Goiânia-GO`, `Goiânia/GO` and `Goiânia, GO` are accepted and
  rewritten). The portal returns nothing for a city without its state, so the CLI
  rejects one.
- `--remote <mode>`: `remote`, `hybrid`, or `onsite` (workplace-type filter).
- `--jobage <days>`: posted within N days. Applied **client-side** (the portal has no
  posting-age parameter) against each job's `createdAt`, by calendar day, and only to
  the page that was fetched: raise `--page` to look further. Jobs without a readable
  date are left out while the filter is on.
- `--page <n>`: page number (1-indexed, 14 results per page, the portal's own size).
- `--limit <n>` / `-n <n>`: cap total results emitted (client-side).
- `--format json|table|plain`: default `json`. JSON carries `meta.total` and
  `meta.totalPages` from the portal.

### Fetch full job detail

```bash
bun run .agents/skills/solides-search/cli/src/cli.ts detail <url> [--format json|plain]
```

`url` is the `url` field from a `search` result: the company's Sólides career page
(`https://<empresa>.vagas.solides.com.br/vaga/<id>`). The id alone does not say which
company site holds the job, so a bare id is rejected. Returns the full description,
workplace type, seniority, contract type, benefits, and the salary and deadline when
the company shows them. Only `https://*.vagas.solides.com.br/vaga/<id>` URLs are fetched.

## Usage examples

```bash
# Developer roles in Goiânia
bun run .agents/skills/solides-search/cli/src/cli.ts search -q "desenvolvedor" -l "Goiânia - GO" --format table

# Remote analyst roles posted in the last 7 days
bun run .agents/skills/solides-search/cli/src/cli.ts search -q "analista" --remote remote --jobage 7 --format table

# Full details for a specific job (pass the url field from a search result)
bun run .agents/skills/solides-search/cli/src/cli.ts detail "https://<empresa>.vagas.solides.com.br/vaga/<id>" --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default: programmatic use, passing each result's `url` to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`. Running the CLI with no command prints the help to **stdout** and also exits `1`.

## Notes

- Data source is `vagas.solides.com.br/api/vacancies`, the same-origin JSON endpoint the
  portal's own frontend calls, so results are clean and structured. It is not a
  documented API and may change; a 404 or a response without a `data` array fails with
  `SEARCH_FAILED` rather than looking like "no results".
- Access rules (checked 2026-11-18, details in `url-reference.md`):
  `vagas.solides.com.br/robots.txt` is `Allow: /`, and the company career sites
  (`<empresa>.vagas.solides.com.br`) publish no robots.txt. Sólides's terms of use are a
  software licence between Sólides and its client companies; there are no terms for
  the public job portal or for candidates, so there is no automated-access clause to
  cite. The CLI identifies itself as `solides-cli/1.0` and makes one request per
  command; only a 429 or 5xx response is retried, up to six times with exponential
  backoff, and `detail` follows a redirect only to another
  `https://<empresa>.vagas.solides.com.br/vaga/<id>` page.
- Most job ids are numeric (e.g. `954556`). Jobs imported from outside the platform can
  carry a short alphanumeric id, and some of those have no page; `detail` then reports
  `NOT_FOUND`.
