# ResearchOS Clipper

把微信公众号文章保存到自己的 ResearchOS：复制链接、按快捷键，自动获取真实标题。
标题采集不使用大模型，不要求先下载正文，也不需要语雀会员。

[下载发布包](https://github.com/IKK1998/researchos-clipper/releases) ·
[验证记录](VERIFICATION.md) · [隐私说明](PRIVACY.md) · [MIT 许可证](LICENSE)

## 它解决什么问题

服务器直接访问公众号链接时，可能得到验证页而不是文章。
Clipper 改用用户授权的浏览器打开文章，读取与该链接对应的真实标题，
再回填到同一条收藏。它不是微信客户端插件，也不是独立的文献管理服务器。

当前提供两种入口：

| 入口 | 使用场景 | 当前验证范围 |
| --- | --- | --- |
| Mac 快捷键版 0.6.0 | 在微信阅读，复制链接后按 Option+S | 已完成真实收藏、标题回写、关键词检索和 Hammerspoon 重启恢复验证 |
| 浏览器扩展 0.6.1 | 使用已登录的公网 ResearchOS，不依赖本机 SSH 网关 | Chromium 隔离测试通过；真实公网登录、Windows/Edge 实机验收待完成 |

浏览器包请使用 **v0.6.1**。v0.6.0 扩展存在参数序列化问题，已被后续版本修复。
两个入口的快捷键不同；不需要同时安装。尚未上架 Chrome/Edge 扩展商店。

## 自动标题如何工作

1. 收到你明确选择的公众号链接，先保存链接与待处理任务。
2. Mac 版在专用 Chrome 窗口打开文章；扩展读取用户选择的文章页面标题元数据。
3. 核对文章链接与收藏来源，拒绝验证页、占位标题和不匹配的页面。
4. 通过 ResearchOS 的标题采集接口回填标题，再读取服务器记录确认。
5. 成功后关闭 Mac 工具自己打开的窗口；已有标题不主动覆盖。

断网任务保存在本机队列中，连接恢复后继续处理。网站需要自行刷新列表或实现
自动刷新；Clipper 不会修改网站前端。保存链接、取得标题、取得正文、生成摘要
是四个不同状态，不能用其中一个状态代替其他状态。

## Mac 安装：复制链接 + Option+S

准备：

- 官方 [Hammerspoon](https://www.hammerspoon.org/)。
- Google Chrome、Python 3。
- 一个已经授权的 ResearchOS 本机网关，例如 `http://127.0.0.1:3010`。
  SSH 隧道、服务器和认证由你自己的环境提供，本仓库不安装或绕过这些保护。

下载仓库后，进入仓库目录：

```sh
git clone https://github.com/IKK1998/researchos-clipper.git
cd researchos-clipper
python3 install-macos.py --login --dry-run
python3 install-macos.py --login
```

第一条安装命令只显示计划，不修改配置。正式安装会备份旧文件，更新三个 Spoon
文件，并只合并 ResearchClipper 的配置块，不覆盖其他 Hammerspoon 配置。

安装后：

1. 在 Hammerspoon 菜单选择 **Reload Config**。
2. 首次按系统提示授予辅助功能权限，以及 Hammerspoon 控制 Chrome 的自动化权限。
3. 在微信文章菜单选择“复制链接”，按 **Option+S**。
4. 等待“已自动保存标题”提示，再到 ResearchOS 的资料库按标题关键词搜索。

新安装的安装器默认使用 Option+S；已有快捷键、网关地址和 AI 设置会保留。
[config.example.lua](config.example.lua) 是手动配置示例，使用的是
Control+Option+Command+S；采用该示例时不要误以为快捷键是 Option+S。

快捷键冲突时，修改私有 `~/.hammerspoon/init.lua` 中的 `mods`、`key`，
再 Reload Config。不要将自己的凭据或 SSH 配置提交到这个仓库。

## 浏览器扩展：使用公网入口（预览）

推荐从 Releases 下载 `researchos-clipper-browser-v0.6.1.zip` 并解压；
源码用户也可以直接使用仓库的 `extension/` 目录。

1. 在浏览器打开并登录你有权限使用的 ResearchOS 网站。
2. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
3. 开启开发者模式，选择“加载已解压的扩展程序”，选中包含
   `manifest.json` 的扩展目录，不是整个仓库。
4. 点击扩展图标，粘贴公众号链接；粘贴后自动加入队列。
   已经在浏览器中阅读文章时，可以用 **Alt+Shift+S** 收藏当前文章。
5. 使用自己的部署时，在扩展设置中填写 HTTPS 根地址，并批准对应域名的权限。

扩展通过已登录网站页面发起正常的同源请求，不提取或导出登录 Cookie，
不需要你提供 SSH 密钥或 API Token。退出登录后会等待重新登录。
真实部署必须先完成一次“收藏 → 标题回读 → 关键词检索”的验收，
不能把隔离测试通过当成公网一定可用。

## 旧链接、分类与模型整理

**旧的无标题链接可以补标题，但工具不会自动扫描网站的全部历史收藏。**

重新复制同一链接并用 Clipper 提交：服务端去重后使用原来源 ID，
工具检查标题是否为空；有标题则保留，无标题则尝试浏览器采集。
如果网站记录存在但本机队列没有该记录，需要重新提交，不能只等待。

分类是 ResearchOS 服务端的功能，不是 Clipper 的分类模型。在兼容的服务端上，
标题回填会更新基于标题、摘要或已保存文本的自动分类建议。人工确认的标签
应由服务端保留。仅凭标题无法保证精细分类，泛化标题可以留在“拓展阅读”。

- 标题提取：不调用模型，不生成猜测标题。
- 自动标签：由网站的分类规则或已配置处理流程决定，不代表科学核验。
- 正文及 AI 总结：独立流程。只有标题不意味着大模型已经读过整篇文章。
- 新安装默认关闭 AI；用户明确启用后，新提交的链接可以按网站的既有策略处理。
  这可能调用外部付费 API，不会因为重复收藏自动重跑已完成的模型任务。

## 重启与换电脑

- `--login` 开启 Hammerspoon 登录启动。队列会在工具重启后恢复，
  已授权的本机网关也必须具有自己的登录启动配置。
- 扩展队列保存在该浏览器本地，浏览器启动后恢复。
- 电脑关机时不能使用本机浏览器取标题；登录、联网且相关程序启动后继续。
- 换电脑后重新安装工具并连接同一 ResearchOS，已入库的文章仍保留在服务器。
  **尚未提交的本机队列不会自动跨设备同步。**
- Mac 本机网关不能直接复制给另一台电脑使用；没有网关的新电脑应测试浏览器
  扩展，或由自己配置安全网关。
- 本仓库不负责服务器开机启动、Cloudflare Tunnel 或服务器迁移。

## 常见问题

**提示保存成功，为什么还没有标题？**

成功提示可能只是链接已入库。等待标题回读确认；微信验证、Chrome 权限、
网站连接失败都可能让标题任务暂缓。

**遇到微信验证怎么办？**

Mac 菜单选择“查看待验证文章”，由你完成验证；必要时选择“继续获取标题”。
工具不绕过验证码、付费墙或访问控制，也不保证每个链接都可读取。

**标题已保存，网站仍显示链接？**

刷新资料库，并检查是否选中了“链接”展示方式。网站缓存和自动刷新需要由
网站自身处理。关键词检索失败时，先核对该来源的服务器标题，不要把模型摘要
是否完成当作标题同步成功的证据。

**能否保存原文排版、图片或完整正文？**

自动标题流程不能。Mac 的可选正文补充需要你明确复制有权处理的文本并确认；
不自动抓取图片、不保证原页面排版。

**普通书签服务能直接接入吗？**

不能直接接入。需要实现下述接口与认证；本仓库不包含完整 ResearchOS 服务端。

## 服务端接口约定

Mac 客户端仅接受带端口的字面 `127.0.0.1` HTTP 地址。它必须连接到已授权、
受保护的网关，不得暴露到局域网或公网。浏览器扩展使用获准的 HTTPS 网站。

收藏请求：

```http
POST /api/v1/intake
Content-Type: application/json
```

```json
{"value":"https://mp.weixin.qq.com/s/EXAMPLE","source_kind":"wechat","ai_consent":false}
```

成功响应必须包含保存凭据和来源 ID：

```json
{"saved":true,"duplicate":false,"source_id":"12345678-1234-1234-1234-123456789abc"}
```

标题流程还需要：

- `GET /api/v1/sources/{source_id}`：返回原始链接和已保存标题。
- `POST /api/v1/sources/{source_id}/capture`：支持元数据标题回写。
- 元数据请求使用 `capture_scope: "metadata_only"`，不附带正文。
- 回写响应包含 `source_id` 与 `captured.title`；客户端再 GET 回读确认。

服务端必须实施访问控制、URL 校验、去重与来源匹配；需要抓取其他来源时，
还应防范 SSRF 并尊重访问限制。标题保护必须由服务端可靠执行，不能只依赖
客户端的先读后写检查来防止并发覆盖。安装本工具不会开放任何人的私人资料库。

## 开发、测试与验证边界

```sh
npm test
lua tests/logic.lua
lua tests/client.lua
lua tests/capture.lua
lua tests/title_flow.lua
lua tests/titles.lua
luac -p ResearchClipper.spoon/init.lua
luac -p ResearchClipper.spoon/titles.lua
```

Node 测试无需浏览器。Lua 测试需要另行安装 Lua。真实 Chromium 扩展测试使用：

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

浏览器测试下载体积较大，建议在 CI 或专用测试环境运行。
测试中的网络响应是隔离夹具，不会访问实际公众号或私人网站。
CI、模拟队列和 HTTP 成功响应都不能替代实机权限、真实标题回读及搜索验收。
当前验证状态见 [VERIFICATION.md](VERIFICATION.md)。

## 隐私与卸载

仅在你触发收藏时读取当前链接，不扫描微信聊天、点赞列表或剪贴板历史。
标题流程只向你配置的 ResearchOS 发送文章链接、标题和任务凭据，不发送正文、
Cookie 或密钥。本机待处理队列包含链接、标题、来源 ID 和状态，请保护本机账号。

卸载 Mac 版时，只移除 `init.lua` 内 ResearchClipper 的配置块及对应 Spoon，
再 Reload Config；保留其他 Spoon、隧道和系统登录设置。
卸载浏览器扩展会移除其本地队列。网站上已经保存的资料不会被删除。

本项目使用 MIT 许可证；Hammerspoon、Chrome 等依赖及原文章内容受各自许可约束。
