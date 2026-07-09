import {
  extractInstagramFromTextOrUrl,
  type InstagramStatus,
} from "@/src/lib/lead-qualification/qualifier";

export type InstagramDiscoveryResult = {
  instagram_status: InstagramStatus;
  instagram_url: string | null;
  instagram_handle: string | null;
  instagram_checked_at: string;
};

const timeoutMs = 3500;
const maxHtmlLength = 250_000;

function normalizeWebsiteUrl(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

async function fetchHtml(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "PubLeads contact qualification bot",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html")) {
      return null;
    }

    return (await response.text()).slice(0, maxHtmlLength);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getSafeInternalLinks(html: string, baseUrl: URL) {
  const links = Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
    .map((match) => match[1])
    .map((href) => {
      try {
        return new URL(href, baseUrl);
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => Boolean(url))
    .filter((url) => url.hostname === baseUrl.hostname)
    .filter((url) => /contato|contact|sobre|about/i.test(url.pathname))
    .slice(0, 2);

  return Array.from(new Map(links.map((url) => [url.toString(), url])).values());
}

function foundResult(value: ReturnType<typeof extractInstagramFromTextOrUrl>): InstagramDiscoveryResult | null {
  if (!value) {
    return null;
  }

  return {
    instagram_checked_at: new Date().toISOString(),
    instagram_handle: value.handle,
    instagram_status: "found",
    instagram_url: value.url,
  };
}

export async function discoverInstagramFromWebsite(
  website: string | null | undefined,
): Promise<InstagramDiscoveryResult> {
  const checkedAt = new Date().toISOString();
  const baseUrl = normalizeWebsiteUrl(website);

  if (!baseUrl) {
    return {
      instagram_checked_at: checkedAt,
      instagram_handle: null,
      instagram_status: "missing",
      instagram_url: null,
    };
  }

  const directInstagram = foundResult(extractInstagramFromTextOrUrl(baseUrl.toString()));

  if (directInstagram) {
    return directInstagram;
  }

  const homeHtml = await fetchHtml(baseUrl);

  if (!homeHtml) {
    return {
      instagram_checked_at: checkedAt,
      instagram_handle: null,
      instagram_status: "unknown",
      instagram_url: null,
    };
  }

  const homeInstagram = foundResult(extractInstagramFromTextOrUrl(homeHtml));

  if (homeInstagram) {
    return homeInstagram;
  }

  for (const link of getSafeInternalLinks(homeHtml, baseUrl)) {
    const html = await fetchHtml(link);
    const found = foundResult(extractInstagramFromTextOrUrl(html));

    if (found) {
      return found;
    }
  }

  return {
    instagram_checked_at: checkedAt,
    instagram_handle: null,
    instagram_status: "missing",
    instagram_url: null,
  };
}
