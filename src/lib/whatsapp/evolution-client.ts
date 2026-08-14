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
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok && response.status !== 403) {
    const text = await response.text();
    throw new Error(`Erro ao criar instância na Evolution API: ${text || response.statusText}`);
  }

  return response.json();
}

export async function getEvolutionQRCode(serverUrl: string, apiKey: string, instanceName: string) {
  const base = normalizeServerUrl(serverUrl);
  const response = await fetch(`${base}/instance/connect/${encodeURIComponent(instanceName)}`, {
    method: "GET",
    headers: {
      apikey: apiKey,
    },
    signal: AbortSignal.timeout(10000),
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
    const response = await fetch(`${base}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
      method: "GET",
      headers: {
        apikey: apiKey,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return { state: "close" };
    }

    const data = (await response.json()) as EvolutionStatusResponse;
    const state = (data.instance?.state ?? data.state ?? data.status ?? "close").toLowerCase();
    return { state };
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
  // Formata o número (apenas dígitos, ex: 5511999998888)
  const cleanPhone = phone.replace(/\D/g, "");

  if (!cleanPhone) {
    throw new Error("Número de telefone inválido.");
  }

  const response = await fetch(`${base}/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      number: cleanPhone,
      text,
      linkPreview: false,
    }),
    signal: AbortSignal.timeout(15000),
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
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // Ignora se já tiver sido removida
  }
}
