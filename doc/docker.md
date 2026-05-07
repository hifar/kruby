# Kruby Docker 部署与使用说明

## 1. 文档目标
本文档说明如何使用 Docker 部署、启动、维护 Kruby 项目，并解释当前 Docker 配置的设计方式、数据持久化策略和常见运维操作。

当前项目技术基础：
- Web 框架：Next.js 15
- 数据库：SQLite
- ORM：Prisma
- 认证：NextAuth

当前仓库已经提供以下 Docker 相关文件：
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

## 2. 当前 Docker 方案说明

### 2.1 Dockerfile 设计
当前 Dockerfile 使用多阶段构建：

1. `deps` 阶段
   - 安装 Node.js 依赖
   - 基于 `package.json` 和 `package-lock.json` 执行 `npm ci`

2. `builder` 阶段
   - 复制项目源码
   - 执行 `npx prisma generate`
   - 执行 `npx next build`

3. `runner` 阶段
   - 作为最终运行镜像
   - 拷贝生产运行所需内容
   - 容器启动时自动执行：
     - `mkdir -p /app/data`
     - `npx prisma db push`
     - `npm run start`

这样设计的原因：
- 避免在镜像构建阶段依赖 SQLite 数据文件
- 保证容器启动时自动同步 Prisma schema
- 让数据库目录独立挂载，方便持久化

### 2.2 docker-compose.yml 设计
当前 `docker-compose.yml` 提供一个服务：

- 服务名：`kruby`
- 容器名：`kruby`
- 对外端口：`3000:3000`
- SQLite 数据文件位置：`/app/data/dev.db`
- 数据卷：`kruby_data`
- 重启策略：`unless-stopped`

环境变量说明：
- `DATABASE_URL=file:/app/data/dev.db`
- `NEXTAUTH_SECRET=...`
- `NEXTAUTH_URL=http://localhost:3000`
- `NODE_ENV=production`

### 2.3 .dockerignore 作用
`.dockerignore` 用于避免将无关或过大的内容发送进镜像构建上下文，例如：
- `.git`
- `.next`
- `node_modules`
- `.env`
- 日志文件

这样可以减少构建体积并提高构建速度。

## 3. 前置要求
部署前请确保机器已安装以下软件：

- Docker
- Docker Compose 插件，或旧版 `docker-compose`

可使用以下命令检查：

```bash
docker --version
docker compose version
```

如果你的环境使用旧版命令，也可以检查：

```bash
docker-compose --version
```

注意：当前这台工作环境中没有安装 Docker，因此文档中的运行命令基于配置静态检查编写，未在本机完成镜像级实际执行。

## 4. 快速启动

### 4.1 方式一：使用 Docker Compose 启动
在项目根目录执行：

```bash
docker compose up -d --build
```

如果你的环境不支持 `docker compose`，则改用：

```bash
docker-compose up -d --build
```

启动完成后，访问：

```text
http://localhost:3000
```

### 4.2 首次启动会发生什么
首次启动容器时，启动命令会执行：

```bash
mkdir -p /app/data && npx prisma db push && npm run start
```

它会完成以下动作：

1. 创建数据库目录 `/app/data`
2. 按照 `prisma/schema.prisma` 同步数据库结构
3. 启动 Next.js 生产服务

### 4.3 默认账号初始化
项目本身在登录页会调用 `/api/init`。

如果数据库中没有用户，系统会自动创建默认管理员：

- 用户名：`admin`
- 密码：`admin123`

生产环境建议首次登录后立即修改默认密码。

## 5. 目录与数据持久化

### 5.1 SQLite 数据库位置
当前 compose 配置中，数据库文件位于容器内：

```text
/app/data/dev.db
```

对应环境变量为：

```text
DATABASE_URL=file:/app/data/dev.db
```

### 5.2 数据卷说明
Compose 中定义了命名卷：

```yaml
volumes:
  kruby_data:
```

并挂载到：

```yaml
- kruby_data:/app/data
```

这表示：
- 即使删除并重建容器，只要不删除卷，数据库仍会保留
- 文档数据、用户数据、目录结构数据都会保存在该卷中

### 5.3 删除卷的影响
如果你执行删除卷的操作，例如：

```bash
docker compose down -v
```

则会同时删除数据库数据。执行前请确认是否需要保留文档内容。

## 6. 环境变量配置

### 6.1 当前 compose 默认值
当前 `docker-compose.yml` 中已经包含默认环境变量：

```yaml
environment:
  DATABASE_URL: "file:/app/data/dev.db"
  NEXTAUTH_SECRET: "please-change-this-to-a-random-long-secret"
  NEXTAUTH_URL: "http://localhost:3000"
  NODE_ENV: "production"
```

### 6.2 生产环境建议
至少修改以下值：

1. `NEXTAUTH_SECRET`
   - 必须改成随机且足够长的密钥
   - 不建议继续使用默认占位字符串

2. `NEXTAUTH_URL`
   - 如果部署在公网域名，请改成真实域名
   - 例如：`https://docs.example.com`

### 6.3 推荐做法
如果你不想把密钥直接写在 `docker-compose.yml` 中，可以改为从外部环境或 `.env` 文件注入。例如：

