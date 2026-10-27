# Knowledge Quest 部署手册

## 当前服务器配置：newstu.online

`deploy/nginx.conf.example` 已按你的现有服务器调整：域名 `newstu.online`，网页目录 `/var/www/knowledge-quest`，证书 `/etc/nginx/newstu.online_bundle.crt`，私钥 `/etc/nginx/newstu.online.key`。监听 443 提供 HTTPS，80 自动跳转 HTTPS，不再使用原来的 8183 端口。

以下步骤适用于你已经部署好的目录，优先于下文通用部署示例：

1. 确保域名解析到服务器，安全组和防火墙放行 TCP 80、443，且 `/var/www/knowledge-quest/index.html` 存在。
2. 备份服务器现有配置：`sudo cp /etc/nginx/conf.d/knowledge-quest.conf /etc/nginx/conf.d/knowledge-quest.conf.bak`。
3. 将本仓库 `deploy/nginx.conf.example` 的完整内容替换到服务器 `/etc/nginx/conf.d/knowledge-quest.conf`，避免同时保留相同域名的重复站点配置。
4. 执行 `sudo nginx -t`，仅在成功后执行 `sudo systemctl reload nginx`（无 systemd 时执行 `sudo nginx -s reload`）。
5. 执行 `curl -I http://newstu.online/`，应跳转 HTTPS；执行 `curl -I https://newstu.online/`，应返回 200。再用 Chrome/Edge 打开 `https://newstu.online` 验证目录选择与模型对话。

证书应覆盖 `newstu.online` 并包含完整证书链；私钥应与证书匹配。保持私钥仅管理员可读，不要将其放入网页根目录。证书到期前需更新证书并检查、重载 Nginx；本配置不会自动续期。

原 `IP:8183`、HTTP 域名和 HTTPS 域名的浏览器存储相互独立，旧缓存不会自动迁移；保留已有项目目录并重新授权打开即可恢复目录中的项目。

下面为通用发布说明，其中 `current` 软链接布局适用于新部署；你现有服务器使用上述目录，不必迁移。旧发布压缩包内仍是通用配置，本次请单独使用仓库中更新后的配置文件。

## 发布说明

已完成 TypeScript 检查、Vite 生产构建，现有 7 个测试文件、19 项测试全部通过。完整部署包为 `knowledge-quest-release-20261027.tar.gz`，包含 `dist/`、本手册和 `deploy/nginx.conf.example`，另附 SHA-256 校验文件。

这是纯前端静态应用，由已有 Nginx 直接托管即可，服务器无需安装 Node.js、数据库或 PM2。本手册假设服务器为 Linux，部署到独立域名的根路径，例如 `https://learn.example.com/`。请替换全部示例域名。当前包不能直接部署到 `/learning/` 等子路径；子路径部署需要修改 Vite `base` 并重新构建。

## 1. 准备域名与 HTTPS

将域名 A 记录指向服务器公网 IP；如果设置了 AAAA，也要确保 IPv6 可达。放行服务器安全组与防火墙 TCP 80、443。

准备匹配域名的 HTTPS 证书和私钥，可使用已有证书或通过云厂商、ACME 工具申请。若使用 HTTP-01 验证，应先按照证书工具说明完成 80 端口验证，再启用 HTTPS 配置，避免引用尚不存在的证书。

HTTPS 是浏览器目录功能的必要条件，普通公网 HTTP 无法正常使用目录选择。推荐使用 Chrome 或 Edge。

## 2. 上传与解压

在本地项目目录的 PowerShell 中执行，替换 SSH 用户及服务器地址：

```powershell
scp .\knowledge-quest-release-20261027.tar.gz .\knowledge-quest-release-20261027.tar.gz.sha256 deployuser@SERVER_IP:/tmp/
```

登录服务器后执行：

```bash
cd /tmp
sha256sum -c knowledge-quest-release-20261027.tar.gz.sha256
sudo mkdir -p /var/www/knowledge-quest/releases/20261027
sudo tar -xzf knowledge-quest-release-20261027.tar.gz -C /var/www/knowledge-quest/releases/20261027
sudo chmod -R u=rwX,go=rX /var/www/knowledge-quest/releases/20261027
sudo ln -s /var/www/knowledge-quest/releases/20261027/dist /var/www/knowledge-quest/
```

首次部署时 `current` 应不存在；已有部署请参照更新章节。站点根目录须指向包含 `index.html` 的 `dist`，不要指向外层发布目录。

## 3. 配置已有 Nginx

为本项目新增独立站点，不要覆盖其他站点。常见配置方式：

```bash
sudo cp /var/www/knowledge-quest/releases/20261027/deploy/nginx.conf.example /etc/nginx/conf.d/knowledge-quest.conf
sudo vi /etc/nginx/conf.d/knowledge-quest.conf
```

