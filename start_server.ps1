Set-Location "c:\Users\yunding\Desktop\coding\it-ops-system"
Write-Host "========================================" -ForegroundColor Green
Write-Host "   IT运维系统正在启动..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "当前目录: $(Get-Location)" -ForegroundColor Yellow
Write-Host "Python版本: " -NoNewline
py --version
Write-Host ""
Write-Host "启动Flask服务器..." -ForegroundColor Cyan
Write-Host "服务地址: http://localhost:5000" -ForegroundColor Cyan
Write-Host "管理员账号: admin" -ForegroundColor Cyan
Write-Host "初始密码: Flzx3qc@2024" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$env:FLASK_APP = "app"
$env:FLASK_DEBUG = "1"

py -m flask run --host=0.0.0.0 --port=5000
