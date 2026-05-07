# Kruby 项目总览

## 1. 项目定位
Kruby 是一个基于 Next.js 的 Markdown 文档共享平台，核心目标是让登录用户在统一空间中完成 Markdown 文件的上传、组织、浏览与在线编辑。

项目特点：
- 以 Markdown 文档为中心的轻量知识库
- 支持多级文件夹组织
- 提供“阅读 + 编辑”双模式文件详情页
- 提供批量上传与新建文件/文件夹能力
- 提供用户自助改密与管理员用户维护能力
- 移动端可用（响应式布局，侧边栏可折叠）
- 已提供 Docker 部署方案，支持远程访问与 SQLite 数据持久化

## 2. 功能模块

### 2.1 认证与账户
- 登录方式：NextAuth Credentials（用户名/密码）
- 页面：登录页当前仅保留登录入口，注册入口已隐藏
- 会话策略：JWT Session
- 会话中携带 `user.id` 与 `user.role`
- 初始化机制：首次可自动创建默认管理员账号
  - 用户名：admin
  - 密码：admin123
  - 角色：ADMIN

相关能力：
- 登录后用户可进入“修改密码”页面更新自己的密码
- 管理员可进入“用户管理”页面维护平台用户
- 注册接口仍存在，但当前前台登录页已不提供公开注册入口
- 登录后跳转到仪表盘，未登录访问受保护页面会被导向登录页

### 2.2 用户与权限管理
- `User.role` 使用字符串字段表示权限，当前支持 `USER` / `ADMIN`
- admin 管理员可查看所有用户列表
- admin 可新增用户并指定角色
- admin 可修改其他用户角色
- admin 可重置其他用户密码
- admin 可删除无文件、无文件夹关联的用户
- 安全约束：
  - 管理员不能删除当前登录账号
  - 管理员不能把自己降级为 `USER`
  - 若用户仍有关联文件或文件夹，则拒绝删除

### 2.3 文件夹管理
- 支持创建文件夹（可指定父级）
- 支持多级树形结构展示
- 支持递归删除文件夹（删除子文件夹与其文件）
- 支持移动文件夹到根目录或其他文件夹
- 支持根目录与任意子目录切换浏览

实现要点：
- 文件夹数据包含 `parentId` 与 `path`
- 前端将扁平 folder 列表重建为树结构
- 文件夹移动时会递归更新当前文件夹及其所有子文件夹路径
- 禁止将文件夹移动到自身或其子文件夹下，避免形成循环层级

### 2.4 Markdown 文件管理
- 新建 Markdown 文件（自动补 `.md` 后缀）
- 文件列表按目录展示，支持关键字搜索
- 支持多选 Markdown 文件
- 支持批量删除 Markdown 文件
- 支持批量移动 Markdown 文件到其他文件夹或根目录
- 文件详情页支持：
  - 阅读模式（Markdown 渲染）
  - 编辑模式（在线编辑器）
  - 改名与内容保存
  - 删除文件
- 展示更新时间、作者信息、所属目录信息
- 从文件详情页返回仪表盘时，会保留原来的文件夹选中状态并正确恢复该目录下的文件列表

### 2.5 批量上传
- 支持拖拽或文件选择上传多个 `.md` 文件
- 服务端逐文件解析并入库
- 返回逐文件成功/失败结果（如非 `.md` 会标记失败）

### 2.6 页面结构
- 根路径：根据登录状态自动重定向
  - 已登录 -> 仪表盘
  - 未登录 -> 登录页
- 登录页：仅提供登录表单，不提供公开注册切换
- 仪表盘：
  - 顶部导航（搜索、账户、退出）
  - 顶部账户相关入口（修改密码、管理员用户管理）
  - 左侧目录树
  - 主区文件卡片网格与批量操作工具条
  - 当前文件夹移动控件
  - 新建/上传相关弹窗
- 文件详情页：
  - 顶栏返回与操作按钮
  - 主区阅读或编辑
- 账户页：用户修改当前账号密码
- 用户管理页：管理员新增/修改/删除用户

## 3. 后端 API 概览