修改配置中所有 `learn.example.com`，并将 `ssl_certificate` 与 `ssl_certificate_key` 改为实际证书和私钥路径。`root` 应与部署路径一致。示例内容见发布包的 `deploy/nginx.conf.example`。

若使用宝塔或 `sites-available/sites-enabled`，通过已有站点管理方式添加相同配置，避免重复 `server_name`。可运行 `sudo nginx -T` 检查实际包含的配置目录。

```bash
sudo nginx -t
sudo systemctl reload nginx
```

只在配置检查成功后重载；没有 systemd 时使用 `sudo nginx -s reload`。示例包括 HTTP 跳转 HTTPS、页面刷新回退、首页重新验证与哈希静态资源长期缓存。

若启用 SELinux 后返回 403，应按系统策略将站点目录标记为 `httpd_sys_content_t`，同时检查父目录可遍历权限和文件可读权限。不要通过关闭 SELinux 解决问题。

## 4. 验收与使用限制

```bash
curl -I http://learn.example.com/
curl -I https://learn.example.com/
```

HTTP 应重定向到 HTTPS，HTTPS 应返回 200，证书有效。用浏览器打开域名，检查页面、样式和刷新是否正常、控制台是否有资源 404。创建测试项目，在“模型与设置”中配置接口地址、模型与 API Key，并验证连接和对话。

- 项目与设置保存在访问者浏览器本地存储中；授权目录后还会写入访问者电脑的项目目录。服务器只提供网页，不保存学习项目，没有跨设备同步。
- 在“模型与设置”中选择系统数据目录并授权读写。目录选择依赖 HTTPS、Chrome/Edge 的 File System Access API；重启后可能需要重新授权。不支持目录 API 的浏览器可使用本地缓存模式。
- API Key 保存在当前标签页会话存储中，不进入项目目录或发布包，结束会话后可能需要重新填写。
- 模型请求直接从访问者浏览器发送到所配置接口。接口须为 HTTPS，并允许本站来源的 CORS 预检、Authorization/Content-Type 请求头及对应 GET/POST 请求。服务器能访问该接口，不代表访问者浏览器也能访问。
- 当前没有账号登录和站点访问控制。个人使用可通过已有网关或 Nginx Basic Auth 限制访问。不要把共享 API 密钥写入前端；需要共享密钥时，另行实现带鉴权的后端代理。
- 域名、协议或端口改变会改变浏览器存储来源；迁移前备份本地项目目录，迁移后通过打开已有项目目录恢复。

## 5. 更新与回滚

为每次更新创建新目录，例如 `releases/20261101`，将新包解压进去并设置可读权限。检查新版本的 `dist/index.html` 后切换软链接：

```bash
sudo ln -s /var/www/knowledge-quest/releases/20261101/dist /var/www/knowledge-quest/current.next
sudo mv -Tf /var/www/knowledge-quest/current.next /var/www/knowledge-quest/current
```

执行前 `current.next` 应不存在，`current` 应是前面创建的软链接。切换静态文件无需重启 Nginx。更新后强制刷新并验证模型对话。长期打开的旧页面可能继续请求旧资源，可在新版本中保留旧哈希资源或通知用户刷新。

回滚时使用相同两条命令，将目标改为旧版本的 `dist`。网站回滚不会恢复浏览器或本地目录中的数据，使用者需单独备份数据。

## 6. 排错

| 现象 | 检查方法 |
| --- | --- |
| 白屏、JS/CSS 404 | 核对 `root` 指向 `dist`，使用域名根路径部署；强制刷新，检查浏览器 Network 和 Nginx 错误日志。 |
| 403 | 检查文件可读权限、父目录可遍历权限、SELinux 标签。 |
| HTTPS 或重载失败 | 检查域名、证书有效期、证书链、私钥路径及 `nginx -t` 输出。 |
| 无法选择目录 | 使用 HTTPS 的 Chrome/Edge，检查目录授权；选择的是访问者电脑上的目录。 |
| 模型请求失败 | 401/403 检查密钥；404 检查接口路径和模型；CORS 检查接口服务跨域设置；Mixed Content 检查接口是否为 HTTPS。 |
| 换设备没有项目 | 当前没有服务器同步，需使用原浏览器或通过已有项目目录恢复。 |

## 7. 后续自行编译

开发电脑或 CI 安装 Node.js 24 LTS 与 `pnpm@11.19.0`，在源码根目录运行：

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

产物为 `dist/`。依赖版本以 `pnpm-lock.yaml` 为准，服务器无需安装依赖。本次使用 Node.js v24.20.0、项目现有依赖，通过 npm 脚本完成构建和测试。
