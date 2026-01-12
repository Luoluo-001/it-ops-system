# IT运维管理系统 - Linux打包脚本

$PackageName = "it-ops-system-linux-v1.0"
$SourceDir = "."
$TempDir = "temp_package"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IT运维管理系统 - Linux打包脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 清理旧文件
if (Test-Path $TempDir) {
    Remove-Item -Path $TempDir -Recurse -Force
}
if (Test-Path "$PackageName.zip") {
    Remove-Item -Path "$PackageName.zip" -Force
}

# 创建临时目录
Write-Host "创建打包目录..." -ForegroundColor Green
New-Item -ItemType Directory -Path $TempDir | Out-Null

# 复制核心文件
Write-Host "复制核心文件..." -ForegroundColor Green
Copy-Item -Path "app.py" -Destination $TempDir
Copy-Item -Path "requirements.txt" -Destination $TempDir
Copy-Item -Path "README.md" -Destination $TempDir
Copy-Item -Path "start.sh" -Destination $TempDir
Copy-Item -Path "stop.sh" -Destination $TempDir
Copy-Item -Path "install.sh" -Destination $TempDir
Copy-Item -Path "start.bat" -Destination $TempDir

# 复制静态文件
Write-Host "复制静态文件..." -ForegroundColor Green
Copy-Item -Path "static" -Destination "$TempDir\static" -Recurse

# 创建空目录和说明文件
Write-Host "创建必要目录..." -ForegroundColor Green
New-Item -ItemType Directory -Path "$TempDir\uploads" | Out-Null
New-Item -ItemType Directory -Path "$TempDir\instance" | Out-Null

Set-Content -Path "$TempDir\instance\README.txt" -Value "数据库文件将在首次运行时自动创建"
Set-Content -Path "$TempDir\uploads\README.txt" -Value "上传的文件将存储在此目录"

# 创建部署说明
$DeployContent = @"
# Linux部署说明

## 快速部署

1. 上传zip文件到Linux服务器
2. 解压文件：
   unzip $PackageName.zip
   cd $PackageName

3. 运行安装脚本：
   chmod +x install.sh
   ./install.sh

4. 启动服务：
   ./start.sh

5. 访问系统：
   http://服务器IP:5000
   默认账号: admin
   默认密码: Flzx3qc@2024

## 生产环境建议

1. 修改app.py中的SECRET_KEY
2. 将debug=True改为debug=False
3. 使用Nginx反向代理
4. 配置systemd服务自动启动

## 故障排除

端口占用：
lsof -i :5000
kill -9 <PID>

查看日志：
tail -f nohup.out
"@

Set-Content -Path "$TempDir\DEPLOY.txt" -Value $DeployContent

# 打包
Write-Host "压缩打包..." -ForegroundColor Green
Compress-Archive -Path $TempDir -DestinationPath "$PackageName.zip" -Force

# 清理临时文件
Write-Host "清理临时文件..." -ForegroundColor Green
Remove-Item -Path $TempDir -Recurse -Force

# 显示结果
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  打包完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "发布包: $PackageName.zip" -ForegroundColor Yellow
$FileSize = (Get-Item "$PackageName.zip").Length / 1KB
Write-Host "大小: $([math]::Round($FileSize, 2)) KB" -ForegroundColor Yellow
Write-Host ""
Write-Host "Linux部署步骤：" -ForegroundColor Cyan
Write-Host "1. 上传zip文件到Linux服务器" -ForegroundColor White
Write-Host "2. unzip $PackageName.zip" -ForegroundColor White
Write-Host "3. cd $PackageName" -ForegroundColor White
Write-Host "4. chmod +x install.sh && ./install.sh" -ForegroundColor White
Write-Host "5. ./start.sh" -ForegroundColor White
Write-Host ""
Write-Host "完成！" -ForegroundColor Green
