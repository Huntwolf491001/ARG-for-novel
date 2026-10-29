# ARG 账号验证服务

这是一个独立的 Cloudflare Worker：管理员登记站点和玩家账号；网站向验证服务提交账号密码；验证成功后，目标站点的 Worker 检查签名票据并建立会话，再允许访问受保护目录。管理后台展示最近 100 条验证记录，并生成可复制的登录表单和目标站点配置。

目标站点必须接入本项目的 `adapter`，并通过该 Worker 提供受保护文件。只有表单和跳转无法限制直接访问文件。当前项目中的市局官网还没有接入本服务，也没有迁移其原有账号或档案。

本包中的 `adapter` 面向 Workers 静态资源部署。Cloudflare Pages 目标站点需要另行适配 Pages Functions 或 `_worker.js`，本包尚未提供可直接部署到 Pages 的适配器。

## 存储和约束

- 管理员账号、密码：使用同一随机盐和 PBKDF2-SHA-256（各 100,000 次）计算摘要，摘要和盐保存在 Cloudflare Secrets。部署时设置管理员账号为 `admin`、密码为用户指定的密码；本项目不包含该密码。
- 玩家账号：使用 Secret 密钥计算 HMAC 作为查询索引，数据库不存明文账号。玩家密码使用独立随机盐和 PBKDF2-SHA-256（100,000 次）摘要，不存明文密码。验证记录中的账号和站点签名密钥使用 AES-GCM 加密后保存在 D1；经管理员登录才解密显示。
- 摘要不是可逆加密：系统无法显示或找回密码，只能重新设置。Secret 中的加密密钥应妥善备份；丢失或更换 `ACCOUNT_KEY` 会导致现有账号索引、记录及站点密钥无法使用，需迁移或重新登记。`ADMIN_SESSION_KEY` 变更会使管理员会话失效。
- 验证通过后签发有效期 60 秒的票据；目标站点会话有效期 8 小时。修改密码不会立即撤销已签发的站点会话。管理员会话有效期 1 小时。验证记录保存账号、站点、时间和结果，不保存密码；当前后台显示最近 100 条，数据库记录不会自动清除。
- Cloudflare Rate Limiting 是按数据中心近似限流，并非全局严格限制。剧情用的短数字密码仍可能被猜到，请不要用真实敏感信息。服务端日志不应配置为记录请求体。
- 配置了 1000ms CPU 限额，可能需要 Workers 付费计划；PBKDF2 的实际耗时和适用额度须在用户的 Cloudflare 账户中确认。

## 1. 部署验证服务

需要 Cloudflare 账户、Node.js 及 npm；下面的命令在 `arg-auth` 目录执行。以下命令会在你的 Cloudflare 账户创建数据库、上传服务和配置 Secrets。

1. 安装依赖并登录：

   ```powershell
   npm install
   npx wrangler login
   npx wrangler d1 create arg-auth
   ```

2. 将创建数据库输出的 `database_id` 填入 `wrangler.jsonc`（替换全零占位值）。应用数据库迁移并首次部署：

   ```powershell
   npx wrangler d1 migrations apply arg-auth --remote
   npx wrangler deploy
   ```

   尚未配置管理员 Secrets 时，服务返回 503。这是正常的。

3. 运行以下命令，按提示输入管理员账号 `admin` 和用户指定的管理员密码。输入不会回显。程序输出的三个值是盐和摘要，不是原密码：

   ```powershell
   node scripts/admin-hash.js
   ```

4. 在 Cloudflare 仪表盘中找到验证 Worker → Settings → Variables and Secrets，分别新增类型为 **Secret** 的 `ADMIN_PASSWORD_SALT`、`ADMIN_USERNAME_HASH`、`ADMIN_PASSWORD_HASH`，对应粘贴上一步的三个值。再生成两个彼此不同的随机密钥，并设置为 `ACCOUNT_KEY` 和 `ADMIN_SESSION_KEY`：

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   上述命令运行两次，分别复制结果到两个 Secret。不要将这些值提交到仓库或放进网页源码。也可用 `npx wrangler secret put SECRET名称` 交互设置。

5. 访问部署输出的 HTTPS 地址，使用设定的管理员账号和密码登录。建议在 Cloudflare 为管理地址配置额外访问限制，并避免在共享设备保存登录状态。

