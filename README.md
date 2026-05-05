# Kruby - Markdown 共享平台

一个基于 Next.js 的 Markdown 文档上传和共享平台。

## 功能特性

- 📝 **在线查看和编辑** Markdown 文件（默认为阅读模式）
- 📁 **多级文件夹** 管理文档结构
- ⬆️ **批量上传** .md 文件（支持拖放）
- 👤 **用户登录系统** - 登录后才能查看和操作
- 🌐 **共享文档空间** - 所有用户共享同一文档库
- 📱 **移动端友好** - 响应式设计，侧边栏可折叠

## 快速开始

### 前置要求

- Node.js 18+
- npm

### 安装

```bash
# 克隆仓库
git clone https://github.com/hifar/kruby.git
cd kruby

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，修改 NEXTAUTH_SECRET 为随机字符串

# 初始化数据库
npm run db:push

# 构建
npm run build

# 启动
npm start
```

### 开发模式

```bash
npm run dev
```

### 环境变量

复制 `.env.example` 为 `.env` 并填入配置：

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-random-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

## 默认账号

首次启动时自动创建管理员账号：

- 用户名：`admin`
- 密码：`admin123`

**请在生产环境中修改默认密码！**

## 技术栈

- **框架**: Next.js 14 (App Router)
- **数据库**: SQLite + Prisma ORM
- **认证**: NextAuth.js v4
- **样式**: Tailwind CSS
- **Markdown**: react-markdown + @uiw/react-md-editor
