# Start all services in separate PowerShell windows

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition)

Write-Host "Starting all services from: $ProjectRoot" -ForegroundColor Cyan

# grievance-service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$host.UI.RawUI.WindowTitle = 'grievance-service';
  Set-Location '$ProjectRoot\grievance-service';
  pnpm start --port 8005
"

Start-Sleep -Seconds 1

# ml-service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$host.UI.RawUI.WindowTitle = 'ml-service';
  Set-Location '$ProjectRoot\ml-service';
  uvicorn main:app --reload
"

Start-Sleep -Seconds 1

# certificate-service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$host.UI.RawUI.WindowTitle = 'certificate-service';
  Set-Location '$ProjectRoot\certificate-service';
  uvicorn main:app --reload
"

Start-Sleep -Seconds 1

# anomaly-service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$host.UI.RawUI.WindowTitle = 'anomaly-service';
  Set-Location '$ProjectRoot\anomaly-service';
  uvicorn main:app --reload
"

Start-Sleep -Seconds 1

# root frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$host.UI.RawUI.WindowTitle = 'root-frontend';
  Set-Location '$ProjectRoot';
  pnpm run start
"

Write-Host "All services launched." -ForegroundColor Green