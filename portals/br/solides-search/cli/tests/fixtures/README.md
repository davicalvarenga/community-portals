# Sólides Vagas fixtures

Both files were captured on 2026-11-18 with this CLI's own request URL and
User-Agent (`Mozilla/5.0 (compatible; solides-cli/1.0)`), one request each.

## `search-desenvolvedor.json`

Search response for
`https://vagas.solides.com.br/api/vacancies?page=1&take=14&title=desenvolvedor`,
saved whole and unmodified (14 jobs, `count` 684, `totalPages` 49).
SHA-256: `002b38b0b0cc0b0d561fb8bb7ec583c39c407f36e2f565da04d6c17ee01e0927`.

## `detail-placeti-954556-excerpt.html`

Career page `https://placeti.vagas.solides.com.br/vaga/954556`.
Full page SHA-256: `924b9f5e59320863349cca6029a5bbce6fa3ea937812e9258d0909bc0c62c89f`.

Kept: the page's `<script id="__NEXT_DATA__">` element, the only part `detail`
reads, as one unmodified slice (SHA-256
`a7da0b5799d19eb3108d1fdc71e91d109837a672d159bdbfad6fbb6006ef44b9`), inside a
minimal HTML shell. It holds the company's public profile (name, CNPJ, logo,
social links) and the job; it has no personal e-mail addresses, phone numbers or
candidate data.

## How the tests use them

The CLI tests run the real CLI in a child process. A preload redirects only the
expected Sólides path to a loopback server that returns the saved file; any
other request throws. `tests/no-network.ts` blocks `fetch` entirely for the
argument validation tests. No test contacts Sólides, and no test regenerates a
fixture.
