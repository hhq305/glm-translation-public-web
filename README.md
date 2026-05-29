# GLM 科研翻译工作流 v4

这一版采用固定模式 Prompt。

工作流：

1. 用户选择文本类型。
2. 网站自动把该模式对应的固定 Prompt + 可选自定义 Prompt 发送给 GLM。
3. GLM 在一次请求里完成术语提取、翻译和检查。

相比 v3，这一版不再让模型先生成 Prompt，所以请求更轻，也更稳定。

## Render 设置

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

Environment Variables:

```env
GLM_API_KEY=你的 API Key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4.7-flash
MAX_TEXT_LENGTH=12000
RATE_LIMIT_PER_HOUR=60
GLM_MAX_OUTPUT_TOKENS=4000
```

如需访问码，可增加：

```env
SITE_ACCESS_CODE=your_password
```


## v5 update

This version adds an optional user custom prompt. The user can append extra requirements to the selected fixed mode prompt or mark the custom prompt as a priority instruction. The request still uses a single GLM API call.
