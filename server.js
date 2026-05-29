import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = process.env.GLM_API_KEY;
const BASE_URL = (process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/$/, '');
const MODEL = process.env.GLM_MODEL || 'glm-4.7-flash';
const SITE_ACCESS_CODE = process.env.SITE_ACCESS_CODE || '';
const MAX_TEXT_LENGTH = Number(process.env.MAX_TEXT_LENGTH || 12000);
const RATE_LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR || 60);

const requestLog = new Map();
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}
function checkRateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const records = (requestLog.get(ip) || []).filter((t) => now - t < windowMs);
  if (records.length >= RATE_LIMIT_PER_HOUR) {
    return res.status(429).json({ error: `请求太频繁。当前限制为每小时 ${RATE_LIMIT_PER_HOUR} 次。` });
  }
  records.push(now);
  requestLog.set(ip, records);
  next();
}
function checkAccessCode(req, res, next) {
  if (!SITE_ACCESS_CODE) return next();
  const code = req.headers['x-site-access-code'] || req.body?.accessCode || '';
  if (code !== SITE_ACCESS_CODE) {
    return res.status(401).json({ error: '访问码不正确。' });
  }
  next();
}
function buildSystemPrompt({ mode, sourceLang, targetLang, glossary }) {
  const modeText = {
    paper: '论文正文。要求准确、正式、逻辑清楚。实验方法和结果优先使用过去式。避免破折号，避免不必要的现在分词。',
    reviewer: '回复审稿人。要求礼貌、严谨、克制，不要过度承诺。',
    email: '英文邮件。要求自然、礼貌、简洁，不要太生硬。',
    ppt: 'PPT讲稿。要求适合口头汇报，句子短，有过渡，便于直接说出来。',
    caption: '图注或表注。要求简洁、规范、术语统一。',
    general: '通用翻译。要求意思准确，语言自然，表达清楚。'
  }[mode] || '通用翻译。要求意思准确，语言自然，表达清楚。';

  return `你是专业科研翻译助手。请把${sourceLang || '原文'}翻译成${targetLang || '目标语言'}。

任务类型：${modeText}

固定工作流：
1. 先理解原文含义，并大胆纠正明显错别字、听写错误或语序问题。
2. 统一术语，保留必要缩写。
3. 给出高质量译文。
4. 给出简短检查报告，包括术语、时态、逻辑和可能的不确定处。

术语表：
${glossary || '无'}

输出格式必须为：
【译文】
...

【检查报告】
- 术语：...
- 时态：...
- 逻辑：...
- 需确认：...`;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, model: MODEL, hasApiKey: Boolean(API_KEY) });
});

app.post('/api/translate', checkRateLimit, checkAccessCode, async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: '服务器没有配置 GLM_API_KEY。请在部署平台的环境变量中填写 API Key。' });
    }

    const { text, mode, sourceLang, targetLang, glossary, temperature = 0.2 } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: '请输入需要翻译的文本。' });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `文本太长。当前限制为 ${MAX_TEXT_LENGTH} 个字符。` });
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: Number(temperature),
        messages: [
          { role: 'system', content: buildSystemPrompt({ mode, sourceLang, targetLang, glossary }) },
          { role: 'user', content: text }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || data?.message || 'GLM API 调用失败。',
        raw: data
      });
    }

    const output = data?.choices?.[0]?.message?.content || '';
    res.json({ output, usage: data?.usage || null });
  } catch (err) {
    res.status(500).json({ error: err.message || '服务器内部错误。' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Public translation workflow site running on port ${port}`);
});
