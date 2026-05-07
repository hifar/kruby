# Kruby 项目总览

## 1. 项目定位
Kruby 是一个基于 Next.js 的 Markdown 文档共享平台，核心目标是让登录用户在统一空间中完成 Markdown 文件的上传、组织、浏览与在线编辑。

项目特点：
- 以 Markdown 文档为中心的轻量知识库
- 支持多级文件夹组织
- 提供“阅读 + 编辑”双模式文件详情页
- 提供批量上传与新建文件/文件夹能力
- 移动端可用（响应式布局，侧边栏可折叠）

## 2. 功能模块

### 2.1 认证与账户
- 登录方式：NextAuth Credentials（用户名/密码）
- 页面：登录页支持“登录/注册”切换
- 会话策略：JWT Session
- 初始化机制：首次可自动创建默认管理员账号
  - 用户名：admin
  - 密码：admin123

相关能力：
- 注册接口：校验用户名长度、密码长度、用户名唯一性
- 登录后跳转到仪表盘，未登录访问受保护页面会被导向登录页

### 2.2 文件夹管理
- 支持创建文件夹（可指定父级）
- 支持多级树形结构展示
- 支持递归删除文件夹（删除子文件夹与其文件）
- 支持根目录与任意子目录切换浏览

实现要点：
- 文件夹数据包含 `parentId` 与 `path`
- 前端将扁平 folder 列表重建为树结构

### 2.3 Markdown 文件管理
- 新建 Markdown 文件（自动补 `.md` 后缀）
- 文件列表按目录展示，支持关键字搜索
- 文件详情页支持：
  - 阅读模式（Markdown 渲染）
  - 编辑模式（在线编辑器）
  - 改名与内容保存
  - 删除文件
- 展示更新时间、作者信息、所属目录信息

### 2.4 批量上传
- 支持拖拽或文件选择上传多个 `.md` 文件
- 服务端逐文件解析并入库
- 返回逐文件成功/失败结果（如非 `.md` 会标记失败）

### 2.5 页面结构
- 根路径：根据登录状态自动重定向
  - 已登录 -> 仪表盘
  - 未登录 -> 登录页
- 仪表盘：
  - 顶部导航（搜索、账户、退出）
  - 左侧目录树
  - 主区文件卡片网格
  - 新建/上传相关弹窗
- 文件详情页：
  - 顶栏返回与操作按钮
  - 主区阅读或编辑

## 3. 后端 API 概览

### 3.1 认证与初始化
- `POST /api/init`：系统初始化，若无用户则创建默认管理员
- `POST /api/register`：注册新用户
- `GET/POST /api/auth/*`：NextAuth 认证流程

### 3.2 文件夹接口
- `GET /api/folders`
  - `?all=true` 获取全部文件夹
  - `?parentId=...` 获取某父目录下文件夹
- `POST /api/folders`：创建文件夹
- `DELETE /api/folders/:id`：递归删除文件夹

### 3.3 文件接口
- `GET /api/files?folderId=...`：获取目录下文件列表
- `POST /api/files`：创建文件
- `GET /api/files/:id`：获取文件详情
- `PUT /api/files/:id`：更新文件名或内容
- `DELETE /api/files/:id`：删除文件

### 3.4 上传接口
- `POST /api/upload`：接收 `multipart/form-data`，批量上传 Markdown 文件

接口共性：
- 各业务接口通过服务端会话校验登录态，未登录返回 401

## 4. 数据模型（Prisma）

### 4.1 User
- `id`：主键
- `username`：唯一用户名
- `password`：哈希密码
- `createdAt`
- 关联：`folders`、`markdownFiles`

### 4.2 Folder
- `id`、`name`
- `parentId`：父文件夹（可空）
- `userId`：创建者
- `path`：完整目录路径字符串
- `createdAt`
- 关联：父子文件夹自关联、`markdownFiles`

### 4.3 MarkdownFile
- `id`、`name`、`content`
- `folderId`：所属目录（可空）
- `userId`：创建者
- `createdAt`、`updatedAt`

## 5. 技术架构与关键实现

### 5.1 前端
- 框架：Next.js 15（App Router）
- 语言：TypeScript（strict）
- UI：React 18 + Tailwind CSS
- 会话：`next-auth/react` 客户端 SessionProvider
- Markdown 编辑：`@uiw/react-md-editor`（动态导入，禁 SSR）
- Markdown 渲染：`react-markdown` + `remark-gfm` + `rehype-raw`

### 5.2 后端
- Next.js Route Handlers 提供 REST API
- 认证：NextAuth v4 + Credentials Provider
- 密码：`bcryptjs` 哈希与校验

### 5.3 数据层
- ORM：Prisma 5
- 数据库：SQLite（默认本地 `dev.db`）
- PrismaClient 采用全局单例模式，避免开发时热更新导致多实例

### 5.4 工程与构建
- `npm run dev`：开发模式
- `npm run build`：`prisma generate + prisma db push + next build`
- `npm start`：生产启动
- `npm run db:push`：推送 schema
- `npm run db:generate`：生成 Prisma Client

## 6. 配置与环境变量
必需环境变量：
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

默认示例：
- `DATABASE_URL="file:./dev.db"`
- `NEXTAUTH_URL="http://localhost:3000"`

## 7. 目录职责速览
- `src/app`：页面与 App Router API
- `src/components`：UI 组件与弹窗
- `src/lib`：认证配置、Prisma 实例
- `src/pages/api/auth`：NextAuth 兼容路由
- `prisma`：数据模型与种子脚本

## 8. 当前项目实现特征（可作为后续演进参考）
- 已具备完整的 Markdown 文档基础协作流（登录 -> 管理目录 -> 上传/创建 -> 编辑/阅读）
- 数据模型包含 `userId`，但当前业务查询多以目录/文件主键为主，呈现为共享文档空间行为
- 上传流程已实现批量处理与逐项结果返回，便于后续扩展为更完整的导入任务机制