### 3.1 认证与初始化
- `POST /api/init`：系统初始化，若无用户则创建默认管理员
- `POST /api/init`：兼容旧数据，将用户名为 `admin` 且角色为 `USER` 的用户提升为 `ADMIN`
- `POST /api/register`：注册新用户
- `GET/POST /api/auth/*`：NextAuth 认证流程

### 3.2 账户与用户管理接口
- `POST /api/account/password`：当前登录用户修改自己的密码
- `GET /api/admin/users`：管理员查看用户列表与统计信息
- `POST /api/admin/users`：管理员创建新用户
- `PUT /api/admin/users/:id`：管理员修改目标用户角色或重置密码
- `DELETE /api/admin/users/:id`：管理员删除用户（有数据关联时拒绝删除）

### 3.3 文件夹接口
- `GET /api/folders`
  - `?all=true` 获取全部文件夹
  - `?parentId=...` 获取某父目录下文件夹
- `POST /api/folders`：创建文件夹
- `PUT /api/folders/:id`：移动文件夹并更新层级路径
- `DELETE /api/folders/:id`：递归删除文件夹

### 3.4 文件接口
- `GET /api/files?folderId=...`：获取目录下文件列表
- `POST /api/files`：创建文件
- `PUT /api/files`：批量移动文件到指定目录或根目录
- `DELETE /api/files`：批量删除文件
- `GET /api/files/:id`：获取文件详情
- `PUT /api/files/:id`：更新文件名或内容
- `DELETE /api/files/:id`：删除文件

### 3.5 上传接口
- `POST /api/upload`：接收 `multipart/form-data`，批量上传 Markdown 文件

接口共性：
- 各业务接口通过服务端会话校验登录态，未登录返回 401

## 4. 数据模型（Prisma）

### 4.1 User
- `id`：主键
- `username`：唯一用户名
- `password`：哈希密码
- `role`：字符串角色字段，默认 `USER`
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
- 角色控制：基于 Session/JWT 中的 `role` 做管理员权限校验

### 5.3 数据层
- ORM：Prisma 5
- 数据库：SQLite（默认本地 `dev.db`）
- 为兼容 SQLite，用户角色使用字符串字段而非 Prisma enum
- PrismaClient 采用全局单例模式，避免开发时热更新导致多实例

### 5.4 部署与容器化
- 已提供 `Dockerfile`、`docker-compose.yml`、`.dockerignore`
- 容器默认端口为 `3012`
- Compose 通过 `0.0.0.0:3012:3012` 对外暴露服务，支持远程访问
- 容器启动时自动执行 `npx prisma db push`
- 镜像构建阶段执行 `npx prisma generate`
- 使用命名卷持久化 SQLite 数据：`kruby_data -> /app/data`
- `NEXTAUTH_SECRET`、`NEXTAUTH_URL` 通过环境变量注入
- Node slim 镜像中已安装 `openssl` 与 `ca-certificates`，避免 Prisma libssl 探测警告

### 5.5 工程与构建
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
- `NEXTAUTH_URL="http://localhost:3012"`（Docker 场景应使用真实外部地址或域名）

## 7. 目录职责速览
- `src/app`：页面与 App Router API
- `src/components`：UI 组件与弹窗
- `src/lib`：认证配置、Prisma 实例
- `src/pages/api/auth`：NextAuth 兼容路由
- `prisma`：数据模型与种子脚本
- `doc`：部署与 Docker 使用说明
- `agent_doc`：项目概览与内部变更记录

## 8. 当前项目实现特征（可作为后续演进参考）
- 已具备完整的 Markdown 文档基础协作流（登录 -> 管理目录 -> 上传/创建 -> 编辑/阅读）
- 已具备基础后台账户体系：自助改密 + 管理员用户管理
- 已支持文件级批量操作与文件夹移动，满足基础文档整理场景
- 数据模型包含 `userId`，但当前业务查询多以目录/文件主键为主，整体仍呈现共享文档空间行为
- 上传流程已实现批量处理与逐项结果返回，便于后续扩展为更完整的导入任务机制
- Docker 方案已可直接部署运行，并适配 SQLite + Prisma + NextAuth 组合
- 已修复从文件查看页返回仪表盘时“文件夹高亮正确但文件列表错误”的状态恢复问题
