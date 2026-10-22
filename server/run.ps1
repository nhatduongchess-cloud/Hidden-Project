$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (!(Test-Path '.venv/Scripts/python.exe')) {
    py -3.12 -m venv .venv
}
& .venv/Scripts/python.exe -m pip install -r server/requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Không cài được thư viện dịch vụ.' }
$env:FLEET_DEV = '1'
& .venv/Scripts/python.exe -m uvicorn server.app:create_app --factory --host 127.0.0.1 --port 8000
