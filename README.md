# GLM Translation Public Web

这是一个可以部署到公网的翻译工作流网站。它使用 Node.js + Express 作为后端，前端是普通 HTML/CSS/JS，后端调用 GLM-4.7-Flash API。

## 功能

- 论文正文翻译
- 回复审稿人翻译
- 英文邮件翻译
- PPT 讲稿翻译
- 图注 / 表注翻译
- 术语表输入
- 输出译文和检查报告
- API Key 只保存在服务器环境变量里，不会暴露到浏览器
- 内置简单限流，默认每个 IP 每小时 60 次
- 可选访问码

## 本地运行

```bash
npm install
copy .env.example .env
npm start
```

Windows 里请打开 `.env`，填入：

```env
GLM_API_KEY=你的GLM_API_Key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4.7-flash
PORT=3000
```

浏览器打开：

```text
http://localhost:3000
```

## 部署到 Render

1. 把这个文件夹上传到 GitHub。
2. 打开 Render，选择 New Web Service。
3. 连接你的 GitHub 仓库。
4. Build Command 填：

```bash
npm install
```

5. Start Command 填：

```bash
npm start
```

6. 在 Environment Variables 里添加：

```env
GLM_API_KEY=你的GLM_API_Key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4.7-flash
MAX_TEXT_LENGTH=12000
RATE_LIMIT_PER_HOUR=60
```

7. 部署完成后，Render 会给你一个公网 URL。别人打开这个 URL 就能使用。

## 是否设置访问码

如果你希望任何人都能使用，保持这个变量为空：

```env
SITE_ACCESS_CODE=
```

如果你担心别人乱用你的 API 额度，可以设置：

```env
SITE_ACCESS_CODE=你自己设置的密码
```

用户打开网页后，需要在“访问码”输入框里填写这个密码。

## 注意

不要把 `.env` 上传到 GitHub。你的 API Key 只能放在部署平台的环境变量里。

如果网站真正公开，别人每用一次都会消耗你的 API 额度。建议保留限流，或者设置访问码。
