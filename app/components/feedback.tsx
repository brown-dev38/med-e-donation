"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider } from "antd";
import thTH from "antd/locale/th_TH";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";

/** Result returned by server actions; shown as a toast. */
export type ActionResult = null | { status: "error" | "success"; message: string };

/**
 * Ant Design theme + the App context that powers confirm modals and toasts (admin pages and the
 * public donation form). AntdRegistry collects antd styles during server rendering.
 * `toastTop` keeps toasts clear of the page's sticky header.
 */
export function UiProvider({ children, toastTop = 84 }: { children: ReactNode; toastTop?: number }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        locale={thTH}
        theme={{ token: { colorPrimary: "#32745b", colorError: "#b8432a", fontFamily: "var(--font-thai), sans-serif", borderRadius: 9 } }}
      >
        <App component={false} message={{ top: toastTop, maxCount: 3, duration: 4 }}>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}

/** Shows a success or error toast whenever an action returns a new result. */
export function useResultToast(result: { status: string; message?: string } | null) {
  const { message } = App.useApp();
  useEffect(() => {
    if (!result?.message) return;
    if (result.status === "error") message.error(result.message);
    else message.success(result.message);
  }, [result, message]);
}

/** Renders nothing; fires the toast for a form's latest result. */
export function ResultToast({ state }: { state: ActionResult }) {
  useResultToast(state);
  return null;
}

export type ConfirmOptions = { title: string; content?: ReactNode; okText?: string; cancelText?: string; danger?: boolean; width?: number };

/** Opens an Ant Design confirm modal and resolves to whether the user confirmed. */
export function useConfirm() {
  const { modal } = App.useApp();
  return useCallback(
    ({ title, content, okText = "ยืนยัน", cancelText = "ยกเลิก", danger = false, width }: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        modal.confirm({
          title,
          content,
          okText,
          cancelText,
          width,
          centered: true,
          okButtonProps: { danger },
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      }),
    [modal],
  );
}

type Toastable = { status: string; message?: string } | null;

/**
 * Runs a server action from a form after an optional confirm modal, then shows its result as a toast.
 * The toast is raised here rather than in an effect, so it still appears when the action removes the
 * component (a deleted row, a review panel that disappears once the donation is approved).
 * `options` may depend on which submit button was pressed; return null to skip the modal.
 */
export function useConfirmedAction<R extends Toastable>(
  action: (previous: R, formData: FormData) => Promise<R>,
  options: ConfirmOptions | null | ((submitter: HTMLButtonElement | null) => ConfirmOptions | null),
) {
  const confirm = useConfirm();
  const { message } = App.useApp();
  const [result, setResult] = useState<R>(null as R);
  const [pending, startTransition] = useTransition();
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // also skips React's automatic form reset, so typed values survive an error
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    const resolved = typeof options === "function" ? options(submitter) : options;
    if (resolved && !(await confirm(resolved))) return;
    startTransition(async () => {
      const next = await action(result, formData);
      startTransition(() => setResult(next));
      if (next?.message) {
        if (next.status === "error") message.error(next.message);
        else message.success(next.message);
      }
    });
  };
  return { onSubmit, pending, result };
}
