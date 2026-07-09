import {
  extractInstagramFromTextOrUrl,
  normalizeBrazilianPhone,
  type InstagramStatus,
  type WhatsappStatus,
} from "@/src/lib/lead-qualification/qualifier";

export type ContactEnrichmentResult = {
  email: string | null;
  enrichment_checked_at: string;
  enrichment_source: string | null;
  instagram_checked_at: string;
  instagram_handle: string | null;
  instagram_status: InstagramStatus;
  instagram_url: string | null;
  phone: string | null;
  website_checked: string | null;
  whatsapp_candidate: string | null;
  whatsapp_checked_at: string;
  whatsapp_status: WhatsappStatus;
  metadata: {
    found_email: boolean;
    found_phone: boolean;
    found_whatsapp_link: boolean;
    pages_checked: string[];
  };
};

const timeoutMs = 3500;
const maxHtmlLength = 250_000;
const contactPathPattern = /contato|contact|sobre|about|atendimento|fale-?conosco/i;

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  const ipv4Parts = host.split(".").map((part) => Number(part));
  const isIpv4 = ipv4Parts.length === 4 && ipv4Parts.every((part) => Number.isInteger(part));

  if (host === "localhost" || host === "::1" || host.endsWith(".local")) {
    return true;
  }

  if (isIpv4) {
    const [first, second] = ipv4Parts;

    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first === 169 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  return false;
}

function normalizeWebsiteUrl(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);

    if (!["http:", "https:"].includes(url.protocol) || isPrivateHost(url.hostname)) {
      return null;
    }

    return url;
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

function getHrefLinks(html: string, baseUrl: URL) {
  return Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
    .map((match) => match[1])
    .map((href) => {
      try {
        return new URL(href, baseUrl);
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => Boolean(url));
}

function getSafeInternalLinks(html: string, baseUrl: URL) {
  const links = getHrefLinks(html, baseUrl)
    .filter((url) => url.hostname === baseUrl.hostname)
    .filter((url) => contactPathPattern.test(url.pathname))
    .slice(0, 3);

  return Array.from(new Map(links.map((url) => [url.toString(), url])).values());
}

function extractEmail(html: string) {
  const mailto = html.match(/mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)?.[1];

  if (mailto) {
    return mailto.toLowerCase();
  }

  return html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase() ?? null;
}

function extractPhone(html: string) {
  const matches = html.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-.\s]?\d{4}/g) ?? [];

  for (const match of matches) {
    const normalized = normalizeBrazilianPhone(match);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function extractWhatsAppPhone(url: URL) {
  if (/wa\.me$/i.test(url.hostname)) {
    return normalizeBrazilianPhone(url.pathname.replace(/\D/g, ""));
  }

  if (/whatsapp\.com$/i.test(url.hostname) || /whatsapp\.com$/i.test(url.hostname.replace(/^www\./, ""))) {
    return normalizeBrazilianPhone(url.searchParams.get("phone"));
  }

  return null;
}

function extractPageContacts(html: string, pageUrl: URL) {
  const links = getHrefLinks(html, pageUrl);
  const instagramFromLink =
    links.map((link) => extractInstagramFromTextOrUrl(link.toString())).find(Boolean) ??
    extractInstagramFromTextOrUrl(html);
  const whatsappCandidate =
    links
      .map(extractWhatsAppPhone)
      .find((phone): phone is string => Boolean(phone)) ?? null;
  const phone = whatsappCandidate ?? extractPhone(html);
  const email = extractEmail(html);

  return {
    email,
    instagram_handle: instagramFromLink?.handle ?? null,
    instagram_url: instagramFromLink?.url ?? null,
    phone,
    source: pageUrl.toString(),
    whatsapp_candidate: whatsappCandidate,
  };
}

export async function discoverContactsFromWebsite(
  website: string | null | undefined,
): Promise<ContactEnrichmentResult> {
  const checkedAt = new Date().toISOString();
  const baseUrl = normalizeWebsiteUrl(website);
  const pagesChecked: string[] = [];

  if (!baseUrl) {
    return {
      email: null,
      enrichment_checked_at: checkedAt,
      enrichment_source: null,
      instagram_checked_at: checkedAt,
      instagram_handle: null,
      instagram_status: "missing",
      instagram_url: null,
      metadata: {
        found_email: false,
        found_phone: false,
        found_whatsapp_link: false,
        pages_checked: pagesChecked,
      },
      phone: null,
      website_checked: null,
      whatsapp_candidate: null,
      whatsapp_checked_at: checkedAt,
      whatsapp_status: "unknown",
    };
  }

  let best = {
    email: null as string | null,
    instagram_handle: null as string | null,
    instagram_url: null as string | null,
    phone: null as string | null,
    source: null as string | null,
    whatsapp_candidate: null as string | null,
  };
  const homeHtml = await fetchHtml(baseUrl);

  if (!homeHtml) {
    return {
      email: null,
      enrichment_checked_at: checkedAt,
      enrichment_source: baseUrl.toString(),
      instagram_checked_at: checkedAt,
      instagram_handle: null,
      instagram_status: "unknown",
      instagram_url: null,
      metadata: {
        found_email: false,
        found_phone: false,
        found_whatsapp_link: false,
        pages_checked: pagesChecked,
      },
      phone: null,
      website_checked: baseUrl.toString(),
      whatsapp_candidate: null,
      whatsapp_checked_at: checkedAt,
      whatsapp_status: "unknown",
    };
  }

  const pages = [baseUrl, ...getSafeInternalLinks(homeHtml, baseUrl)];
  const htmlByUrl = new Map([[baseUrl.toString(), homeHtml]]);

  for (const pageUrl of pages) {
    const pageKey = pageUrl.toString();
    const html = htmlByUrl.get(pageKey) ?? (await fetchHtml(pageUrl));

    if (!html) {
      continue;
    }

    pagesChecked.push(pageKey);
    const pageContacts = extractPageContacts(html, pageUrl);

    best = {
      email: best.email ?? pageContacts.email,
      instagram_handle: best.instagram_handle ?? pageContacts.instagram_handle,
      instagram_url: best.instagram_url ?? pageContacts.instagram_url,
      phone: best.phone ?? pageContacts.phone,
      source:
        best.source ??
        (pageContacts.email || pageContacts.instagram_url || pageContacts.phone
          ? pageContacts.source
          : null),
      whatsapp_candidate: best.whatsapp_candidate ?? pageContacts.whatsapp_candidate,
    };

    if (best.email && best.instagram_url && best.whatsapp_candidate) {
      break;
    }
  }

  return {
    email: best.email,
    enrichment_checked_at: checkedAt,
    enrichment_source: best.source ?? baseUrl.toString(),
    instagram_checked_at: checkedAt,
    instagram_handle: best.instagram_handle,
    instagram_status: best.instagram_url ? "found" : "missing",
    instagram_url: best.instagram_url,
    metadata: {
      found_email: Boolean(best.email),
      found_phone: Boolean(best.phone),
      found_whatsapp_link: Boolean(best.whatsapp_candidate),
      pages_checked: pagesChecked,
    },
    phone: best.phone,
    website_checked: baseUrl.toString(),
    whatsapp_candidate: best.whatsapp_candidate,
    whatsapp_checked_at: checkedAt,
    whatsapp_status: best.whatsapp_candidate ? "confirmed" : "unknown",
  };
}
