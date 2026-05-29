# GLM Translation Workflow Website v2

This version adds a two-stage translation workflow:

1. GLM first generates a custom translation prompt and extracts a terminology glossary.
2. GLM then uses that prompt and glossary to translate the text.

## Run locally

```bash
npm install
cp .env.example .env
npm start
```

Open:

```text
http://localhost:3000
```

## Required environment variables

```env
GLM_API_KEY=your_glm_api_key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4.7-flash
```

Optional:

```env
MAX_TEXT_LENGTH=12000
RATE_LIMIT_PER_HOUR=60
SITE_ACCESS_CODE=
```

If `SITE_ACCESS_CODE` is empty, the website is open to everyone. If it is set, users must enter the access code on the webpage.

## Deploy on Render

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

Add environment variables in Render Dashboard. Do not upload `.env` to GitHub.
