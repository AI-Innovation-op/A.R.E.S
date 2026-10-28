# Requiere PowerShell como administrador. No reinicia Windows automáticamente.
$ErrorActionPreference = 'Continue'
$setupLogDirectory = Join-Path $PSScriptRoot '..\.local-setup'
New-Item -ItemType Directory -Force -Path $setupLogDirectory | Out-Null
$setupLogPath = Join-Path $setupLogDirectory 'wsl-install.log'
& winget install --id Microsoft.WSL --exact --source winget --silent --disable-interactivity *> $setupLogPath
if ($LASTEXITCODE -eq 0) {
    & wsl --install --no-distribution *>> $setupLogPath
}
'Proceso de preparación WSL terminado; revisa si Windows solicita reiniciar.' | Add-Content -LiteralPath $setupLogPath
