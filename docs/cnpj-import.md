# Importacao de Dados Abertos de CNPJ

Use esta base como fonte gratuita principal de leads com telefone. OpenStreetMap/Overpass fica como complemento, e o projeto nao deve fazer scraping direto do Google Maps.

## Fonte Oficial

Baixe os arquivos de Dados Abertos de CNPJ no diretorio oficial da Receita Federal:

- https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/
- Portal de Dados Abertos: https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj

Para a base funcionar bem no scraper, extraia tambem os arquivos de `Municipios` e `Cnaes`. O arquivo de estabelecimentos usa codigo de municipio; sem o cruzamento, buscar por nome da cidade pode voltar vazio.

## Preparar Banco

Configure Turso e aplique o schema:

```bash
npm run turso:setup
```

O schema cria `cnpj_establishments`, leads, notas, mensagens, logs de busca e indices. Supabase continua apenas para Auth, profiles, planos e billing.

## Importar CSV

Configure `.env.local` com `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. Nunca exponha o token do Turso no client.

Baixe os ZIPs da Receita, extraia tudo em uma pasta e rode:

```bash
npx tsx scripts/import-cnpj-csv.ts ./cnpj-extraido/extracted --batch-size=1000 --only-active
```

Para comecar mais rapido, importe so uma UF ou cidade:

```bash
npx tsx scripts/import-cnpj-csv.ts ./cnpj-extraido/extracted --uf=SP --city="Sao Paulo" --only-active --limit=50000
```

Se preferir informar os arquivos manualmente:

```bash
npx tsx scripts/import-cnpj-csv.ts ./Estabelecimentos0.csv --municipios=./Municipios.csv --cnaes=./Cnaes.csv --batch-size=1000 --only-active
```

Opcoes:

- `--batch-size=1000`: quantidade de registros por upsert.
- `--only-active`: importa apenas situacao cadastral `02`.
- `--uf=SP`: importa somente uma UF.
- `--city="Sao Paulo"`: importa somente uma cidade, ja cruzada com `Municipios`.
- `--limit=1000`: limita linhas processadas para teste.
- `--municipios=...`: arquivo de municipios da Receita.
- `--cnaes=...`: arquivo de CNAEs da Receita.

O script ignora linhas sem CNPJ valido, UF ou municipio, normaliza telefones, cruza nome de cidade/CNAE quando os arquivos de referencia estao presentes e registra progresso no terminal.

## Download Rapido no Windows

Para baixar os arquivos oficiais e extrair automaticamente:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/download-cnpj-data.ps1 -Estabelecimentos 1
```

Esse comando baixa `Municipios.zip`, `Cnaes.zip` e `Estabelecimentos1.zip`. E um teste mais leve, mas nao cobre o Brasil inteiro. Para baixar todos os estabelecimentos, use:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/download-cnpj-data.ps1 -AllEstabelecimentos
```

Depois rode a importacao com filtro de UF/cidade para nao subir dados demais no primeiro teste.

## Teste Rapido

1. Entre no app autenticado.
2. Acesse `/app/scraper`.
3. Use a fonte `Venda de Sites (CNPJ + OSM)`.
4. Informe cidade, UF, categoria, raio e limite.
5. Mantenha `Com telefone` e `Sem site conhecido` marcados.
6. Salve um lead e confira os campos em `/app/leads`.

O modo `Venda de Sites` consulta CNPJ Brasil e OpenStreetMap, deduplica por telefone/CNPJ e prioriza empresas com contato publico e sem site conhecido. Se a base CNPJ ainda estiver vazia, o app tenta retornar resultados do OpenStreetMap e mostra um aviso.

## Observacoes de Dados

O script importa `razao_social` como `null` porque a razao social fica nos arquivos de Empresas, que sao grandes. A busca ainda funciona por nome fantasia, cidade, UF, telefone e descricao de CNAE. Se precisar de razao social completa, importe os dados de Empresas em uma etapa dedicada antes de enriquecer estabelecimentos.

Se a busca CNPJ retornar a mensagem de base vazia, o schema foi executado, mas nenhum CSV foi importado em `cnpj_establishments` no Turso.

## Compliance

- Use somente dados publicos de CNPJ e dados fornecidos pelo usuario.
- Nao importe socios nem dados pessoais sensiveis para prospeccao.
- Nao use proxies, CAPTCHA bypass ou automacao proibida.
- Para WhatsApp, use apenas link `wa.me` com mensagem pronta no MVP.
- Inclua opt-out em abordagens comerciais e respeite consentimento, LGPD e politicas da plataforma.
