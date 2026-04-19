# Build all services sequentially in the current terminal

$ProjectRoot = Get-Item $PSScriptRoot | Select-Object -ExpandProperty Parent | Select-Object -ExpandProperty FullName

Write-Host "`nBuilding all services from: $ProjectRoot`n" -ForegroundColor Cyan

$ErrorCount = 0

function Run-Build {
  param($Label, $Dir, $Cmd)

  Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
  Write-Host "  [$Label]" -ForegroundColor Yellow
  Write-Host "  > $Cmd" -ForegroundColor DarkGray
  Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

  Push-Location "$ProjectRoot\$Dir"
  Invoke-Expression $Cmd
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  [FAILED] $Label exited with code $LASTEXITCODE" -ForegroundColor Red
    $script:ErrorCount++
  } else {
    Write-Host "  [OK] $Label" -ForegroundColor Green
  }
  Pop-Location
  Write-Host ""
}

# Node.js services
Run-Build "grievance-service"  "grievance-service"  "pnpm run build"
Run-Build "root"               "."                  "pnpm run build"

# FastAPI services (activate venv first, then install)
Run-Build "ml-service"          "ml-service"          ".\.venv\Scripts\activate; uv pip install -r requirements.txt"
Run-Build "certificate-service" "certificate-service" ".\.venv\Scripts\activate; uv pip install -r requirements.txt"
Run-Build "anomaly-service"     "anomaly-service"     ".\.venv\Scripts\activate; uv pip install -r requirements.txt"

# Summary
Write-Host "============================================================" -ForegroundColor DarkGray
if ($ErrorCount -eq 0) {
  Write-Host "  All services built successfully." -ForegroundColor Green
} else {
  Write-Host "  $ErrorCount service(s) failed. Check output above." -ForegroundColor Red
}
Write-Host "============================================================`n" -ForegroundColor DarkGray