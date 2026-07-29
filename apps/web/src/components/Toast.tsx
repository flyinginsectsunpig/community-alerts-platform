"use client";

import { useExiting } from "./Presence";

export interface ToastMessage {
  kind: "info" | "error";
  message: string;
}

export default function Toast({ toast }: { toast: ToastMessage }) {
  const exiting = useExiting();

  return (
    <div
      className={`toast toast--${toast.kind}${exiting ? " toast--exiting" : ""}`}
      role="status"
    >
      {toast.message}
    </div>
  );
}
