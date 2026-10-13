import { execFile, spawn } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { promisify } from "util";
import type {
  CodexbarCommandResult,
  CodexbarConfigDumpResult,
  CodexbarConfigValidateResult,
  CodexbarCostRecord,
  CodexbarDiagnoseResult,
  CodexbarProviderToggle,
  CodexbarUsageRecord,
} from "./types";

const execFileAsync = promisify(execFile);

const CODEXBAR_KNOWN_PATHS = [
  `${homedir()}/.local/bin/codexbar`,
  "/opt/homebrew/bin/codexbar",
  "/usr/local/bin/codexbar",
  "/usr/bin/codexbar",
];

export const EXTENDED_PATH = [
  `${homedir()}/.local/bin`,
  "/opt/homebrew/bin",
  "/usr/local/bin",
  process.env.PATH || "",
].join(":");

let cachedCodexbarPath: string | null = null;

function findCodexbarBinary(): string | null {
  if (cachedCodexbarPath !== null) {
    return cachedCodexbarPath === "" ? null : cachedCodexbarPath;
  }

  for (const path of CODEXBAR_KNOWN_PATHS) {
    if (existsSync(path)) {
      cachedCodexbarPath = path;
      return path;
    }
  }

  cachedCodexbarPath = "codexbar";
  return cachedCodexbarPath;
}

export function getCodexbarBinaryPath(): string {
  const binary = findCodexbarBinary();
  if (!binary) {
    throw new Error(
      "CodexBar CLI not found. Install CodexBar and ensure it is available in PATH.",
    );
  }

  return binary;
}

async function runCodexbar(
  args: string[],
  timeoutMs = 60000,
): Promise<CodexbarCommandResult> {
  const binary = getCodexbarBinaryPath();

  try {
    const { stdout, stderr } = await execFileAsync(binary, args, {
      env: { ...process.env, PATH: EXTENDED_PATH },
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });

    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    if (!(error instanceof Error)) {
      throw new Error(String(error));
    }

    const withStreams = error as Error & {
      code?: string | number | null;
      stdout?: string;
      stderr?: string;
      killed?: boolean;
      signal?: NodeJS.Signals | string | null;
    };

    if (withStreams.code === "ENOENT") {
      throw new Error(
        "CodexBar CLI not found. Install CodexBar and ensure it is available in PATH.",
      );
    }

    if (error.message.toLowerCase().includes("timed out") || (withStreams.killed === true && withStreams.signal === "SIGTERM")) {
      throw new Error(
        `codexbar ${args.join(" ")} timed out after ${Math.round(timeoutMs / 1000)}s`,
      );
    }

    const stdout =
      typeof withStreams.stdout === "string" ? withStreams.stdout.trim() : "";
    const stderr =
      typeof withStreams.stderr === "string" ? withStreams.stderr.trim() : "";

    if (stdout.length > 0) {
      return { stdout, stderr };
    }

    if (stderr.length > 0) {
      throw new Error(
        redactMessage(tryExtractCodexbarErrorMessage(stderr) ?? stderr),
      );
    }

    throw new Error(
      `codexbar ${args.join(" ")} exited with code ${withStreams.code ?? "unknown"}`,
    );
  }
}

function parseJson<T>(raw: string, context: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Failed to parse CodexBar JSON output for ${context}.`);
  }
}

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (/token|api[-_]?key|secret|password|credential/i.test(key)) {
        return [key, "[redacted]"];
      }

      return [key, redactSensitive(entry)];
    }),
  );
}

function redactMessage(message: string): string {
  return message.replace(
    /(token|api[-_]?key|secret|password|credential)([^\n]{0,80})/gi,
    "$1 [redacted]",
  );
}

function tryExtractCodexbarErrorMessage(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === "object" && "error" in item) {
          const message = (item as { error?: { message?: unknown } }).error
            ?.message;
          if (typeof message === "string") {
            return message;
          }
        }
      }
      return null;
    }

    if (parsed && typeof parsed === "object" && "error" in parsed) {
      const message = (parsed as { error?: { message?: unknown } }).error
        ?.message;
      return typeof message === "string" ? message : null;
    }
  } catch {
    return null;
  }

  return null;
}

export async function listProviders(): Promise<CodexbarProviderToggle[]> {
  const { stdout } = await runCodexbar(["config", "providers", "--json"]);
  return parseJson<CodexbarProviderToggle[]>(stdout, "providers");
}

export async function setProviderEnabled(
  provider: string,
  enabled: boolean,
): Promise<void> {
  const action = enabled ? "enable" : "disable";
  await runCodexbar(["config", action, "--provider", provider, "--json"]);
}

export async function setProviderApiKey(
  provider: string,
  apiKey: string,
): Promise<void> {
  const binary = getCodexbarBinaryPath();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      binary,
      ["config", "set-api-key", "--provider", provider, "--stdin", "--json"],
      {
        env: { ...process.env, PATH: EXTENDED_PATH },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      const withCode = error as Error & { code?: string };
      if (withCode.code === "ENOENT") {
        reject(
          new Error(
            "CodexBar CLI not found. Install CodexBar and ensure it is available in PATH.",
          ),
        );
        return;
      }

      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const stdoutText = stdout.trim();
      const stderrText = stderr.trim();
      const message =
        tryExtractCodexbarErrorMessage(stdoutText) ??
        tryExtractCodexbarErrorMessage(stderrText) ??
        (stderrText.length > 0 ? stderrText : stdoutText);
      reject(
        new Error(
          message.length > 0
            ? redactMessage(message)
            : `codexbar exited with code ${code ?? "unknown"}`,
        ),
      );
    });

    child.stdin.write(apiKey);
    child.stdin.end();
  });
}

export async function getUsageReport(options?: {
  provider?: string;
  source?: string;
  withStatus?: boolean;
}): Promise<CodexbarUsageRecord[]> {
  const args = ["usage", "--json"];

  if (options?.provider && options.provider !== "all") {
    args.push("--provider", options.provider);
  }

  if (options?.source && options.source !== "all") {
    args.push("--source", options.source);
  }

  if (options?.withStatus) {
    args.push("--status");
  }

  const { stdout } = await runCodexbar(args);
  return parseJson<CodexbarUsageRecord[]>(stdout, "usage");
}

export async function getCostReport(
  provider?: string,
): Promise<CodexbarCostRecord[]> {
  const args = ["cost", "--json"];
  if (provider && provider !== "all") {
    args.push("--provider", provider);
  }

  const { stdout } = await runCodexbar(args, 120000);
  return parseJson<CodexbarCostRecord[]>(stdout, "cost");
}

export async function validateConfig(): Promise<CodexbarConfigValidateResult> {
  const { stdout } = await runCodexbar(["config", "validate", "--json"]);
  return parseJson<CodexbarConfigValidateResult>(stdout, "config validate");
}

export async function dumpConfig(): Promise<CodexbarConfigDumpResult> {
  const { stdout } = await runCodexbar(["config", "dump", "--json"]);
  return redactSensitive(
    parseJson<CodexbarConfigDumpResult>(stdout, "config dump"),
  ) as CodexbarConfigDumpResult;
}

export async function diagnoseConfig(
  provider: string,
): Promise<CodexbarDiagnoseResult> {
  const { stdout } = await runCodexbar(
    ["diagnose", "--provider", provider, "--format", "json", "--redact"],
    provider === "all" ? 90000 : 45000,
  );
  return redactSensitive(
    parseJson<CodexbarDiagnoseResult>(stdout, "diagnose"),
  ) as CodexbarDiagnoseResult;
}
