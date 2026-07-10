const whatsappWorkspaceWindowName = "publeads_whatsapp_workspace";
const instagramWorkspaceWindowName = "publeads_instagram_workspace";

export function openReusableWorkspaceWindow(url: string, channel: "instagram" | "whatsapp") {
  if (typeof window === "undefined") {
    return false;
  }

  const target = channel === "whatsapp" ? whatsappWorkspaceWindowName : instagramWorkspaceWindowName;
  const popup = window.open(url, target);

  if (!popup) {
    return false;
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
