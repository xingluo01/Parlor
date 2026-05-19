Write-Output "[Parlor] Starting server..."

# Kill any existing server on port 3001
$connections = netstat -ano | Select-String ":3001.*LISTENING"
foreach ($conn in $connections) {
    $parts = $conn -split '\s+'
    $pid = $parts[-1]
    if ($pid -and $pid -ne '0') {
        Write-Output "[Parlor] Stopping previous server (PID $pid)..."
        taskkill /F /PID $pid 2>$null
        Start-Sleep -Seconds 1
    }
}

# Start server
$serverPath = Join-Path (Split-Path $PSScriptRoot -Parent) "server.cjs"
Write-Output "[Parlor] Starting: node $serverPath"
Write-Output "[Parlor] Parlor is running at http://localhost:3001"

$process = Start-Process -FilePath "node" -ArgumentList $serverPath -NoNewWindow -PassThru
Write-Output "[Parlor] Server started with PID: $($process.Id)"