```yaml
environment:
  DATABASE_URL: ${DATABASE_URL}
  NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
  NEXTAUTH_URL: ${NEXTAUTH_URL}
  NODE_ENV: production
```

然后在部署环境中提供对应变量。

## 7. 常用运维命令

### 7.1 构建并启动
```bash
docker compose up -d --build
```

### 7.2 查看容器状态
```bash
docker compose ps
```

### 7.3 查看日志
```bash
docker compose logs -f
```

如果只查看应用服务日志：

```bash
docker compose logs -f kruby
```

### 7.4 停止服务
```bash
docker compose down
```

### 7.5 停止服务并删除卷
```bash
docker compose down -v
```

### 7.6 重建服务
当代码有更新时，执行：

```bash
docker compose up -d --build
```

## 8. 单独使用 Docker 启动
如果你不想使用 Compose，也可以手动构建和运行。

### 8.1 构建镜像
```bash
docker build -t kruby:latest .
```

### 8.2 启动容器
```bash
docker run -d \
  --name kruby \
  -p 3000:3000 \
  -e DATABASE_URL=file:/app/data/dev.db \
  -e NEXTAUTH_SECRET=replace-with-a-random-secret \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e NODE_ENV=production \
  -v kruby_data:/app/data \
  kruby:latest
```

Windows PowerShell 可写成一行：

```powershell
docker run -d --name kruby -p 3000:3000 -e DATABASE_URL=file:/app/data/dev.db -e NEXTAUTH_SECRET=replace-with-a-random-secret -e NEXTAUTH_URL=http://localhost:3000 -e NODE_ENV=production -v kruby_data:/app/data kruby:latest
```

## 9. 升级与发布流程建议

### 9.1 更新代码后的标准流程
1. 拉取最新代码
2. 确认 `docker-compose.yml` 中环境变量正确
3. 执行重新构建和启动

```bash
docker compose up -d --build
```

### 9.2 Prisma Schema 变更时的行为
当前镜像启动命令中包含：

```bash
npx prisma db push
```

这意味着：
- 如果 `schema.prisma` 有变化，容器启动时会自动尝试同步数据库结构
- 对 SQLite 场景来说，这样可以减少手工迁移操作

但也要注意：
- `db push` 更适合开发或轻量部署场景
- 如果将来进入更严格的生产流程，建议切换为 Prisma Migration 管理数据库演进

## 10. 常见问题

### 10.1 端口被占用怎么办
如果本机 `3000` 端口已被占用，可以修改 compose：

```yaml
ports:
  - "8080:3000"
```

然后通过 `http://localhost:8080` 访问。

### 10.2 页面打不开但容器在运行
排查顺序：

1. 查看容器日志

```bash
docker compose logs -f kruby
```

2. 检查 `NEXTAUTH_URL` 是否与实际访问地址一致
3. 检查端口映射是否正确
4. 检查 Docker 是否正常工作

### 10.3 登录异常或会话异常
重点检查：
- `NEXTAUTH_SECRET` 是否配置正确
- `NEXTAUTH_URL` 是否与访问地址一致
- 浏览器是否通过对应地址访问应用

### 10.4 数据丢失
常见原因：
- 使用了 `docker compose down -v`
- 没有挂载卷
- 更换部署方式时未迁移旧卷数据

建议：
- 定期备份 SQLite 文件
- 对应卷不要随意删除

## 11. 生产部署建议
当前 Docker 方案适合：
- 个人使用
- 小团队内部文档系统
- 轻量部署场景

如果后续要走正式生产环境，建议进一步补充：

1. 反向代理
   - 使用 Nginx 或 Traefik
   - 接入 HTTPS

2. 外部环境变量管理
   - 不把敏感密钥硬编码在 compose 文件中

3. 数据备份
   - 定期备份 SQLite 数据卷或数据库文件

4. 健康检查与监控
   - 增加容器健康检查
   - 增加日志与资源监控

5. 数据库升级路线
   - 当并发和数据量上升后，考虑迁移到 PostgreSQL

## 12. 文件说明速查

### 12.1 Dockerfile
作用：
- 构建 Next.js 生产镜像
- 在容器启动时自动同步 Prisma schema

### 12.2 docker-compose.yml
作用：
- 定义服务启动方式
- 设置端口、环境变量、数据卷、重启策略

### 12.3 .dockerignore
作用：
- 减少构建上下文
- 提升镜像构建速度
- 避免将无用文件带入镜像

## 13. 推荐部署步骤
如果你只是希望最快落地，建议按下面顺序执行：

1. 安装 Docker
2. 修改 `docker-compose.yml` 中的 `NEXTAUTH_SECRET`
3. 如有需要，修改 `NEXTAUTH_URL`
4. 在项目根目录执行：

```bash
docker compose up -d --build
```

5. 打开浏览器访问：

```text
http://localhost:3000
```

6. 使用默认管理员登录并验证功能

## 14. 结论
当前项目的 Docker 配置已经满足基础部署需求，适合快速上线一个基于 SQLite 的 Markdown 文档平台。

它的优点是：
- 部署简单
- 依赖少
- 数据可持久化
- 构建逻辑清晰

它的边界也很明确：
- 更适合轻量场景
- 随着并发和数据量增长，未来可能需要迁移数据库并增强运维体系