import { htmlFetch, stripInvisible, toDetail, writeError, type SolidesRawJob } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

// The portal API has no per-job endpoint the CLI can use: the full posting lives on
// the company's career page, https://<company>.vagas.solides.com.br/vaga/<id>, which
// embeds the job object in its Next.js page data. `detail` therefore takes the `url`
// field from a search result, since the id alone does not say which company site to read.

// Most ids are numeric; jobs imported from outside the platform carry short alphanumeric ones.
const JOB_PATH = /^\/vaga\/([A-Za-z0-9]+)\/?$/

/** Only Sólides career pages over HTTPS, and only /vaga/<id>. Checked for the input and every redirect hop. */
function isSolidesJobUrl(url: URL): boolean {
  return url.protocol === "https:" && /^[a-z0-9-]+\.vagas\.solides\.com\.br$/i.test(url.hostname) && JOB_PATH.test(url.pathname)
}

function parseJobUrl(input: string): URL | null {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }
  return isSolidesJobUrl(url) ? url : null
}

/** The `vacancy` object from the page's __NEXT_DATA__ script, or null if the page has none. */
export function vacancyFromPage(html: string): SolidesRawJob | null {
  const m = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!m) return null
  try {
    const vacancy = (JSON.parse(m[1]) as { props?: { pageProps?: { vacancy?: unknown } } }).props?.pageProps?.vacancy
    return vacancy && typeof vacancy === "object" ? (vacancy as SolidesRawJob) : null
  } catch {
    return null
  }
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  if (/^\d+$/.test(opts.id)) {
    writeError("A Sólides job id alone does not say which company site holds it. Pass the `url` field from a search result.", "BAD_ID")
    return 1
  }
  const url = parseJobUrl(opts.id)
  if (!url) {
    writeError(`"${opts.id}" is not an https://<company>.vagas.solides.com.br/vaga/<id> URL. Pass the \`url\` field from a search result.`, "BAD_ID")
    return 1
  }
  const id = url.pathname.match(JOB_PATH)![1]
  try {
    const html = await htmlFetch(url.toString(), isSolidesJobUrl)
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const vacancy = vacancyFromPage(html)
    if (!vacancy) {
      writeError("Could not find job data on the career page; Sólides may have changed its page layout", "PARSE_FAILED")
      return 1
    }
    // A career page for another company, or a closed posting, does not carry this job.
    if (String(vacancy.id) !== id) {
      writeError("Job not found or no longer listed on this company's page", "NOT_FOUND")
      return 1
    }
    const job = stripInvisible(toDetail(vacancy))

    if (opts.format === "plain") {
      // Optional lines are added only when present, so the blank spacers stay.
      const extras = [
        job.workplaceType ? `Workplace type: ${job.workplaceType}` : null,
        job.seniority.length ? `Seniority: ${job.seniority.join(", ")}` : null,
        job.contractType.length ? `Contract: ${job.contractType.join(", ")}` : null,
        job.salary ? `Salary: ${job.salary}` : null,
        job.applicationDeadline ? `Deadline: ${job.applicationDeadline}` : null,
        job.benefits.length ? `Benefits: ${job.benefits.join(", ")}` : null,
      ].filter((l): l is string => l !== null)
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        ...(extras.length ? ["", ...extras] : []),
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ]
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