## 2. 登记一个站点并部署保护适配器

1. 在管理后台填写：唯一站点 ID；站点名称；目标站点 HTTPS origin（例如 `https://my-site.example`，不含路径）；保护目录（例如 `/archive/`）；登录后要到达的目录内页面（例如 `/archive/index.html`）。保护目录仅接受英文、数字、下划线和连字符的目录段，且必须以 `/` 开头及结尾。
2. 在后台给该站点添加玩家账号和密码。再次添加同账号会更新密码。后台生成登录表单和该站点配置；玩家密码不会出现在生成代码中。
3. 把目标网站的文件放入 `adapter/public/`，例如将受保护的页面及其敏感图片、文档等放入 `adapter/public/archive/`。现有示例文件仅用于演示；复制真实网站前请确认替换示例目录。**不要在公开文件里保留旧的明文密码、隐藏文档副本或其他能绕过保护的内容。**
4. 配置 `adapter/wrangler.jsonc`：设置不同于验证 Worker 的 `name`，将后台生成的 `AUTH_ORIGIN`、`SITE_ORIGIN`、`SITE_ID` 和 `PROTECTED_PREFIX` 写进 `vars`。`SITE_ORIGIN` 必须与管理后台登记的 origin 完全一致。
5. 部署适配器，得到目标站点地址：

   ```powershell
   npx wrangler deploy --config adapter/wrangler.jsonc
   npx wrangler secret put SITE_KEY --config adapter/wrangler.jsonc
   ```

   按提示粘贴后台提供的 `SITE_KEY`。如尚不知道最终 workers.dev 地址，可先以占位 origin 部署得到地址，再更新两处配置并重新部署；配置不匹配时适配器会拒绝请求。
6. 将后台生成的登录表单粘贴到目标站点的公开登录页面，重新部署适配器。也可以链接到 `验证服务地址/login.html?site=站点ID`，使用验证服务提供的通用登录页。
7. 在无痕窗口确认：未登录直接请求保护目录下的页面和资源时跳转到登录；错误密码不能进入；正确密码可以进入；其他公开页面正常显示。**删除或限制任何旧的公开部署、副本、直接源站地址、预览地址及缓存**，否则它们可能绕过此 Worker。`run_worker_first` 必须保持 `true`。

每个目标站点需要自己的 Worker、配置和 `SITE_KEY`。站点 origin 登记后不可通过后台修改；若需要更换地址，应重新登记站点并重新配置目标站点。

## 3. 后续由 Codex 接入正在编写的网页

按照仓库根目录 `AGENTS.md` 的约定，先询问用户是否接入并取得用户指定的玩家账号、密码和目标页面。管理员先在后台登记站点并部署适配器。需要从终端登记账号时，在 `arg-auth` 目录运行：

```powershell
node scripts/register-account.js https://认证服务域名 站点ID
```

脚本先通过 `/api/admin/login` 进行管理员验证，再向 `/api/admin/accounts` 发送站点 ID、玩家账号和密码；所有输入都不回显，也不作为命令行参数。脚本完成后退出管理员会话。脚本不保存密码，且不会自动修改网页；Codex 应按用户确认，将后台生成的表单直接写进正在制作的网页，然后部署并测试适配器。若账户凭据输入需要用户本人交互，应由用户在终端输入，不把秘密写进仓库或日志。

管理接口使用 HTTPS JSON 和管理员 HttpOnly 会话 Cookie；管理 POST 必须携带与验证服务一致的 `Origin`。`POST /api/admin/sites` 用于登记站点，`POST /api/admin/accounts` 用于新增或更新账号。玩家的 `POST /api/player/login?site=站点ID` 接受 `{site, username, password}`，只允许验证服务自身或后台登记的目标站点 origin；成功时返回 `{redirect}`，失败时返回 `{error}`。不要在网页中存储任何账号密码或站点密钥。

## 本地测试

```powershell
npm test
npx wrangler d1 migrations apply arg-auth --local
```

本地 `wrangler dev` 需要在 `arg-auth/.dev.vars` 设置上面五个 Secret；该文件已被忽略，绝不能提交。测试应使用与正式环境不同的临时账号、密码、密钥和数据库。正式的端到端验证还需要在两个已部署的 HTTPS Worker 上进行。
