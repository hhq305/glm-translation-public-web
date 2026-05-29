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
const GLM_MAX_OUTPUT_TOKENS = Number(process.env.GLM_MAX_OUTPUT_TOKENS || 4000);
const MAX_CUSTOM_PROMPT_LENGTH = Number(process.env.MAX_CUSTOM_PROMPT_LENGTH || 3000);
const SITE_ACCESS_CODE = process.env.SITE_ACCESS_CODE || '';

app.use(helmet({ contentSecurityPolicy: false }));
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
      temperature,
      max_tokens: GLM_MAX_OUTPUT_TOKENS
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

function getModePrompt(textType) {
  const common = `You are a careful translation assistant. Translate accurately and naturally. Keep chemical formulas, units, equations, variables, sample IDs, and numbers unchanged. Do not invent data, references, methods, or conclusions. Extract only important technical terms from the source text and merge them with the provided glossary. If something is unclear, translate conservatively and list it under issues to confirm.`;

  const prompts = {
    paper: `${common}\nMode: Academic paper. Use formal academic language. For experimental methods and results, use past tense. Avoid unnecessary present participles. Avoid em dashes. Improve clarity, grammar, and logical flow without changing the meaning. Keep terminology consistent.`,
    reviewer: `${common}\nMode: Response to reviewers. Use polite, precise, and professional language. Avoid overclaiming. Clearly state what was revised, added, checked, clarified, or corrected. Keep the response concise and respectful.`,
    email: `${common}\nMode: Email. Use natural, polite, and concise English. Avoid stiff expressions. Keep the message clear and easy to read. For professors, editors, or administrators, keep a professional tone.`,
    ppt: `${common}\nMode: Presentation script. Use spoken English. Keep sentences short and smooth. Add simple transitions when useful. Avoid dense paper-style sentences. Make the text easy to speak aloud.`,
    caption: `${common}\nMode: Figure or table caption. Use concise caption style. Keep abbreviations, units, symbols, and figure labels consistent. Avoid long explanations. Explain abbreviations only when needed.`,
    general: `${common}\nMode: General translation. Translate accurately and naturally. Keep the style clear, readable, and faithful to the source. Avoid over-editing unless the original text is unclear.`
  };

  return prompts[textType] || prompts.general;
}

function getTextTypeLabel(textType) {
  const labels = {
    paper: '论文正文',
    reviewer: '回复审稿人',
    email: '英文邮件',
    ppt: 'PPT讲稿',
    caption: '图注 / 表注',
    general: '通用翻译'
  };
  return labels[textType] || labels.general;
}

app.get('/api/config', (req, res) => {
  res.json({
    model: GLM_MODEL,
    requiresAccessCode: Boolean(SITE_ACCESS_CODE),
    maxTextLength: MAX_TEXT_LENGTH,
    rateLimitPerHour: RATE_LIMIT_PER_HOUR,
    maxOutputTokens: GLM_MAX_OUTPUT_TOKENS,
    maxCustomPromptLength: MAX_CUSTOM_PROMPT_LENGTH,
    baseTerminology,
    modePrompts: {
      paper: getModePrompt('paper'),
      reviewer: getModePrompt('reviewer'),
      email: getModePrompt('email'),
      ppt: getModePrompt('ppt'),
      caption: getModePrompt('caption'),
      general: getModePrompt('general')
    }
  });
});

app.post('/api/translate-workflow', rateLimit, requireAccessCode, async (req, res) => {
  try {
    const { sourceText, textType = 'paper', userGlossary = '', direction = 'auto', customPrompt = '', customPromptMode = 'append' } = req.body || {};
    if (!sourceText || !sourceText.trim()) {
      return res.status(400).json({ error: 'Source text is required.' });
    }
    if (sourceText.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `Text is too long. Max length is ${MAX_TEXT_LENGTH} characters.` });
    }

    if ((customPrompt || '').length > MAX_CUSTOM_PROMPT_LENGTH) {
      return res.status(400).json({ error: `Custom prompt is too long. Max length is ${MAX_CUSTOM_PROMPT_LENGTH} characters.` });
    }

    const fixedPrompt = getModePrompt(textType);
    const cleanCustomPrompt = (customPrompt || '').trim();
    const promptMode = customPromptMode === 'override' ? 'override' : 'append';
    const effectivePrompt = cleanCustomPrompt
      ? (promptMode === 'override'
        ? `${fixedPrompt}\n\nUser custom prompt override or detailed instruction:\n${cleanCustomPrompt}\n\nIf any instruction conflicts, follow the user custom prompt, but do not violate safety or factual accuracy.`
        : `${fixedPrompt}\n\nAdditional user custom instructions:\n${cleanCustomPrompt}\n\nFollow both the fixed mode prompt and the additional user instructions. If there is a conflict, prioritize the user custom instruction for style or format, but keep terminology and factual accuracy.`)
      : fixedPrompt;
    const textTypeLabel = getTextTypeLabel(textType);
    const mergedGlossary = `${baseTerminology}\n${userGlossary || ''}`.trim();

    const messages = [
      {
        role: 'system',
        content: effectivePrompt
      },
      {
        role: 'user',
        content: `Use the fixed prompt below. Do not generate a new prompt.\n\nFixed mode prompt:\n${fixedPrompt}\n\nText type: ${textTypeLabel}\nTranslation direction: ${direction}\n\nGlossary to follow:\n${mergedGlossary}\n\nSource text:\n${sourceText}\n\nComplete the workflow in one response:\n1. Extract a concise glossary from the source text and merge it with the provided glossary. Include no more than 15 core terms unless the text clearly requires more.\n2. Translate the source text according to the fixed prompt and glossary.\n3. Check terminology, grammar, tense, logic, units, symbols, chemical formulas, and ambiguity.\n\nOutput exactly with these sections:\n【Fixed prompt used】\nBriefly show the fixed mode prompt that was used.\n\n【Auto glossary】\nUse a concise table with: Source term | Recommended translation | Note.\n\n【Translation】\nProvide the final translation.\n\n【Chinese explanation / 中文对照】\nGive a Chinese counterpart or Chinese explanation so the user can verify meaning. If the target language is Chinese, briefly explain key translation choices in Chinese.\n\n【Terminology check】\nList whether key terms were consistent.\n\n【Quality check】\nCheck tense, grammar, logic, units, symbols, and style. Keep it concise.\n\n【Issues to confirm】\nList ambiguous points. If none, write “None”.`
      }
    ];

    const result = await callGLM(messages, 0.15);

    res.json({
      result,
      fixedPrompt,
      customPrompt: cleanCustomPrompt,
      customPromptMode: promptMode,
      effectivePrompt,
      workflowMode: 'fixed_prompt_with_optional_custom_prompt_single_call'
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
