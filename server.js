require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GLM_API_KEY = process.env.GLM_API_KEY;
const GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
const GLM_MODEL = process.env.GLM_MODEL || 'glm-4.7-flash';
const MAX_TEXT_LENGTH = Number(process.env.MAX_TEXT_LENGTH || 12000);
const RATE_LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR || 60);
const SITE_ACCESS_CODE = process.env.SITE_ACCESS_CODE || '';

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ipHits = new Map();

function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const record = ipHits.get(ip) || [];
  const fresh = record.filter((t) => now - t < oneHour);
  if (fresh.length >= RATE_LIMIT_PER_HOUR) {
    return res.status(429).json({ error: `Too many requests. Limit: ${RATE_LIMIT_PER_HOUR} per hour.` });
  }
  fresh.push(now);
  ipHits.set(ip, fresh);
  next();
}

function requireAccessCode(req, res, next) {
  if (!SITE_ACCESS_CODE) return next();
  const code = req.body.accessCode || req.headers['x-site-access-code'];
  if (code !== SITE_ACCESS_CODE) {
    return res.status(401).json({ error: 'Access code is incorrect.' });
  }
  next();
}

async function callGLM(messages, temperature = 0.2) {
  if (!GLM_API_KEY) {
    throw new Error('GLM_API_KEY is missing. Please set it in environment variables.');
  }

  const response = await fetch(`${GLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GLM_API_KEY}`
    },
    body: JSON.stringify({
      model: GLM_MODEL,
      messages,
      temperature
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || JSON.stringify(data);
    throw new Error(`GLM API error: ${detail}`);
  }
  return data?.choices?.[0]?.message?.content || '';
}

const baseTerminology = `
电辅助正渗透 = electrically assisted forward osmosis, eFO
正渗透 = forward osmosis, FO
微生物脱盐电池 = microbial desalination cell, MDC
膜蒸馏 = membrane distillation, MD
鸟粪石 = struvite
汲取液 = draw solution
进料液 = feed solution
水通量 = water flux
溶质通量 = solute flux
反向溶质通量 = reverse solute flux, RSF
反向盐通量 = reverse salt flux, RSF
浓差极化 = concentration polarization, CP
内部浓差极化 = internal concentration polarization, ICP
外部浓差极化 = external concentration polarization, ECP
营养盐回收 = nutrient recovery
水资源再利用 = water reuse
农业废水 = agricultural wastewater
消化液上清液 = digester supernatant
阳极室 = anode chamber
阴极室 = cathode chamber
盐室 = salt chamber
阳离子交换膜 = cation exchange membrane, CEM
阴离子交换膜 = anion exchange membrane, AEM
外接电阻 = external resistance
功率密度 = power density
开路电压 = open circuit voltage, OCV
化学需氧量 = chemical oxygen demand, COD
总溶解固体 = total dissolved solids, TDS
施加电压 = applied voltage
电场 = electric field
离子迁移 = ion migration
离子扩散 = ion diffusion
沉淀 = precipitation
膜污染 = membrane fouling
结垢 = scaling
支持向量机 = support vector machine, SVM
混合模型 = hybrid model
机理模型 = mechanistic model
`;

function getStyleRules(textType) {
  const common = `
General rules:
1. Keep scientific meaning accurate.
2. Use concise and natural language.
3. Keep chemical formulas, units, equations, variables, and sample IDs unchanged.
4. Do not invent data, methods, references, or conclusions.
5. If the source text is ambiguous, translate conservatively and list it under "需要确认".
6. Preserve paragraph structure unless splitting improves clarity.
`;

  const map = {
    paper: `Academic paper mode:
1. Use formal academic English.
2. For experimental methods and results, use past tense.
3. Avoid unnecessary present participles.
4. Avoid em dashes.
5. Improve logic and readability without changing the meaning.
6. Keep terminology consistent across the whole translation.`,
    reviewer: `Reviewer response mode:
1. Use polite, precise, and professional English.
2. Avoid overclaiming.
3. Clearly state what was revised, added, clarified, or checked.
4. Keep the tone respectful and concise.`,
    email: `Email mode:
1. Use natural and polite English.
2. Keep it short and clear.
3. Avoid overly formal or stiff language unless the message is to a professor, editor, or administrator.`,
    ppt: `Presentation script mode:
1. Use spoken English.
2. Keep sentences short.
3. Add smooth transitions when needed.
4. Avoid dense written-paper style.`,
    caption: `Figure and table caption mode:
1. Use concise caption style.
2. Keep abbreviations, symbols, and units consistent.
3. Avoid long explanations.
4. Explain abbreviations when needed.`,
    general: `General translation mode:
1. Translate accurately and naturally.
2. Keep the tone clear and readable.
3. Avoid over-editing unless the original text is unclear.`
  };

  return `${common}\n${map[textType] || map.general}`;
}

app.get('/api/config', (req, res) => {
  res.json({
    model: GLM_MODEL,
    requiresAccessCode: Boolean(SITE_ACCESS_CODE),
    maxTextLength: MAX_TEXT_LENGTH,
    rateLimitPerHour: RATE_LIMIT_PER_HOUR,
    baseTerminology
  });
});

app.post('/api/translate-workflow', rateLimit, requireAccessCode, async (req, res) => {
  try {
    const { sourceText, textType = 'paper', userGlossary = '', direction = 'auto' } = req.body || {};
    if (!sourceText || !sourceText.trim()) {
      return res.status(400).json({ error: 'Source text is required.' });
    }
    if (sourceText.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `Text is too long. Max length is ${MAX_TEXT_LENGTH} characters.` });
    }

    const styleRules = getStyleRules(textType);
    const mergedGlossary = `${baseTerminology}\n${userGlossary || ''}`.trim();

    const workflowMessages = [
      {
        role: 'system',
        content: `You are an expert academic translation workflow assistant.
You must complete the entire workflow in one response:
1. Generate a task-specific translation prompt.
2. Extract and merge a bilingual terminology glossary.
3. Translate the source text.
4. Check terminology, style, logic, and ambiguity.

Do not call external sources. Do not invent data, methods, references, or conclusions.
Return structured content with the exact headings requested by the user.`
      },
      {
        role: 'user',
        content: `Complete this translation workflow in ONE response.

Text type: ${textType}
Translation direction: ${direction}

Existing glossary that must be respected and merged with newly extracted terms:
${mergedGlossary}

Style rules:
${styleRules}

Source text:
${sourceText}

Tasks:
1. Identify the likely academic or practical field.
2. Determine translation direction. If direction is auto, translate Chinese to English and English to Chinese.
3. Generate a custom translation prompt for this exact text.
4. Extract domain-specific terms, abbreviations, chemical species, instruments, variables, model names, and methods. Merge them with the existing glossary.
5. Translate the source text according to the generated prompt and glossary.
6. Check terminology consistency, tense, grammar, logic, units, symbols, chemical formulas, variables, and possible ambiguity.

Output exactly with these sections:
【Generated prompt】
Write the actual prompt that guided the translation.

【Auto glossary】
Use a concise table with: Source term | Recommended translation | Note.

【Detected field】
State the field briefly.

【Translation direction】
State the direction briefly.

【Translation】
Provide the final translation. For academic paper methods and results, use past tense. Avoid unnecessary present participles and em dashes.

【Chinese explanation / 中文对照】
Give a Chinese explanation or Chinese counterpart so the user can verify meaning. If the target language is Chinese, briefly explain key choices in Chinese.

【Terminology check】
List whether key glossary terms were followed and whether any terms need confirmation.

【Quality check】
Check tense, grammar, logic, units, symbols, and style.

【Issues to confirm】
List any ambiguous points. If none, write “None”.`
      }
    ];

    const result = await callGLM(workflowMessages, 0.2);

    res.json({
      result,
      generatedPromptAndGlossary: '',
      workflowMode: 'single_call'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`GLM translation workflow site is running on port ${PORT}`);
});
