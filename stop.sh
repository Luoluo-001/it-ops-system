#!/bin/bash
# IT运维管理系统 - 停止脚本

echo "正在停止IT运维管理系统..."

# 查找并终止Python进程
PID=$(ps aux | grep "python.*app.py" | grep -v grep | awk '{print $2}')

if [ -z "$PID" ]; then
    echo "未找到运行中的服务"
else
    kill $PID
    echo "服务已停止 (PID: $PID)"
fi
