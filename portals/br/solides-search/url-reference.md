# Sólides Vagas — URL Reference

## Discovery notes

The portal at `https://vagas.solides.com.br` is a Next.js app. Its search pages
(`/vagas/<termo>[/<cidade-uf>]`) render the first 14 results on the server, inside the
React Server Components payload. Further pages and filters are fetched by the browser
from a same-origin endpoint, found by downloading the page's JS chunks
(`/_next/static/chunks/*.js`) and reading the search function:

```
a=new URLSearchParams({page:e.page.toString(),take:"14"}); ... e.search&&a.append("title",e.search),
e.locations&&a.append("locations",e.locations.map(e=>e.name).join(",")); ...
fetch("/api/vacancies?".concat(a.toString()),{method:"GET",...})
```

The chunks also name `https://apigw.solides.com.br` (`/jobs/v3/...`, used for candidate
accounts and applications); the CLI does not call it.

## Endpoints

### Search

```
GET https://vagas.solides.com.br/api/vacancies?page=<n>&take=14[&title=<words>][&locations=<Cidade - UF>][&jobsType=<type>]
```

| Param | Notes |
|---|---|
| `page` | 1-indexed. |
| `take` | Page size; the portal uses 14, and so does the CLI. |
| `title` | Words matched against the job title. Word order changes the results; a quoted phrase returns 0; `OR` is a literal word. |
| `locations` | `Cidade - UF`, e.g. `Goiânia - GO` (1317 results on 2026-11-18). `Goiânia` alone returns 0. The frontend joins several with commas; the CLI sends one. |
| `jobsType` | `presencial`, `remoto` or `hibrido` (the CLI's `onsite`, `remote`, `hybrid`). |
| `contractsType`, `seniorities`, `occupationAreas`, `affirmative`, `pcd` | Further filters the frontend can send; the CLI does not expose them. |

Response: `{ "totalPages", "currentPage", "count", "data": [job, ...] }`. Each job carries
`id`, `title`, `description` (HTML), `companyName`, `slug` (the company's career-site
subdomain), `jobType`, `city.name`, `state.code`, `createdAt` (`YYYY-MM-DD`),
`seniority[]`, `recruitmentContractType[]`, `occupationAreas[]`, `benefits[]`, `salary`
(shown only when `showRangeToApplicant`) and `date.due` (shown only when `date.show`).

No parameter was found for posting age: `--jobage` is applied client-side against
`createdAt`.

The job's `redirectLink` is malformed (`https://<slug>./vacancies/<id>?origem=portal`,
no domain), so the CLI builds each result's `url` from `slug` and `id` instead.

### Detail

```
GET https://<slug>.vagas.solides.com.br/vaga/<id>
```

The company's career page (a Next.js pages-router app) embeds the job as
`props.pageProps.vacancy` in its `<script id="__NEXT_DATA__">` element: the same
object as in the search response, plus company fields. A missing job answers 404. The
CLI checks that `vacancy.id` matches the requested id, so a page that shows a different
job is reported as `NOT_FOUND`.

The portal's own job page, `https://vagas.solides.com.br/vaga/<id>`, also works for
numeric ids and carries a schema.org `JobPosting` block, but its vacancy object
references the description as a separate Server Components chunk; the career page's
`__NEXT_DATA__` is simpler to read.

Some jobs imported from outside the platform carry a short alphanumeric id (e.g.
`1k2ifsOO5Z`, `referenceId: 0`); the one seen on 2026-11-18 answered 404 on both
pages.

## Access rules (checked 2026-11-18)

- `https://vagas.solides.com.br/robots.txt`: `User-agent: *` / `Allow: /`.
- `https://<empresa>.vagas.solides.com.br/robots.txt`: none (the app answers its
  not-found page).
- Terms: `https://solides.com.br/termos-de-uso/` is a software licence ("Cessão de Uso
  do software") between Sólides and its client companies. It mentions the Portal de
  Vagas only in the site menu and has no clause on candidates or on automated access.
  `solides.com.br` answers 502 to a non-browser User-Agent; `vagas.solides.com.br`
  answers this CLI's User-Agent normally.
- User-Agent: `Mozilla/5.0 (compatible; solides-cli/1.0)`.

## Maintenance

If search starts failing with `SEARCH_FAILED`, open a search page in a browser, find
the request to `/api/vacancies` in the network tab, and compare its parameters with
`buildUrl` in `cli/src/commands/search.ts`. If `detail` fails with `PARSE_FAILED`, check
whether the career page still has a `__NEXT_DATA__` script with
`props.pageProps.vacancy`.
