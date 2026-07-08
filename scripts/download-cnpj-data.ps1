param(
  [string]$Month = "",
  [string]$Destination = ".\cnpj-extraido",
  [int[]]$Estabelecimentos = @(1),
  [switch]$AllEstabelecimentos,
  [switch]$SkipExtract
)

$ErrorActionPreference = "Stop"

$webDavToken = "gn672Ad4CF8N6TK"
$baseRoot = "https://arquivos.receitafederal.gov.br/public.php/webdav/Dados/Cadastros/CNPJ"
$userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PubLeads/1.0"

function Get-WebDavBasicAuthHeader {
  $bytes = [System.Text.Encoding]::ASCII.GetBytes("${webDavToken}:")
  return "Basic $([Convert]::ToBase64String($bytes))"
}

function Invoke-WebDavPropfind {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue

  if ($curl) {
    $content = & $curl.Source `
      -s `
      -u "${webDavToken}:" `
      -X PROPFIND `
      -H "Depth: 1" `
      -A $userAgent `
      --connect-timeout 30 `
      $Url

    if ($LASTEXITCODE -ne 0) {
      throw "Falha ao listar WebDAV da Receita: $Url"
    }

    return ($content -join "`n")
  }

  $request = [System.Net.HttpWebRequest]::Create($Url)
  $request.Method = "PROPFIND"
  $request.Headers.Add("Depth", "1")
  $request.Headers.Add("Authorization", (Get-WebDavBasicAuthHeader))
  $request.UserAgent = $userAgent
  $request.Timeout = 30000

  $response = $request.GetResponse()
  try {
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    try {
      return $reader.ReadToEnd()
    } finally {
      $reader.Dispose()
    }
  } finally {
    $response.Dispose()
  }
}

function Assert-ZipFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Arquivo nao encontrado apos download: $Path"
  }

  $item = Get-Item -LiteralPath $Path
  if ($item.Length -lt 4) {
    throw "Arquivo baixado esta vazio ou incompleto: $Path"
  }

  $stream = [System.IO.File]::OpenRead($item.FullName)
  try {
    $bytes = New-Object byte[] 4
    [void]$stream.Read($bytes, 0, 4)

    if ($bytes[0] -ne 0x50 -or $bytes[1] -ne 0x4B) {
      throw "A Receita retornou uma resposta que nao parece ZIP para: $($item.Name). Verifique se a URL oficial esta disponivel no navegador."
    }
  } finally {
    $stream.Dispose()
  }
}

function Invoke-ReceitaDownload {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,

    [Parameter(Mandatory = $true)]
    [string]$OutFile
  )

  $partialPath = "$OutFile.partial"
  if (Test-Path -LiteralPath $partialPath) {
    Remove-Item -LiteralPath $partialPath -Force
  }

  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue

  if ($curl) {
    & $curl.Source `
      -L `
      --fail `
      --retry 3 `
      --retry-delay 5 `
      --connect-timeout 30 `
      -A $userAgent `
      -u "${webDavToken}:" `
      -o $partialPath `
      $Url

    if ($LASTEXITCODE -ne 0) {
      if (Test-Path -LiteralPath $partialPath) {
        Remove-Item -LiteralPath $partialPath -Force
      }

      throw "Falha no download via curl.exe: $Url"
    }
  } else {
    Invoke-WebRequest `
      -UseBasicParsing `
      -Headers @{ "User-Agent" = $userAgent; "Accept" = "application/zip,*/*"; "Authorization" = (Get-WebDavBasicAuthHeader) } `
      -Uri $Url `
      -OutFile $partialPath
  }

  Assert-ZipFile -Path $partialPath
  Move-Item -LiteralPath $partialPath -Destination $OutFile -Force
}

if (-not $Month) {
  Write-Host "Detectando mes mais recente no diretorio oficial da Receita..."
  $index = Invoke-WebDavPropfind -Url "$baseRoot/"
  $months = [regex]::Matches($index, '/CNPJ/(\d{4}-\d{2})/') |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Descending

  if (-not $months -or $months.Count -eq 0) {
    throw "Nao foi possivel detectar o mes mais recente da Receita."
  }

  $Month = $months[0]
}

$zipDir = Join-Path $Destination "zips"
$extractDir = Join-Path $Destination "extracted"
New-Item -ItemType Directory -Force -Path $zipDir, $extractDir | Out-Null

$establishmentIndexes = if ($AllEstabelecimentos) { 0..9 } else { $Estabelecimentos }
$files = @("Municipios.zip", "Cnaes.zip") + ($establishmentIndexes | ForEach-Object { "Estabelecimentos$_.zip" })

Write-Host "Fonte: $baseRoot/$Month/"
Write-Host "Destino: $Destination"
Write-Host "Arquivos: $($files -join ', ')"

foreach ($file in $files) {
  $url = "$baseRoot/$Month/$file"
  $zipPath = Join-Path $zipDir $file

  if (Test-Path $zipPath) {
    try {
      Assert-ZipFile -Path $zipPath
      Write-Host "Ja baixado: $file"
    } catch {
      Write-Host "Arquivo existente invalido, baixando novamente: $file"
      Remove-Item -LiteralPath $zipPath -Force
      Invoke-ReceitaDownload -Url $url -OutFile $zipPath
    }
  } else {
    Write-Host "Baixando: $file"
    Invoke-ReceitaDownload -Url $url -OutFile $zipPath
  }

  if (-not $SkipExtract) {
    Write-Host "Extraindo: $file"
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
  }
}

Write-Host ""
Write-Host "Pronto. Arquivos extraidos em:"
Write-Host $extractDir
Write-Host ""
Write-Host "Agora importe para o Turso. Exemplo:"
Write-Host "npx tsx scripts/import-cnpj-csv.ts `"$extractDir`" --uf=SP --city=`"Sao Paulo`" --only-active --limit=50000"
