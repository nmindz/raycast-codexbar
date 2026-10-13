import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useEffect, useState } from "react";
import {
  diagnoseConfig,
  dumpConfig,
  listProviders,
  validateConfig,
} from "./codexbar/cli";
import type { CodexbarDiagnoseResult } from "./codexbar/types";
import { formatDate, prettyJson, providerTitle } from "./ui/format";
import { showFailureToast, showSuccessToast } from "./ui/toast";

interface DiagnosisState {
  provider: string;
  data?: CodexbarDiagnoseResult;
  error?: string;
  isLoading: boolean;
  startedAt?: number;
}

export default function ConfigValidateCommand() {
  const [diagnosis, setDiagnosis] = useState<DiagnosisState>({
    provider: "all",
    isLoading: false,
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { data, isLoading, error, revalidate } = usePromise(async () => {
    const [validation, dump, providers] = await Promise.all([
      validateConfig(),
      dumpConfig(),
      listProviders(),
    ]);
    return {
      validation,
      dump,
      providers,
      isValid: getValidationState(validation),
    };
  });

  useEffect(() => {
    if (!diagnosis.isLoading || !diagnosis.startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () =>
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - diagnosis.startedAt!) / 1000)),
      );
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [diagnosis.isLoading, diagnosis.startedAt]);

  async function runDiagnosis(provider: string) {
    setDiagnosis({ provider, isLoading: true, startedAt: Date.now() });
    try {
      const result = await diagnoseConfig(provider);
      setDiagnosis({ provider, data: result, isLoading: false });
      await showSuccessToast(
        "Diagnosis complete",
        provider === "all" ? "All providers" : provider,
      );
    } catch (diagnoseError) {
      const message =
        diagnoseError instanceof Error
          ? diagnoseError.message
          : String(diagnoseError);
      setDiagnosis({ provider, error: message, isLoading: false });
      await showFailureToast(diagnoseError, "Diagnosis failed");
    }
  }

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Inspect config validation and diagnostics"
    >
      {!!error && (
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Failed to load config data"
          description={error.message}
          actions={
            <ActionPanel>
              <Action
                title="Retry"
                icon={Icon.ArrowClockwise}
                onAction={() => revalidate()}
              />
            </ActionPanel>
          }
        />
      )}

      {!error && data && (
        <>
          <List.Section title="Configuration">
            <List.Item
              title="Validation"
              icon={data.isValid ? Icon.CheckCircle : Icon.ExclamationMark}
              accessories={[
                {
                  tag: {
                    value: data.isValid ? "Valid" : "Invalid",
                    color: data.isValid ? Color.Green : Color.Red,
                  },
                },
              ]}
              detail={
                <List.Item.Detail
                  markdown={buildValidationMarkdown(
                    data.validation,
                    data.isValid,
                  )}
                />
              }
              actions={
                <ActionPanel>
                  <Action
                    title="Refresh Validation"
                    icon={Icon.ArrowClockwise}
                    onAction={() => revalidate()}
                  />
                  <Action.CopyToClipboard
                    title="Copy Validation JSON"
                    content={prettyJson(data.validation)}
                  />
                </ActionPanel>
              }
            />

            <List.Item
              title="Config Dump"
              subtitle="Sensitive fields redacted"
              icon={Icon.Document}
              accessories={[
                { text: `${data.dump.providers?.length ?? 0} providers` },
              ]}
              detail={
                <List.Item.Detail markdown={buildDumpMarkdown(data.dump)} />
              }
              actions={
                <ActionPanel>
                  <Action
                    title="Refresh Dump"
                    icon={Icon.ArrowClockwise}
                    onAction={() => revalidate()}
                  />
                  <Action.CopyToClipboard
                    title="Copy Redacted Dump JSON"
                    content={prettyJson(data.dump)}
                  />
                </ActionPanel>
              }
            />
          </List.Section>

          <List.Section
            title="Diagnosis"
            subtitle={`Current: ${diagnosis.provider}`}
          >
            <List.Item
              title="Diagnose All Providers"
              subtitle="Runs only when selected"
              icon={Icon.MagnifyingGlass}
              accessories={buildDiagnosisAccessories(
                diagnosis,
                elapsedSeconds,
                "all",
              )}
              detail={
                <List.Item.Detail
                  markdown={buildDiagnosisMarkdown(
                    diagnosis,
                    "all",
                    elapsedSeconds,
                  )}
                />
              }
              actions={
                <ActionPanel>
                  <Action
                    title="Run Diagnose for All"
                    icon={Icon.MagnifyingGlass}
                    onAction={() => runDiagnosis("all")}
                  />
                  {diagnosis.data && (
                    <Action.CopyToClipboard
                      title="Copy Redacted Diagnose JSON"
                      content={prettyJson(diagnosis.data)}
                    />
                  )}
                </ActionPanel>
              }
            />

            {(data.providers ?? []).map((provider) => (
              <List.Item
                key={provider.provider}
                title={`Diagnose ${provider.displayName || providerTitle(provider.provider)}`}
                subtitle={provider.provider}
                icon={Icon.MagnifyingGlass}
                accessories={buildDiagnosisAccessories(
                  diagnosis,
                  elapsedSeconds,
                  provider.provider,
                )}
                detail={
                  <List.Item.Detail
                    markdown={buildDiagnosisMarkdown(
                      diagnosis,
                      provider.provider,
                      elapsedSeconds,
                    )}
                  />
                }
                actions={
                  <ActionPanel>
                    <Action
                      title="Run Diagnose"
                      icon={Icon.MagnifyingGlass}
                      onAction={() => runDiagnosis(provider.provider)}
                    />
                    <Action.CopyToClipboard
                      title="Copy Provider ID"
                      content={provider.provider}
                    />
                    {diagnosis.provider === provider.provider &&
                      diagnosis.data && (
                        <Action.CopyToClipboard
                          title="Copy Redacted Diagnose JSON"
                          content={prettyJson(diagnosis.data)}
                        />
                      )}
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        </>
      )}
    </List>
  );
}

function getValidationState(validation: unknown): boolean {
  if (Array.isArray(validation)) {
    return validation.length === 0;
  }

  if (validation && typeof validation === "object" && "valid" in validation) {
    return Boolean((validation as { valid?: boolean }).valid);
  }

  return false;
}

function buildDiagnosisAccessories(
  diagnosis: DiagnosisState,
  elapsedSeconds: number,
  rowProvider: string,
): List.Item.Accessory[] {
  if (diagnosis.isLoading && diagnosis.provider === rowProvider) {
    return [
      { tag: { value: `Running ${elapsedSeconds}s`, color: Color.Yellow } },
    ];
  }

  if (diagnosis.error && diagnosis.provider === rowProvider) {
    return [{ tag: { value: "Failed", color: Color.Red } }];
  }

  if (diagnosis.data && diagnosis.provider === rowProvider) {
    return [
      { tag: { value: "Done", color: Color.Green } },
      { text: formatDate(diagnosis.data.timestamp) },
    ];
  }

  return [{ text: "Not run" }];
}

function buildValidationMarkdown(
  validation: unknown,
  isValid: boolean,
): string {
  return `# Config Validation\n\nStatus: ${isValid ? "Valid" : "Invalid"}\n\nCodexBar currently returns an empty JSON array when config is valid.\n\n\`\`\`json\n${prettyJson(validation)}\n\`\`\``;
}

function buildDumpMarkdown(dump: unknown): string {
  return `# Config Dump\n\nSensitive fields redacted by extension before display/copy.\n\n\`\`\`json\n${prettyJson(dump)}\n\`\`\``;
}

function buildDiagnosisMarkdown(
  diagnosis: DiagnosisState,
  rowProvider: string,
  elapsedSeconds: number,
): string {
  const timeoutSeconds = rowProvider === "all" ? 90 : 45;
  const command = `codexbar diagnose --provider ${rowProvider} --format json --redact`;

  if (diagnosis.isLoading && diagnosis.provider === rowProvider) {
    return `# Diagnose (${rowProvider})\n\nRunning ${elapsedSeconds}s / timeout ${timeoutSeconds}s.\n\n## What CodexBar is doing\n\nCodexBar is checking provider auth/config and trying available fetch strategies for this provider. Depending on provider, this can touch browser/session cookies, local app databases, CLI auth files, or provider APIs.\n\n## Command\n\n\`\`\`bash\n${command}\n\`\`\`\n\nIf this exceeds ${timeoutSeconds}s, extension stops waiting and shows timeout error.`;
  }

  if (diagnosis.error && diagnosis.provider === rowProvider) {
    return `# Diagnose Error\n\nProvider: ${rowProvider}\n\n${diagnosis.error}\n\n## Command\n\n\`\`\`bash\n${command}\n\`\`\``;
  }

  if (diagnosis.data && diagnosis.provider === rowProvider) {
    return `# Diagnose (${rowProvider})\n\nSensitive fields redacted by CodexBar and extension before display/copy.\n\n## Command\n\n\`\`\`bash\n${command}\n\`\`\`\n\n## Result\n\n\`\`\`json\n${prettyJson(diagnosis.data)}\n\`\`\``;
  }

  return `# Diagnose (${rowProvider})\n\nSelect action to run diagnosis. Diagnosis is not run automatically because it can be slow.\n\n## What will run\n\n\`\`\`bash\n${command}\n\`\`\`\n\nSingle-provider timeout: 45s. All-provider timeout: 90s.`;
}
