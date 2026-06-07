# Game Assistant Auto

基于 Electron + React + Python (OpenCV) 的游戏自动化辅助工具。

## 环境要求

- Node.js >= 18
- pnpm
- Conda（用于 Python 图像匹配服务）

## 快速开始

### 1. 安装 Node 依赖

```bash
pnpm install
```

### 2. 启动 Python 匹配服务

图像匹配服务以独立 Flask 服务运行，需通过 Conda 管理 Python 环境：

```bash
# 创建专用 Conda 环境（仅需执行一次）
conda create -n game-assistant python=3.11 -y

# 激活环境
conda activate game-assistant

# 安装 Python 依赖
pip install -r python-service/requirements.txt

# 启动服务（默认端口 5000）
python python-service/main.py

# 或指定端口
python python-service/main.py 5001
```

如果 `conda activate` 提示需要初始化，先执行 `conda init bash` 然后重新打开终端。

Electron 主进程默认连接 `http://127.0.0.1:5000`。如需更改端口，请同步修改 `data/config.json` 中的 `pythonPort` 配置。

### 3. 启动 Electron 应用

```bash
pnpm dev
```
