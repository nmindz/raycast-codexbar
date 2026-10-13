import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { getCostReport, getUsageReport, listProviders } from "./codexbar/cli";
import type {
  CodexbarCostRecord,
  CodexbarProviderToggle,
  CodexbarUsageRecord,
} from "./codexbar/types";
import {
  formatDate,
  formatPercent,
  prettyJson,
  providerTitle,
} from "./ui/format";

type StatusFilter =
  | "all"
  | "with-status"
  | "without-status"
  | "operational"
  | "degraded"
  | "errors";

interface MetricItem {
  usage: CodexbarUsageRecord;
  displayName: string;
  cost?: CodexbarCostRecord;
}

interface MetricsData {
  providers: CodexbarProviderToggle[];
  items: MetricItem[];
  costError?: string;
}

interface CostResult {
  records: CodexbarCostRecord[];
  error?: string;
}

const SOURCE_OPTIONS = ["all", "auto", "web", "cli", "oauth", "api"];
const STATUS_OPTIONS: StatusFilter[] = [
  "all",
  "with-status",
  "without-status",
  "operational",
  "degraded",
  "errors",
];

export default function MetricsQueryCommand() {
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [includeCost, setIncludeCost] = useState(false);

  const { data, isLoading, error, revalidate } = usePromise(
    async (provider, source, status, withCost): Promise<MetricsData> => {
      const [providers, usageRecords, costResult] = await Promise.all([
        listProviders(),
        getUsageReport({ provider, source, withStatus: true }),
        withCost
          ? loadCostRecords(provider)
          : Promise.resolve<CostResult>({ records: [] }),
      ]);

      const providerMap = new Map(
        providers.map((item) => [
          item.provider,
          item.displayName || providerTitle(item.provider),
        ]),
      );
      const enabledProviders = new Set(
        providers.filter((item) => item.enabled).map((item) => item.provider),
      );
      const costByProvider = new Map(
        costResult.records.map((item) => [item.provider, item]),
      );
      const costByProviderAndSource = new Map(
        costResult.records.map((item) => [
          providerSourceKey(item.provider, item.source),
          item,
        ]),
      );

      const items = usageRecords
        .filter((record) => enabledProviders.has(record.provider))
        .filter((record) => matchesStatusFilter(record, status))
        .map((usage) => ({
          usage,
          displayName:
            providerMap.get(usage.provider) || providerTitle(usage.provider),
          cost:
            costByProviderAndSource.get(
              providerSourceKey(usage.provider, usage.source),
            ) ?? costByProvider.get(usage.provider),
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      return { providers, items, costError: costResult.error };
    },
    [providerFilter, sourceFilter, statusFilter, includeCost],
  );

  const providerOptions = useMemo(
    () => [
      "all",
      ...(data?.providers ?? [])
        .filter((provider) => provider.enabled)
        .map((provider) => provider.provider),
    ],
    [data?.providers],
  );

  const providerTitleMap = useMemo(
    () =>
      new Map(
        (data?.providers ?? []).map((provider) => [
          provider.provider,
          provider.displayName || providerTitle(provider.provider),
        ]),
      ),
    [data?.providers],
  );

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Search provider metrics"
      filtering
      searchBarAccessory={
        <List.Dropdown
          tooltip="Provider Filter"
          value={providerFilter}
          onChange={setProviderFilter}
        >
          <List.Dropdown.Item value="all" title="All Enabled Providers" />
          {providerOptions
            .filter((item) => item !== "all")
            .map((provider) => (
              <List.Dropdown.Item
                key={provider}
                value={provider}
                title={
                  providerTitleMap.get(provider) || providerTitle(provider)
                }
              />
            ))}
        </List.Dropdown>
      }
    >
      {isLoading && (
        <StatusItem
          title="Loading Metrics"
          markdown={buildLoadingMarkdown(
            providerFilter,
            sourceFilter,
            includeCost,
          )}
        />
      )}

      {!!error && (
        <StatusItem
          title="Failed to Query Metrics"
          icon={Icon.ExclamationMark}
          markdown={buildErrorMarkdown(
            error.message,
            providerFilter,
            sourceFilter,
            includeCost,
          )}
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

      {!isLoading && !error && (data?.items.length ?? 0) === 0 && (
        <StatusItem
          title="No Usage Metrics Found"
          icon={Icon.ExclamationMark}
          markdown={buildEmptyMarkdown(
            providerFilter,
            sourceFilter,
            statusFilter,
          )}
          actions={
            <ActionPanel>
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                onAction={() => revalidate()}
              />
              {filterActions({
                sourceFilter,
                setSourceFilter,
                statusFilter,
                setStatusFilter,
                includeCost,
                setIncludeCost,
              })}
            </ActionPanel>
          }
        />
      )}

      {!error &&
        (data?.items ?? []).map((item) => (
          <MetricListItem
            key={usageRecordKey(item.usage)}
            item={item}
            includeCost={includeCost}
            onRefresh={revalidate}
            filterPanel={filterActions({
              sourceFilter,
              setSourceFilter,
              statusFilter,
              setStatusFilter,
              includeCost,
              setIncludeCost,
            })}
          />
        ))}

      {!isLoading && !error && (
        <List.Section
          title="Query Settings"
          subtitle="Use actions to change filters"
        >
          <List.Item
            title="Current Query"
            subtitle={`source=${sourceFilter} • status=${statusFilter} • cost=${includeCost ? "included" : "hidden"}`}
            icon={Icon.Gear}
            detail={
              <List.Item.Detail
                markdown={buildSettingsMarkdown(
                  providerFilter,
                  sourceFilter,
                  statusFilter,
                  includeCost,
                  data?.costError,
                )}
              />
            }
            actions={
              <ActionPanel>
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  onAction={() => revalidate()}
                />
                {filterActions({
                  sourceFilter,
                  setSourceFilter,
                  statusFilter,
                  setStatusFilter,
                  includeCost,
                  setIncludeCost,
                })}
              </ActionPanel>
            }
          />
        </List.Section>
      )}
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

function filterActions({
  sourceFilter,
  setSourceFilter,
  statusFilter,
  setStatusFilter,
  includeCost,
  setIncludeCost,
}: {
  sourceFilter: string;
  setSourceFilter: (source: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (status: StatusFilter) => void;
  includeCost: boolean;
  setIncludeCost: (value: boolean) => void;
}) {
  return (
    <>
      <ActionPanel.Submenu title={`Source: ${sourceFilter}`} icon={Icon.Globe}>
        {SOURCE_OPTIONS.map((option) => (
          <Action
            key={option}
            title={option}
            onAction={() => setSourceFilter(option)}
          />
        ))}
      </ActionPanel.Submenu>
      <ActionPanel.Submenu
        title={`Status: ${statusFilter}`}
        icon={Icon.Heartbeat}
      >
        {STATUS_OPTIONS.map((option) => (
          <Action
            key={option}
            title={option}
            onAction={() => setStatusFilter(option)}
          />
        ))}
      </ActionPanel.Submenu>
      <Action
        title={includeCost ? "Hide Cost Data" : "Include Cost Data"}
        icon={Icon.Coins}
        onAction={() => setIncludeCost(!includeCost)}
      />
    </>
  );
}

function MetricListItem({
  item,
  includeCost,
  onRefresh,
  filterPanel,
}: {
  item: MetricItem;
  includeCost: boolean;
  onRefresh: () => void;
  filterPanel: ReactNode;
}) {
  return (
    <List.Item
      title={item.displayName}
      subtitle={
        [item.usage.source, item.usage.account].filter(Boolean).join(" • ") ||
        "Usage"
      }
      icon={item.usage.error ? Icon.ExclamationMark : Icon.BarChart}
      accessories={buildAccessories(item, includeCost)}
      detail={
        <List.Item.Detail markdown={buildMetricsMarkdown(item, includeCost)} />
      }
      actions={
        <ActionPanel>
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={onRefresh}
          />
          {filterPanel}
          <Action.CopyToClipboard
            title="Copy Usage JSON"
            content={prettyJson(item.usage)}
          />
          {includeCost && item.cost && (
            <Action.CopyToClipboard
              title="Copy Cost JSON"
              content={prettyJson(item.cost)}
            />
          )}
        </ActionPanel>
      }
    />
  );
}

async function loadCostRecords(provider: string): Promise<CostResult> {
  try {
    return { records: await getCostReport(provider) };
  } catch (error) {
    return {
      records: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildAccessories(
  item: MetricItem,
  includeCost: boolean,
): List.Item.Accessory[] {
  if (item.usage.error) {
    return [{ tag: { value: "Error", color: Color.Red } }];
  }

  const accessories: List.Item.Accessory[] = [
    {
      text: `Primary ${formatPercent(item.usage.usage?.primary?.usedPercent)}`,
    },
    {
      text: `Secondary ${formatPercent(item.usage.usage?.secondary?.usedPercent)}`,
    },
    {
      text: `Tertiary ${formatPercent(item.usage.usage?.tertiary?.usedPercent)}`,
    },
  ];

  if (includeCost && item.cost?.last30DaysCostUSD !== undefined) {
    accessories.push({ text: `$${item.cost.last30DaysCostUSD.toFixed(2)}` });
  }

  return accessories;
}

function buildMetricsMarkdown(item: MetricItem, includeCost: boolean): string {
  const usage = item.usage.usage;
  const status = item.usage.status;
  const lines = [
    `# ${item.displayName}`,
    "",
    `- Provider: ${item.usage.provider}`,
    `- Source: ${item.usage.source ?? "-"}`,
    `- Account: ${item.usage.account ?? "-"}`,
    `- Updated: ${formatDate(usage?.updatedAt)}`,
  ];

  if (item.usage.error) {
    lines.push(
      "",
      "## Error",
      `- Kind: ${item.usage.error.kind ?? "-"}`,
      `- Message: ${item.usage.error.message ?? "-"}`,
    );
  }

  lines.push(
    "",
    "## Usage",
    `- Primary: ${formatPercent(usage?.primary?.usedPercent)}`,
    `- Secondary: ${formatPercent(usage?.secondary?.usedPercent)}`,
    `- Tertiary: ${formatPercent(usage?.tertiary?.usedPercent)}`,
  );

  if (status) {
    lines.push(
      "",
      "## Status",
      `- Indicator: ${status.indicator ?? "-"}`,
      `- Description: ${status.description ?? "-"}`,
    );
  }

  if (includeCost && item.cost) {
    lines.push(
      "",
      "## Cost",
      `- Last 30 days (USD): ${item.cost.last30DaysCostUSD?.toFixed(2) ?? "-"}`,
      `- Session cost (USD): ${item.cost.sessionCostUSD?.toFixed(4) ?? "-"}`,
      `- Session tokens: ${item.cost.sessionTokens ?? "-"}`,
      `- Cost updated: ${formatDate(item.cost.updatedAt)}`,
    );
  }

  lines.push("", "```json", prettyJson(item.usage), "```");
  return lines.join("\n");
}

function buildLoadingMarkdown(
  provider: string,
  source: string,
  includeCost: boolean,
): string {
  return `# Loading Metrics\n\nCodexBar is querying usage numbers for enabled providers.\n\n## Query\n\n- Provider: ${provider}\n- Source: ${source}\n- Cost: ${includeCost ? "included" : "hidden"}\n\n## Commands\n\n\`\`\`bash\ncodexbar config providers --json\ncodexbar usage --json --status${source !== "all" ? ` --source ${source}` : ""}${provider !== "all" ? ` --provider ${provider}` : ""}\n${includeCost ? `codexbar cost --json${provider !== "all" ? ` --provider ${provider}` : ""}` : ""}\n\`\`\``;
}

function buildErrorMarkdown(
  message: string,
  provider: string,
  source: string,
  includeCost: boolean,
): string {
  return `# Metrics Query Failed\n\n${message}\n\n${buildLoadingMarkdown(provider, source, includeCost)}`;
}

function buildEmptyMarkdown(
  provider: string,
  source: string,
  status: StatusFilter,
): string {
  return `# No Usage Metrics Found\n\nNo enabled provider matched current filters.\n\n- Provider: ${provider}\n- Source: ${source}\n- Status: ${status}\n\nTry Source = all and Status = all, or check **Manage Providers**.`;
}

function buildSettingsMarkdown(
  provider: string,
  source: string,
  status: StatusFilter,
  includeCost: boolean,
  costError?: string,
): string {
  return `# Query Settings\n\nThese are filters only. Usage numbers appear as provider rows above.\n\n- Provider: ${provider}\n- Source: ${source}\n- Status: ${status}\n- Cost Data: ${includeCost ? "Included" : "Hidden"}${costError ? `\n\n## Cost Error\n\n${costError}` : ""}`;
}

function usageRecordKey(record: CodexbarUsageRecord): string {
  return [
    record.provider,
    record.source ?? "default-source",
    record.account ?? "default-account",
    record.version ?? "default-version",
  ].join(":");
}

function providerSourceKey(provider: string, source?: string): string {
  return [provider, source ?? "default-source"].join(":");
}

function matchesStatusFilter(
  record: CodexbarUsageRecord,
  statusFilter: StatusFilter,
): boolean {
  if (statusFilter === "all") return true;
  const indicator = record.status?.indicator?.toLowerCase();
  if (statusFilter === "errors") return !!record.error;
  if (statusFilter === "with-status") return !!record.status;
  if (statusFilter === "without-status") return !record.status;
  if (statusFilter === "operational")
    return indicator === "none" || indicator === "operational";
  if (statusFilter === "degraded")
    return !!indicator && indicator !== "none" && indicator !== "operational";
  return true;
}
