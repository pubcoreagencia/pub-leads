"use client";

import { Toast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

export function Toaster() {
  const { messages, dismiss } = useToast();

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] grid w-[calc(100vw-2rem)] justify-items-end gap-3 sm:w-auto">
      {messages.map((message) => (
        <Toast key={message.id} message={message} onDismiss={dismiss} />
      ))}
    </div>
  );
}
