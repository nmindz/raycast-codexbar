import { Action, ActionPanel, Form, Icon, showHUD } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { listProviders, setProviderApiKey } from "./codexbar/cli";
import { providerTitle } from "./ui/format";
import { showFailureToast, showSuccessToast } from "./ui/toast";

interface FormValues {
  provider: string;
  apiKey: string;
}

export default function SetApiKeyCommand() {
  const { data, isLoading } = usePromise(listProviders);
  const [isSubmitting, setSubmitting] = useState(false);

  const providers = useMemo(
    () =>
      (data ?? [])
        .slice()
        .sort((a, b) =>
          (a.displayName ?? a.provider).localeCompare(
            b.displayName ?? b.provider,
          ),
        )
        .map((provider) => ({
          value: provider.provider,
          title: provider.displayName || providerTitle(provider.provider),
        })),
    [data],
  );

  async function handleSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await setProviderApiKey(values.provider, values.apiKey);
      await showSuccessToast("API key saved", `Provider: ${values.provider}`);
      await showHUD("API key configured");
    } catch (error) {
      await showFailureToast(error, "Failed to set API key");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Set API Key"
            icon={Icon.Key}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="provider"
        title="Provider"
        info="Choose which provider will receive the API key"
        defaultValue={providers[0]?.value}
      >
        {providers.map((provider) => (
          <Form.Dropdown.Item
            key={provider.value}
            value={provider.value}
            title={provider.title}
          />
        ))}
      </Form.Dropdown>
      <Form.PasswordField
        id="apiKey"
        title="API Key"
        placeholder="Paste provider API key"
        info="The key is sent to codexbar config set-api-key --stdin and is never logged."
      />
      <Form.Description
        text={
          isSubmitting
            ? "Saving API key…"
            : "Press Enter to store the API key securely via CodexBar."
        }
      />
    </Form>
  );
}
