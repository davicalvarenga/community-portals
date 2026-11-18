import { describe, expect, test } from "bun:test";
import { runCLI } from "./helpers";

// The validation cases fail before any request. The last test is the exception:
// it passes validation on purpose, reaches fetch, and the default preload makes
// that fetch throw.
function expectJsonError(result: { exitCode: number; stderr: string }, code: string) {
  expect(result.exitCode).toBe(1);
  const err = JSON.parse(result.stderr);
  expect(err.error).toBeTruthy();
  expect(err.code).toBe(code);
}

const JOB_URL = "https://placeti.vagas.solides.com.br/vaga/954556";

describe("solides-cli argument validation", () => {
  test("non-numeric, fractional, trailing-garbage and zero numbers exit 1 with BAD_ARG", async () => {
    for (const [flag, value] of [["--limit", "abc"], ["--limit", "10days"], ["--page", "1.5"], ["--jobage", "0.5"], ["--jobage", "0"]]) {
      expectJsonError(await runCLI(["search", "-q", "desenvolvedor", flag, value]), "BAD_ARG");
    }
  });

  test("a city without its state exits 1 with BAD_ARG instead of returning nothing", async () => {
    expectJsonError(await runCLI(["search", "-q", "desenvolvedor", "-l", "Goiânia"]), "BAD_ARG");
    expectJsonError(await runCLI(["search", "-q", "desenvolvedor", "--location"]), "BAD_ARG");
  });

  test("an unknown or misspelled flag exits 1 with UNKNOWN_FLAG", async () => {
    expectJsonError(await runCLI(["search", "-q", "desenvolvedor", "--locatoin", "Goiânia - GO"]), "UNKNOWN_FLAG");
    expectJsonError(await runCLI(["detail", JOB_URL, "--remote", "remote"]), "UNKNOWN_FLAG");
  });

  test("an unquoted extra word exits 1 with BAD_ARG", async () => {
    expectJsonError(await runCLI(["search", "-q", "desenvolvedor", "júnior"]), "BAD_ARG");
    expectJsonError(await runCLI(["detail", JOB_URL, "extra"]), "BAD_ARG");
  });

  test("an invalid --remote or --format exits 1 with BAD_ARG", async () => {
    for (const mode of ["remoto", "constructor"]) {
      expectJsonError(await runCLI(["search", "-q", "desenvolvedor", "--remote", mode]), "BAD_ARG");
    }
    expectJsonError(await runCLI(["search", "-q", "desenvolvedor", "--format", "csv"]), "BAD_ARG");
    expectJsonError(await runCLI(["detail", JOB_URL, "--format", "table"]), "BAD_ARG");
  });

  test("detail without a URL exits 1 with NO_ID", async () => {
    expectJsonError(await runCLI(["detail"]), "NO_ID");
  });

  test("detail rejects a bare id, another host, http: and other paths before fetching", async () => {
    for (const input of [
      "954556",
      "https://example.com/vaga/954556",
      "http://placeti.vagas.solides.com.br/vaga/954556",
      "https://placeti.vagas.solides.com.br/vagas",
      "https://vagas.solides.com.br/vaga/954556",
    ]) {
      expectJsonError(await runCLI(["detail", input]), "BAD_ID");
    }
  });

  test("an unknown command, including prototype names, exits 1 with BAD_CMD", async () => {
    for (const cmd of ["apply", "constructor", "__proto__", "toString"]) {
      expectJsonError(await runCLI([cmd]), "BAD_CMD");
    }
  });

  test("a network failure is reported as a JSON error, not a crash", async () => {
    expectJsonError(await runCLI(["search", "-q", "desenvolvedor"]), "SEARCH_FAILED");
  });
});
