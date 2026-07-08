# Google Places API Oficial

O LeadCore usa Google Places como fonte principal de leads pela API oficial. Nao implemente scraping do Google Maps, automacao de navegador, proxies ou CAPTCHA.

## Configuracao

1. Crie ou selecione um projeto no Google Cloud.
2. Ative billing, Places API e, se quiser usar o raio com mais precisao, Geocoding API.
3. Gere uma API key restrita para uso no servidor.
4. Defina a variavel:

```bash
GOOGLE_PLACES_API_KEY=your-google-places-api-key
```

Na Vercel, adicione a variavel em Production e faca novo deploy.

## Como Funciona

A busca usa Text Search (New), endpoint oficial:

```text
POST https://places.googleapis.com/v1/places:searchText
```

O app envia uma consulta como `restaurante em Sao Paulo, SP, Brasil`, usa `includedType` quando a categoria tem equivalencia no Google e pede apenas campos necessarios via `X-Goog-FieldMask`: nome, endereco, telefone, site, mapa, coordenadas, nota e quantidade de reviews.

Quando a Geocoding API estiver ativa, o app resolve a cidade e envia `locationBias` circular com o raio escolhido. Se a geocodificacao falhar, a busca continua pela cidade no texto.

## Engenharia Aplicada

O LeadCore aproveita a mesma logica de produto de plataformas de prospeccao: categoria + local, filtros antes de salvar, normalizacao dos campos, deduplicacao por `place_id`, fonte rastreavel e envio para CRM.

O que nao entra no projeto:

- Selenium, extensoes, scraping de HTML do Google Maps ou automacao de navegador.
- Proxy, CAPTCHA solver, rotacao de IP ou tecnicas para evitar bloqueios.
- Rehospedagem de base Google Maps fora das regras da Google Maps Platform.

Para uso comercial persistente, prefira enriquecer e confirmar dados por fontes permitidas, como site da empresa, CSV proprio, CNPJ Brasil ou dados informados pelo usuario. Trate Places API como fonte oficial de descoberta e rastreio.

## Limites

- O app limita a busca do Google Places a ate 60 resultados por consulta.
- Resultados dependem de quota, billing e permissoes configuradas no Google Cloud.
- Telefone/site podem vir vazios conforme disponibilidade no cadastro oficial.
- A tela permite filtrar resultados com telefone e site antes de salvar.
