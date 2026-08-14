type EvolutionConnectResponse = {
  instance?: {
    instanceName?: string;
    status?: string;
  };
  qrcode?: {
    base64?: string;
    code?: string;
  };
  base64?: string;
  code?: string;
};

type EvolutionStatusResponse = {
  instance?: {
    state?: string;
  };
  state?: string;
  status?: string;
};

function normalizeServerUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Normaliza números de telefone do Brasil garantindo o DDI 55
 */
export function normalizePhoneForEvolution(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.length === 10 || clean.length === 11) {
    clean = `55${clean}`;
  }
  return clean;
}

export async function createEvolutionInstance(serverUrl: string, apiKey: string, instanceName: string) {
  const base = normalizeServerUrl(serverUrl);
  const response = await fetch(`${base}/instance/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok && response.status !== 403) {
    const text = await response.text();
    throw new Error(`Erro ao criar instância na Evolution API: ${text || response.statusText}`);
  }

  const data = (await response.json()) as EvolutionConnectResponse;
  const base64 = data.qrcode?.base64 ?? data.base64 ?? null;
  const code = data.qrcode?.code ?? data.code ?? null;

  return { data, qrcode: base64 ? { base64, code } : null };
}

export async function getEvolutionQRCode(serverUrl: string, apiKey: string, instanceName: string) {
  const base = normalizeServerUrl(serverUrl);
  const response = await fetch(`${base}/instance/connect/${encodeURIComponent(instanceName)}`, {
    method: "GET",
    headers: {
      apikey: apiKey,
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao obter QR Code da Evolution API: ${text || response.statusText}`);
  }

  const data = (await response.json()) as EvolutionConnectResponse;
  const base64 = data.qrcode?.base64 ?? data.base64 ?? null;
  const code = data.qrcode?.code ?? data.code ?? null;

  return { base64, code };
}

export async function getEvolutionInstanceStatus(serverUrl: string, apiKey: string, instanceName: string) {
  const base = normalizeServerUrl(serverUrl);
  try {
    // 1. Tenta connectionState direto
    const response = await fetch(`${base}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
      method: "GET",
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(6000),
    });

    if (response.ok) {
      const data = (await response.json()) as EvolutionStatusResponse;
      const state = (data.instance?.state ?? data.state ?? data.status ?? "").toLowerCase();
      if (state === "open" || state === "connected") {
        return { state: "open" };
      }
      if (state === "connecting") {
        return { state: "connecting" };
      }
    }

    // 2. Fallback de alta precisão: Checa em fetchInstances
    const fetchResp = await fetch(`${base}/instance/fetchInstances`, {
      method: "GET",
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(6000),
    });

    if (fetchResp.ok) {
      const instances = (await fetchResp.json()) as Array<{
        name?: string;
        connectionStatus?: string;
        ownerJid?: string;
      }>;
      const found = instances.find((i) => i.name === instanceName);
      if (found) {
        const st = (found.connectionStatus ?? "").toLowerCase();
        if (st === "open" || st === "connected" || Boolean(found.ownerJid)) {
          return { state: "open" };
        }
        if (st === "connecting") {
          return { state: "connecting" };
        }
      }
    }

    return { state: "close" };
  } catch {
    return { state: "close" };
  }
}

export async function sendEvolutionTextMessage(
  serverUrl: string,
  apiKey: string,
  instanceName: string,
  phone: string,
  text: string,
) {
  const base = normalizeServerUrl(serverUrl);
  const formattedPhone = normalizePhoneForEvolution(phone);

  if (!formattedPhone) {
    throw new Error("Número de telefone inválido.");
  }

  const response = await fetch(`${base}/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      number: formattedPhone,
      text,
      delay: 0,
      linkPreview: false,
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    const resText = await response.text();
    throw new Error(`Erro ao enviar mensagem via WhatsApp: ${resText || response.statusText}`);
  }

  return response.json();
}

export async function deleteEvolutionInstance(serverUrl: string, apiKey: string, instanceName: string) {
  const base = normalizeServerUrl(serverUrl);
  try {
    await fetch(`${base}/instance/delete/${encodeURIComponent(instanceName)}`, {
      method: "DELETE",
      headers: {
        apikey: apiKey,
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    // Ignora se já tiver sido removida
  }
}
