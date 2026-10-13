import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { listProviders, setProviderEnabled } from "./codexbar/cli";
import type { CodexbarProviderToggle } from "./codexbar/types";
import { prettyJson, providerTitle } from "./ui/format";
import { showFailureToast, showSuccessToast, withToast } from "./ui/toast";

export default function ProvidersSettingsCommand() {
  const { data, isLoading, error, revalidate } = usePromise(listProviders);

  if (error) {
    return (
      <List isLoading={isLoading}>
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Failed to load providers"
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
      </List>
    );
  }

  const providers = (data ?? [])
    .slice()
    .sort((a, b) =>
      (a.displayName ?? a.provider).localeCompare(b.displayName ?? b.provider),
    );

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter providers"
    >
      {!isLoading && providers.length === 0 && (
        <List.EmptyView
          title="No Providers Found"
          description="CodexBar returned no providers. Refresh or check codexbar config providers --json."
          actions={
            <ActionPanel>
              <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={() => revalidate()} />
            </ActionPanel>
          }
        />
      )}
      {providers.map((provider) => (
        <ProviderItem
          key={provider.provider}
          provider={provider}
          onRefresh={revalidate}
        />
      ))}
    </List>
  );
}

function ProviderItem({
  provider,
  onRefresh,
}: {
  provider: CodexbarProviderToggle;
  onRefresh: () => void;
}) {
  const enabled = provider.enabled;
  const title = provider.displayName || providerTitle(provider.provider);

  const toggleAction = withToast({
    action: async () => {
      await setProviderEnabled(provider.provider, !enabled);
      await onRefresh();
    },
    onStart: () => `${enabled ? "Disabling" : "Enabling"} ${title}`,
    onSuccess: () => `${title} ${enabled ? "disabled" : "enabled"}`,
    onFailure: (error) => ["Failed to update provider", error.message],
  });

  return (
    <List.Item
      title={title}
      subtitle={provider.provider}
      icon={enabled ? Icon.CheckCircle : Icon.Circle}
      accessories={[
        {
          tag: {
            value: enabled ? "Enabled" : "Disabled",
            color: enabled ? "#22c55e" : "#9ca3af",
          },
        },
        ...(provider.defaultEnabled ? [{ text: "Default" }] : []),
      ]}
      detail={
        <List.Item.Detail
          markdown={buildProviderMarkdown(provider, title)}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Provider"
                text={provider.provider}
              />
              <List.Item.Detail.Metadata.Label
                title="Display Name"
                text={title}
              />
              <List.Item.Detail.Metadata.Label
                title="Enabled"
                text={enabled ? "Yes" : "No"}
              />
              <List.Item.Detail.Metadata.Label
                title="Default Enabled"
                text={provider.defaultEnabled ? "Yes" : "No"}
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          <Action
            title={enabled ? "Disable Provider" : "Enable Provider"}
            icon={enabled ? Icon.XMarkCircle : Icon.CheckCircle}
            onAction={toggleAction}
          />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={async () => {
              try {
                await onRefresh();
                await showSuccessToast("Providers refreshed");
              } catch (error) {
                await showFailureToast(error, "Failed to refresh providers");
              }
            }}
          />
          <Action.CopyToClipboard
            title="Copy Provider ID"
            content={provider.provider}
          />
          <Action.CopyToClipboard
            title="Copy Provider JSON"
            content={prettyJson(provider)}
          />
        </ActionPanel>
      }
    />
  );
}

function buildProviderMarkdown(
  provider: CodexbarProviderToggle,
  title: string,
): string {
  return `# ${title}\n\n- Provider ID: ${provider.provider}\n- Enabled: ${provider.enabled ? "Yes" : "No"}\n- Default Enabled: ${provider.defaultEnabled ? "Yes" : "No"}\n\n\`\`\`json\n${prettyJson(provider)}\n\`\`\``;
}
