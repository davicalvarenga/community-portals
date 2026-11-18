import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJSON, runWithFixture, type FixtureRoute } from "./helpers";

interface JobCard {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  workplaceType: string | null;
  seniority: string[];
  contractType: string[];
  date: string | null;
  url: string;
}

interface SearchResult {
  meta: { count: number; page: number; totalPages: number | null; total: number | null };
  results: JobCard[];
}

const SEARCH: FixtureRoute = {
  origin: "https://vagas.solides.com.br",
  pathPrefix: "/api/vacancies",
  fixture: "search-desenvolvedor.json",
  contentType: "application/json",
};

function ymd(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe("solides-cli search (saved API response)", () => {
  test("maps the saved jobs to result cards", async () => {
    const { result } = await runWithFixture(["search", "-q", "desenvolvedor"], SEARCH);
    const data = parseJSON<SearchResult>(result);
    expect(data.meta).toEqual({ count: 14, page: 1, totalPages: 49, total: 684 });
    expect(data.results).toHaveLength(14);
    expect(data.results[0]).toEqual({
      id: "954556",
      title: "Desenvolvedor Júnior",
      company: "PLACE TECNOLOGIA E INOVACAO S. A.",
      location: "Brasília, DF",
      workplaceType: "onsite",
      seniority: ["Junior"],
      contractType: ["PJ"],
      date: "2026-11-17",
      url: "https://placeti.vagas.solides.com.br/vaga/954556",
    });
    // The API's own redirectLink is broken ("https://placeti./vacancies/..."); every url is rebuilt from slug + id.
    for (const job of data.results) {
      expect(job.url).toMatch(/^https:\/\/[a-z0-9-]+\.vagas\.solides\.com\.br\/vaga\/[A-Za-z0-9]+$/);
    }
  });

  test("sends the query, the normalized city, the workplace type and the page", async () => {
    const { requests } = await runWithFixture(
      ["search", "-q", "desenvolvedor java", "-l", "goiânia/go", "--remote", "hybrid", "--page", "3"],
      SEARCH,
    );
    expect(requests).toHaveLength(1);
    const params = requests[0].searchParams;
    expect(params.get("title")).toBe("desenvolvedor java");
    expect(params.get("locations")).toBe("goiânia - GO");
    expect(params.get("jobsType")).toBe("hibrido");
    expect(params.get("page")).toBe("3");
    expect(params.get("take")).toBe("14");
  });

  test("--jobage keeps jobs by calendar day and drops jobs without a readable date", async () => {
    const saved = JSON.parse(readFileSync(join(import.meta.dir, "fixtures", SEARCH.fixture), "utf-8"));
    saved.data[0].createdAt = ymd(0);
    saved.data[1].createdAt = ymd(2);
    saved.data[2].createdAt = ymd(3);
    saved.data[3].createdAt = null;
    saved.data[4].createdAt = "2026-02-31";
    saved.data = saved.data.slice(0, 5);
    const { result } = await runWithFixture(["search", "--jobage", "2"], { ...SEARCH, body: JSON.stringify(saved) });
    expect(parseJSON<SearchResult>(result).results.map((j) => j.id)).toEqual([String(saved.data[0].id), String(saved.data[1].id)]);
  });

  test("--limit trims the results client-side", async () => {
    const { result } = await runWithFixture(["search", "-q", "desenvolvedor", "--limit", "2"], SEARCH);
    expect(parseJSON<SearchResult>(result).results).toHaveLength(2);
  });

  test("table and plain formats render the saved jobs", async () => {
    const table = await runWithFixture(["search", "-q", "desenvolvedor", "--format", "table"], SEARCH);
    expect(table.result.exitCode).toBe(0);
    expect(table.result.stdout).toContain("954556");
    const plain = await runWithFixture(["search", "-q", "desenvolvedor", "--format", "plain"], SEARCH);
    expect(plain.result.exitCode).toBe(0);
    expect(plain.result.stdout).toContain("https://placeti.vagas.solides.com.br/vaga/954556");
  });

  test("a response without a data array fails loudly", async () => {
    const { result } = await runWithFixture(["search", "-q", "desenvolvedor"], { ...SEARCH, body: '{"message":"moved"}' });
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("SEARCH_FAILED");
  });
});
