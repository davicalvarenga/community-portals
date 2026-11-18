import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJSON, runWithFixture, type FixtureRoute } from "./helpers";

const JOB_URL = "https://placeti.vagas.solides.com.br/vaga/954556";

const DETAIL: FixtureRoute = {
  origin: "https://placeti.vagas.solides.com.br",
  pathPrefix: "/vaga/",
  fixture: "detail-placeti-954556-excerpt.html",
  contentType: "text/html",
};

const saved = () => readFileSync(join(import.meta.dir, "fixtures", DETAIL.fixture), "utf-8");

describe("solides-cli detail (saved career page)", () => {
  test("reads the job from the page's embedded data", async () => {
    const { result, requests } = await runWithFixture(["detail", JOB_URL], DETAIL);
    const job = parseJSON<Record<string, unknown>>(result);
    expect(requests).toHaveLength(1);
    expect(requests[0].pathname).toBe("/vaga/954556");
    expect(job.id).toBe("954556");
    expect(job.title).toBe("Desenvolvedor Júnior");
    expect(job.company).toBe("PLACE TECNOLOGIA E INOVACAO S. A.");
    expect(job.location).toBe("Brasília, DF");
    expect(job.workplaceType).toBe("onsite");
    expect(job.contractType).toEqual(["PJ"]);
    expect(job.url).toBe(JOB_URL);
    expect(job.description).toContain("Como Desenvolvedor Júnior");
    expect(job.description).not.toMatch(/<\/?[a-z][^>]*>/i);
  });

  test("keeps the description's list items on their own lines", async () => {
    const { result } = await runWithFixture(["detail", JOB_URL], DETAIL);
    const description = parseJSON<{ description: string }>(result).description;
    expect(description).toMatch(/\n• Escrever código limpo[^\n]*\n• Colaborar com a equipe/);
    expect(description).not.toMatch(/\n{3,}/);
  });

  test("plain format prints the header, the description and the URL with blank lines between", async () => {
    const { result } = await runWithFixture(["detail", JOB_URL, "--format", "plain"], DETAIL);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.split("\n");
    expect(lines[0]).toBe("Desenvolvedor Júnior");
    expect(lines[1]).toBe("PLACE TECNOLOGIA E INOVACAO S. A. · Brasília, DF");
    expect(lines[2]).toBe("");
    expect(lines[3]).toBe("Workplace type: onsite");
    expect(result.stdout).toContain(`\n\nURL: ${JOB_URL}`);
  });

  test("a page that holds another job exits 1 with NOT_FOUND", async () => {
    const page = saved();
    const m = page.match(/(<script id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/)!;
    const data = JSON.parse(m[2]);
    data.props.pageProps.vacancy.id = 111;
    const other = page.replace(m[0], m[1] + JSON.stringify(data) + m[3]);
    const { result } = await runWithFixture(["detail", JOB_URL], { ...DETAIL, body: other });
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("NOT_FOUND");
  });

  test("a page without job data exits 1 with PARSE_FAILED", async () => {
    const { result } = await runWithFixture(["detail", JOB_URL], { ...DETAIL, body: "<html><body>Falha ao carregar página</body></html>" });
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("PARSE_FAILED");
  });
});
