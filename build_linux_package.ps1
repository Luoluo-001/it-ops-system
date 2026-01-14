# IT运维管理系统 - Linux打包脚本

$PackageName = "it-ops-system-linux-v1.3"
$SourceDir = "."
$TempDir = "temp_package"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IT运维管理系统 - Linux打包脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 清理旧文件
if (Test-Path $TempDir) { Remove-Item -Path $TempDir -Recurse -Force }
if (Test-Path "$PackageName.zip") { Remove-Item -Path "$PackageName.zip" -Force }

# 创建临时目录
Write-Host "创建打包目录..." -ForegroundColor Green
New-Item -ItemType Directory -Path $TempDir | Out-Null

# 复制核心文件
Write-Host "复制核心文件..." -ForegroundColor Green
Copy-Item -Path "app.py" -Destination $TempDir
Copy-Item -Path "requirements.txt" -Destination $TempDir
Copy-Item -Path "README.md" -Destination $TempDir
Copy-Item -Path ".env.sample" -Destination $TempDir
Copy-Item -Path "start.sh" -Destination $TempDir
Copy-Item -Path "stop.sh" -Destination $TempDir
Copy-Item -Path "install.sh" -Destination $TempDir
Copy-Item -Path "start.bat" -Destination $TempDir

# 复制静态文件
Write-Host "复制静态文件..." -ForegroundColor Green
Copy-Item -Path "static" -Destination "$TempDir\static" -Recurse

# 创建必要目录
New-Item -ItemType Directory -Path "$TempDir\uploads" | Out-Null
New-Item -ItemType Directory -Path "$TempDir\instance" | Out-Null
Set-Content -Path "$TempDir\instance\README.txt" -Value "数据库文件将在首次运行时自动创建"
Set-Content -Path "$TempDir\uploads\README.txt" -Value "上传的文件将存储在此目录"

# 打包
Write-Host "压缩打包..." -ForegroundColor Green
Compress-Archive -Path "$TempDir\*" -DestinationPath "$PackageName.zip" -Force

# 清理
Remove-Item -Path $TempDir -Recurse -Force

Write-Host "打包完成: $PackageName.zip" -ForegroundColor Green
