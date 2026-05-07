# Kruby 近期变更记录

本文档记录最近一轮围绕 Docker 部署、认证权限、用户维护与登录流程所做的详细调整。

## 1. Docker 与部署相关

### 1.1 新增 Docker 配置文件
- 新增 `Dockerfile`
- 新增 `docker-compose.yml`
- 新增 `.dockerignore`

### 1.2 Dockerfile 调整内容
- 使用多阶段构建：`deps` / `builder` / `runner`
- 构建阶段执行：
  - `npm ci`
  - `npx prisma generate`
  - `npx next build`
- 运行阶段启动命令：
  - `mkdir -p /app/data && npx prisma db push && npm run start`
- 默认运行端口改为 `3012`
- 添加 `HOSTNAME=0.0.0.0`，便于容器内对外监听
- 在 `builder` 和 `runner` 阶段安装 `openssl` 与 `ca-certificates`
  - 解决 Prisma `libssl/openssl version` 探测警告

### 1.3 docker-compose.yml 调整内容
- 服务名：`kruby`
- 容器名：`kruby`
- 端口映射改为：`0.0.0.0:3012:3012`
- 数据库文件使用：`file:/app/data/dev.db`
- `NEXTAUTH_SECRET` 改为环境变量注入：`${NEXTAUTH_SECRET}`
- `NEXTAUTH_URL` 改为环境变量注入：`${NEXTAUTH_URL}`
- 增加 `HOSTNAME=0.0.0.0`
- 使用命名卷 `kruby_data` 持久化 SQLite 数据

### 1.4 Docker 文档
- 新增详细部署说明文档：`doc/docker.md`
- 文档覆盖：
  - 快速启动
  - 远程访问
  - 环境变量注入
  - 数据卷与持久化
  - 常见运维命令
  - 常见问题排查

## 2. Prisma 与数据模型调整

### 2.1 用户角色字段
- 原计划使用 Prisma enum `UserRole`
- 因 SQLite 不支持 Prisma enum，改为：
  - `User.role String @default("USER")`

### 2.2 User 模型变化
当前 `User` 新增字段：
- `role`：字符串，取值约定为 `USER` / `ADMIN`

### 2.3 初始化与种子数据
- `src/app/api/init/route.ts`
  - 首次初始化时创建默认管理员 `admin`
  - 角色明确设置为 `ADMIN`
  - 若历史数据库中 `admin` 角色仍为 `USER`，会自动提升为 `ADMIN`
- `prisma/seed.ts`
  - 默认管理员角色改为 `ADMIN`

## 3. 认证与会话

### 3.1 NextAuth 扩展
- 在登录授权阶段返回 `role`
- JWT 中新增 `token.role`
- Session 中新增 `session.user.role`

### 3.2 老会话兼容处理
- 在 `src/lib/auth.ts` 中增加 role 回填逻辑
- 如果旧 token 中没有 `role`，会根据 `token.id` 回库查询并补齐
- 解决管理员登录后看不到“用户管理”入口的问题

### 3.3 类型定义
- 扩展 `src/types/next-auth.d.ts`
- 支持：
  - `Session.user.role`
  - `User.role`
  - `JWT.role`

## 4. 用户账户功能

### 4.1 新增用户自助改密
新增接口：
- `POST /api/account/password`

新增页面：
- `src/app/account/page.tsx`

功能说明：
- 登录用户可输入当前密码、新密码、确认新密码
- 新密码长度至少 6 位
- 会校验当前密码是否正确
- 修改成功后给出提示

### 4.2 仪表盘入口调整
在 `src/app/dashboard/page.tsx` 中新增顶部入口：
- 修改密码
- 用户管理（仅 ADMIN 可见）

## 5. 管理员用户维护功能

### 5.1 新增用户列表接口
新增接口：
- `GET /api/admin/users`

能力：
- 仅 ADMIN 可访问
- 返回用户基础信息：
  - `id`
  - `username`
  - `role`
  - `createdAt`
  - 文件夹数量
  - Markdown 文件数量

### 5.2 新增管理员创建用户接口
在 `src/app/api/admin/users/route.ts` 中新增：
- `POST /api/admin/users`

能力：
- 仅 ADMIN 可创建用户
- 校验用户名不能为空、长度至少 3 位
- 校验密码不能为空、长度至少 6 位
- 校验用户名唯一性
- 可指定角色：`USER` / `ADMIN`

### 5.3 新增管理员修改用户接口
新增接口：
- `PUT /api/admin/users/:id`

能力：
- 修改用户角色
- 重置用户密码

限制：
- 不能把当前登录管理员自己降级为 `USER`
- 新密码至少 6 位

### 5.4 新增管理员删除用户接口
新增接口：
- `DELETE /api/admin/users/:id`

