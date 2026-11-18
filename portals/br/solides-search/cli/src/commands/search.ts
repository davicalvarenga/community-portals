import { API_BASE, jsonFetch, stripInvisible, toCard, writeError, type JobCard, type SolidesSearchResponse } from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string // "Cidade - UF"
  remote?: "remote" | "hybrid" | "onsite"
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

/** The portal's own page size: its frontend asks for 14 results at a time. */
export const RESULTS_PER_PAGE = 14

const JOBS_TYPE: Record<NonNullable<SearchOpts["remote"]>, string> = {
  remote: "remoto",
  hybrid: "hibrido",
  onsite: "presencial",
}

export function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams({ page: String(opts.page), take: String(RESULTS_PER_PAGE) })
  if (opts.query) params.set("title", opts.query)
  if (opts.location) params.set("locations", opts.location)
  if (opts.remote) params.set("jobsType", JOBS_TYPE[opts.remote])
  return `${API_BASE}?${params.toString()}`
}

/**
 * The API has no posting-age parameter, so jobage is applied client-side to the
 * fetched page, by calendar day, against createdAt (YYYY-MM-DD). A job whose date
 * cannot be read is dropped while the filter is on, since its age is unknown.
 */
function withinJobage(card: JobCard, days: number | undefined): boolean {
  if (days === undefined) return true
  const m = card.date?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const posted = new Date(y, mo - 1, d)
  if (posted.getFullYear() !== y || posted.getMonth() !== mo - 1 || posted.getDate() !== d) return false
  const now = new Date()
  return posted.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - days).getTime()
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = c.title.slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 26).padEnd(26)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    return `${c.id.padEnd(9)} ${title} ${company} ${loc} ${c.date || "—"}`
  })
  const header =
    "ID".padEnd(9) + " " + "TITLE".padEnd(42) + " " + "COMPANY".padEnd(26) + " " + "LOCATION".padEnd(22) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const data = await jsonFetch<SolidesSearchResponse>(buildUrl(opts))
    // A 404 on the search endpoint means the API moved, not "no matches": fail loudly.
    if (!data) throw new Error(`Search endpoint returned 404 (${API_BASE}); the Sólides portal API may have moved`)
    if (!Array.isArray(data.data)) throw new Error("Search response has no data array; the Sólides portal API may have changed")
    let cards = stripInvisible(data.data.map(toCard)).filter((c) => withinJobage(c, opts.jobage))
    if (opts.limit !== undefined) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map((c) => `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`)
          .join("\n\n") + "\n",
      )
    } else {
      const meta = { count: cards.length, page: opts.page, totalPages: data.totalPages ?? null, total: data.count ?? null }
      process.stdout.write(JSON.stringify({ meta, results: cards }, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
