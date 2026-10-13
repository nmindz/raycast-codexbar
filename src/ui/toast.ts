import { showToast, Toast } from "@raycast/api";

export async function showSuccessToast(title: string, message?: string) {
  await showToast({ style: Toast.Style.Success, title, message });
}

export async function showFailureToast(
  error: unknown,
  fallbackTitle = "Operation failed",
) {
  await showToast({
    style: Toast.Style.Failure,
    title: fallbackTitle,
    message: getErrorMessage(error),
  });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unknown error";
}

export const withToast =
  ({
    action,
    onStart,
    onSuccess,
    onFailure,
  }: {
    action: () => Promise<void>;
    onStart: () => string | [string, string?];
    onSuccess: () => string | [string, string?];
    onFailure: (error: Error) => string | [string, string?];
  }) =>
  async () => {
    const start = toToastShape(onStart());
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: start.title,
      message: start.message,
    });

    try {
      await action();
      const success = toToastShape(onSuccess());
      toast.style = Toast.Style.Success;
      toast.title = success.title;
      toast.message = success.message;
    } catch (error) {
      const failure = toToastShape(
        onFailure(error instanceof Error ? error : new Error(String(error))),
      );
      toast.style = Toast.Style.Failure;
      toast.title = failure.title;
      toast.message = failure.message;
    }
  };

function toToastShape(input: string | [string, string?]) {
  if (Array.isArray(input)) {
    return { title: input[0], message: input[1] };
  }

  return { title: input, message: undefined };
}
