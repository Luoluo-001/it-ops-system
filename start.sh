#!/bin/bash
# IT运维管理系统 - Linux启动脚本

echo "========================================"
echo "  IT运维管理系统启动脚本"
echo "========================================"

# 检查Python版本
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python 3.7+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "检测到Python版本: $PYTHON_VERSION"

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "创建Python虚拟环境..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "错误: 虚拟环境创建失败"
        exit 1
    fi
fi

# 激活虚拟环境
echo "激活虚拟环境..."
source venv/bin/activate

# 安装依赖
echo "检查并安装依赖..."
pip install -r requirements.txt

# 创建必要目录
mkdir -p uploads
mkdir -p instance

# 启动应用
echo "========================================"
echo "启动IT运维管理系统..."
echo "访问地址: http://localhost:5000"
echo "默认账号: admin"
echo "默认密码: Flzx3qc@2024"
echo "========================================"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

python3 app.py
