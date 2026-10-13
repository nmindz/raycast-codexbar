import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import type { ReactNode } from "react";
import { getUsageReport, listProviders } from "./codexbar/cli";
import type { CodexbarUsageRecord } from "./codexbar/types";
import {
  formatDate,
  formatPercent,
  prettyJson,
  providerTitle,
} from "./ui/format";

interface UsageItem {
  record: CodexbarUsageRecord;
  displayName: string;
}

export default function UsageReportCommand() {
  const { data, isLoading, error, revalidate } = usePromise(async () => {
    const [providers, usage] = await Promise.all([
      listProviders(),
      getUsageReport(),
    ]);
    const enabled = new Set(
      providers
        .filter((provider) => provider.enabled)
        .map((provider) => provider.provider),
    );
    const providerNameMap = new Map(
      providers.map((provider) => [
        provider.provider,
        provider.displayName || providerTitle(provider.provider),
      ]),
    );

    return usage
      .filter((item) => enabled.has(item.provider))
      .map((record) => ({
        record,
        displayName:
          providerNameMap.get(record.provider) ||
          providerTitle(record.provider),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  });

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter providers"
    >
      {isLoading && (
        <StatusItem
          title="Loading Usage Report"
          markdown={buildLoadingMarkdown()}
        />
      )}

      {!!error && (
        <StatusItem
          title="Failed to Load Usage Report"
          icon={Icon.ExclamationMark}
          markdown={buildErrorMarkdown(error.message)}
          actions={
            <ActionPanel>
              <Action
                title="Retry"
                icon={Icon.ArrowClockwise}
                onAction={() => revalidate()}
              />
              <Action.CopyToClipboard
                title="Copy Error"
                content={error.message}
              />
            </ActionPanel>
          }
        />
      )}

      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <StatusItem
          title="No Enabled Provider Usage"
          icon={Icon.ExclamationMark}
          markdown="No usage rows returned for enabled providers. Open **Manage Providers** to enable providers, then refresh."
          actions={
            <ActionPanel>
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                onAction={() => revalidate()}
              />
            </ActionPanel>
          }
        />
      )}

      {!error &&
        (data || []).map((item) => (
          <UsageListItem
            key={usageRecordKey(item.record)}
            item={item}
            onRefresh={revalidate}
          />
        ))}
    </List>
  );
}

function StatusItem({
  title,
  markdown,
  icon = Icon.Clock,
  actions,
}: {
  title: string;
  markdown: string;
  icon?: Icon;
  actions?: ReactNode;
}) {
  return (
    <List.Item
      title={title}
      icon={icon}
      detail={<List.Item.Detail markdown={markdown} />}
      actions={actions}
    />
  );
}

function buildLoadingMarkdown(): string {
  return `# Loading Usage Report\n\nCodexBar is querying usage for enabled providers.\n\n## Commands\n\n\`\`\`bash\ncodexbar config providers --json\ncodexbar usage --json\n\`\`\`\n\nProviders can query local files, browser sessions, or remote APIs. This can take a few seconds.`;
}

function buildErrorMarkdown(message: string): string {
  return `# Usage Report Failed\n\n${message}\n\n## Commands\n\n\`\`\`bash\ncodexbar config providers --json\ncodexbar usage --json\n\`\`\``;
}

function usageRecordKey(record: CodexbarUsageRecord): string {
  return [
    record.provider,
    record.source ?? "default-source",
    record.account ?? "default-account",
    record.version ?? "default-version",
  ].join(":");
}

function UsageListItem({
  item,
  onRefresh,
}: {
  item: UsageItem;
  onRefresh: () => void;
}) {
  const { record } = item;
  const usage = record.usage;

  return (
    <List.Item
      title={item.displayName}
      subtitle={
        [record.source, record.account].filter(Boolean).join(" • ") || "Usage"
      }
      icon={record.error ? Icon.ExclamationMark : Icon.BarChart}
      accessories={
        record.error
          ? [{ tag: { value: "Error", color: "#ef4444" } }]
          : [
              { text: `Primary ${formatPercent(usage?.primary?.usedPercent)}` },
              {
                text: `Secondary ${formatPercent(usage?.secondary?.usedPercent)}`,
              },
              {
                text: `Tertiary ${formatPercent(usage?.tertiary?.usedPercent)}`,
              },
            ]
      }
      detail={
        <List.Item.Detail
          markdown={buildUsageMarkdown(record, item.displayName)}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Provider"
                text={item.displayName}
              />
              <List.Item.Detail.Metadata.Label
                title="Source"
                text={record.source ?? "-"}
              />
              <List.Item.Detail.Metadata.Label
                title="Account"
                text={record.account ?? "-"}
              />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="Primary"
                text={formatPercent(usage?.primary?.usedPercent)}
              />
              <List.Item.Detail.Metadata.Label
                title="Secondary"
                text={formatPercent(usage?.secondary?.usedPercent)}
              />
              <List.Item.Detail.Metadata.Label
                title="Tertiary"
                text={formatPercent(usage?.tertiary?.usedPercent)}
              />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="Updated"
                text={formatDate(usage?.updatedAt)}
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={onRefresh}
          />
          <Action.CopyToClipboard
            title="Copy JSON"
            content={prettyJson(record)}
          />
        </ActionPanel>
      }
    />
  );
}

function buildUsageMarkdown(
  record: CodexbarUsageRecord,
  displayName: string,
): string {
  const usage = record.usage;
  const lines = [
    `# ${displayName}`,
    "",
    `- Provider: ${record.provider}`,
    `- Source: ${record.source ?? "-"}`,
    `- Account: ${record.account ?? "-"}`,
    `- Updated: ${formatDate(usage?.updatedAt)}`,
  ];

  if (record.error) {
    lines.push(
      "",
      "## Error",
      `- Kind: ${record.error.kind ?? "-"}`,
      `- Message: ${record.error.message ?? "-"}`,
    );
  }

  lines.push(
    "",
    "## Usage",
    `- Primary: ${formatPercent(usage?.primary?.usedPercent)}`,
    `- Secondary: ${formatPercent(usage?.secondary?.usedPercent)}`,
    `- Tertiary: ${formatPercent(usage?.tertiary?.usedPercent)}`,
    "",
    "```json",
    prettyJson(record),
    "```",
  );

  return lines.join("\n");
}