限制：
- 不能删除当前登录用户
- 若用户仍有关联文件或文件夹，则拒绝删除

### 5.5 新增管理员用户管理页面
新增页面：
- `src/app/admin/users/page.tsx`

页面能力：
- 查看用户列表
- 修改用户角色
- 重置用户密码
- 删除用户
- 新增用户（用户名、密码、角色）

## 6. 登录流程变更

### 6.1 隐藏注册功能
调整文件：
- `src/app/login/page.tsx`

变更内容：
- 去掉“登录/注册”切换 UI
- 去掉登录页内部注册分支逻辑
- 登录页现在仅保留账号登录

说明：
- 后端 `POST /api/register` 接口仍保留
- 当前前台页面不再暴露公开注册入口
- 后续用户创建主要通过管理员后台完成

## 7. 已解决的问题

### 7.1 Prisma enum 与 SQLite 不兼容
问题：
- `npx prisma generate` 报错：SQLite 不支持 enum

处理：
- 移除 Prisma enum
- 改为字符串角色字段

### 7.2 Docker 中 Prisma OpenSSL 警告
问题：
- `Prisma failed to detect the libssl/openssl version`

处理：
- 在 Docker 镜像中安装 `openssl` 和 `ca-certificates`

### 7.3 管理员入口不显示
问题：
- admin 登录后未看到“用户管理”入口

处理：
- 在 JWT callback 中补充 role 回填逻辑
- 兼容旧 token / 旧 session
- 支持历史库中 `admin` 从 `USER` 自动提升到 `ADMIN`

## 8. 当前结果

当前项目已经具备以下新增能力：
- Docker 一键部署运行
- 远程访问支持
- 环境变量化的 NextAuth 配置
- 用户自助修改密码
- 管理员新增/修改/删除/重置用户
- 登录页关闭公开注册入口
- SQLite 环境下可正常运行角色控制逻辑
- Markdown 文件支持批量选中、批量移动、批量删除
- 文件夹支持跨层级移动，并会自动维护子目录路径
- 从文件查看/编辑页返回仪表盘时，可正确恢复原文件夹及其文件列表

## 9. 文件批量操作与文件夹移动

### 9.1 仪表盘批量文件操作
调整文件：
- `src/app/dashboard/page.tsx`
- `src/app/api/files/route.ts`

新增能力：
- 支持在文件列表中勾选多个 Markdown 文件
- 支持“全选当前列表”
- 支持批量删除文件
- 支持批量移动文件到其他文件夹或根目录

前端实现：
- 仪表盘增加 `selectedFileIds` 状态
- 文件卡片增加勾选框
- 列表上方增加批量操作工具条
  - 显示已选文件数量
  - 提供目标文件夹下拉选择
  - 提供“批量移动”按钮
  - 提供“批量删除”按钮

后端实现：
- 在 `src/app/api/files/route.ts` 中新增：
  - `PUT /api/files`：接收 `ids` 与 `targetFolderId`，执行批量移动
  - `DELETE /api/files`：接收 `ids`，执行批量删除

### 9.2 文件夹移动
调整文件：
- `src/app/dashboard/page.tsx`
- `src/app/api/folders/[id]/route.ts`

新增能力：
- 当前选中文件夹时，仪表盘展示“移动当前文件夹”控件
- 可将当前文件夹移动到根目录或其他文件夹下

后端实现：
- 新增 `PUT /api/folders/:id`
- 支持更新 `parentId`
- 根据目标目录重新计算当前文件夹 `path`
- 递归更新所有子文件夹 `path`

安全限制：
- 不能把文件夹移动到自身下面
- 不能把文件夹移动到自己的子文件夹下面

### 9.3 文件详情返回仪表盘时保留上下文
调整文件：
- `src/app/dashboard/page.tsx`
- `src/app/files/[id]/page.tsx`

新增能力：
- 从仪表盘进入文件详情页时，会携带当前 `folderId`
- 从文件查看或编辑页返回时，会回到原先选中的文件夹
- 删除文件后返回仪表盘，也会回到原目录

## 10. 新修复的问题

### 10.1 返回仪表盘时文件夹内容显示错误
问题：
- 从 Markdown 文件查看页返回仪表盘时，文件夹高亮恢复正确
- 但文件列表有时显示根目录或错误目录内容

根因：
- 仪表盘初始化阶段存在竞态
- 首次加载时会并行触发默认目录文件请求与目标 `folderId` 文件请求
- 较晚返回的根目录结果会覆盖正确目录结果

处理：
- 在 `src/app/dashboard/page.tsx` 中用 URL 上的 `folderId` 初始化 `currentFolderId`
- 首次进入仪表盘时只加载文件夹树
- 文件列表统一由依赖 `currentFolderId` 的 effect 负责加载

结果：
- 返回仪表盘时，文件夹焦点与文件列表都能正确恢复