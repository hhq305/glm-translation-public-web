# GLM 科研翻译工作流 v3

这是一个可部署到 Render 的 Node.js 网站。

新版工作流在一次 GLM 请求中完成：

1. 生成任务专用 Prompt
2. 自动提取并合并术语表
3. 正式翻译
4. 进行术语、语法、时态、逻辑和格式检查

这样比两次 API 调用更稳定，也更不容易遇到访问量限制。

## 本地运行

```bash
npm install
cp .env.example .env
npm start
```

`.env` 示例：

```env
GLM_API_KEY=your_api_key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4.7-flash
MAX_TEXT_LENGTH=12000
RATE_LIMIT_PER_HOUR=60
SITE_ACCESS_CODE=
```

## Render 部署

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

Render 环境变量至少需要：

```env
GLM_API_KEY=你的真实 API Key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4.7-flash
```

如果不想设置访问码，就不要添加 `SITE_ACCESS_CODE`。
