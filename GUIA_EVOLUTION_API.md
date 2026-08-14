# 🚀 GUIA DE DEPLOY RÁPIDO: EVOLUTION API PARA O PUBLEADS

Este guia mostra como subir sua instância da **Evolution API** em menos de 5 minutos, seja de forma **100% gratuita na nuvem** ou na sua **própria máquina / VPS**.

---

## 🌟 OPÇÃO 1: Deploy Gratuito na Nuvem (Render / Railway / Koyeb)

### No Render.com (Recomendado & Grátis):
1. Crie uma conta gratuita em [Render.com](https://render.com).
2. Clique em **New +** > **Web Service**.
3. Selecione **"Deploy an existing image"** e cole a imagem oficial:
   ```
   atendai/evolution-api:v2.2.3
   ```
4. Em **Environment Variables**, adicione:
   * `AUTHENTICATION_API_KEY`: `SuaChaveSecretaPubLeads2026`
   * `SERVER_URL`: A URL gerada pelo Render (ex: `https://evolution-api-xxxx.onrender.com`)
   * `DATABASE_ENABLED`: `false` (ou use PostgreSQL grátis do Supabase)
   * `CONFIG_SESSION_PHONE_CLIENT`: `PubLeads`
5. Clique em **Deploy Web Service**.
6. Copie a URL gerada e a API Key e cole na aba **Conexões WhatsApp** do PubLeads!

---

## 💻 OPÇÃO 2: Rodar Localmente ou em VPS com Docker

Criamos o arquivo [`docker-compose.evolution.yml`](file:///C:/Users/Matheus%20Paes/.gemini/antigravity/scratch/pub-leads/docker-compose.evolution.yml) pronto na raiz do projeto.

### Passo a passo:
1. Abra o terminal na pasta do projeto e rode:
   ```bash
   docker compose -f docker-compose.evolution.yml up -d
   ```
2. O servidor estará rodando em:
   * **URL:** `http://localhost:8080`
   * **API Key Padrão:** `PubLeadsSecretKey2026`

### Se estiver testando no PubLeads em produção (Vercel):
Para conectar o PubLeads (Vercel) à sua máquina local, use o **Ngrok** ou **Localtunnel** para gerar uma URL pública HTTPS:
```bash
npx localtunnel --port 8080
# ou
ngrok http 8080
```
Use a URL `https://xxxx.loca.lt` gerada no painel de conexões do PubLeads.

---

## 📲 Como Conectar no Painel do PubLeads

1. Acesse **[https://publeads.vercel.app/app/conexoes](https://publeads.vercel.app/app/conexoes)**.
2. Clique em **Conectar Novo Número**.
3. Preencha:
   - **Nome:** `Comercial 01`
   - **URL do Servidor:** `https://sua-evolution-api.com` (sem barra no final)
   - **API Key:** `SuaChaveSecretaPubLeads2026`
4. Clique em **Gerar Conexão** e escaneie o QR Code na tela com o seu WhatsApp!
