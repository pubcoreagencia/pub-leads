"use client";

import { useSyncExternalStore } from "react";

export type ToastVariant = "success" | "error";

export type ToastMessage = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastInput = Omit<ToastMessage, "id">;

let toastMessages: ToastMessage[] = [];
const listeners = new Set<() => void>();
const emptyToastMessages: ToastMessage[] = [];

function createToastId() {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return toastMessages;
}

function getServerSnapshot() {
  return emptyToastMessages;
}

export function dismissToast(id: string) {
  toastMessages = toastMessages.filter((message) => message.id !== id);
  emit();
}

export function toast(message: ToastInput) {
  const id = createToastId();

  toastMessages = [...toastMessages, { id, ...message }];
  emit();
  window.setTimeout(() => dismissToast(id), 5000);
}

export function useToast() {
  const messages = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    messages,
    dismiss: dismissToast,
  };
}
