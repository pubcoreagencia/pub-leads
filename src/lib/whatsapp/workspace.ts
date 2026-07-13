const whatsappWorkspaceWindowName = "publeads_whatsapp_workspace";
const instagramWorkspaceWindowName = "publeads_instagram_workspace";
let whatsappWorkspaceWindow: Window | null = null;
let instagramWorkspaceWindow: Window | null = null;

export function openReusableWorkspaceWindow(url: string, channel: "instagram" | "whatsapp") {
  if (typeof window === "undefined") {
    return false;
  }

  const target = channel === "whatsapp" ? whatsappWorkspaceWindowName : instagramWorkspaceWindowName;
  const currentWindow = channel === "whatsapp" ? whatsappWorkspaceWindow : instagramWorkspaceWindow;

  if (currentWindow && !currentWindow.closed) {
    currentWindow.location.href = url;
    currentWindow.focus();
    return true;
  }

  const popup = window.open(url, target);

  if (!popup) {
    return false;
  }

  if (channel === "whatsapp") {
    whatsappWorkspaceWindow = popup;
  } else {
    instagramWorkspaceWindow = popup;
  }

  popup.focus();
  return true;
}

export async function copyWorkspaceMessage(message: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(message);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = message;
  textarea.style.left = "-9999px";
  textarea.style.position = "fixed";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
