#!/bin/bash
# IT运维管理系统 - Linux安装脚本

echo "========================================"
echo "  IT运维管理系统安装脚本"
echo "========================================"

# 检查系统类型
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "检测到Linux系统"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "检测到macOS系统"
else
    echo "警告: 未识别的操作系统，可能需要手动安装"
fi

# 检查Python
echo ""
echo "检查Python环境..."
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3"
    echo "请先安装Python 3.7或更高版本 (推荐 3.8+)："
    echo "  Ubuntu/Debian: sudo apt-get install python3 python3-venv python3-pip"
    echo "  CentOS/RHEL:   sudo yum install python3 python3-pip"
    echo "  macOS:         brew install python3"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Python版本: $PYTHON_VERSION"

# 检查版本号是否满足最低要求
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 7 ]); then
    echo "错误: 当前Python版本 ($PYTHON_VERSION) 过低。"
    echo "本程序需要 Python 3.7 或更高版本。"
    exit 1
fi

if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -eq 7 ]; then
    echo "提示: 检测到 Python 3.7，已切换至兼容版依赖。"
fi

# 检查pip
if ! command -v pip3 &> /dev/null; then
    echo "错误: 未找到pip3"
    echo "请安装pip: sudo apt-get install python3-pip"
    exit 1
fi
echo "✓ pip已安装"

# 创建虚拟环境
echo ""
echo "创建Python虚拟环境..."
if [ -d "venv" ]; then
    echo "虚拟环境已存在，跳过创建"
else
    python3 -m venv venv
    if [ $? -eq 0 ]; then
        echo "✓ 虚拟环境创建成功"
    else
        echo "错误: 虚拟环境创建失败"
        exit 1
    fi
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
echo ""
echo "安装Python依赖包..."
pip install --upgrade pip
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✓ 依赖安装成功"
else
    echo "错误: 依赖安装失败"
    exit 1
fi

# 创建目录
echo ""
echo "创建必要目录..."
mkdir -p uploads
mkdir -p instance
echo "✓ 目录创建完成"

# 设置执行权限
chmod +x start.sh
chmod +x stop.sh

echo ""
echo "========================================"
echo "  安装完成！"
echo "========================================"
echo ""
echo "启动命令: ./start.sh"
echo "停止命令: ./stop.sh"
echo ""
echo "访问地址: http://localhost:5000"
echo "默认账号: admin"
echo "默认密码: Flzx3qc@2024"
echo ""
echo "========================================"
