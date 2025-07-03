$body = @{
    timestamp = "2025-07-03T02:00:00Z"
    server_name = "s30713"
    cpu_percent = 25.5
    memory_percent = 60.2
    disk_percent = 45.8
} | ConvertTo-Json

Write-Host "Sending data: $body"

try {
    $response = Invoke-RestMethod -Uri 'https://vps-monitor-api.gp96123.workers.dev/api/servers/s30713/data' -Method POST -ContentType 'application/json' -Body $body
    Write-Host "Success: $($response | ConvertTo-Json)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host "Response: $($_.ErrorDetails.Message)"
}
