const els = {
  modelBadge: document.getElementById('modelBadge'),
  textType: document.getElementById('textType'),
  direction: document.getElementById('direction'),
  customPromptMode: document.getElementById('customPromptMode'),
  customPrompt: document.getElementById('customPrompt'),
  customPromptHint: document.getElementById('customPromptHint'),
  accessCodeWrap: document.getElementById('accessCodeWrap'),
  accessCode: document.getElementById('accessCode'),
  sourceText: document.getElementById('sourceText'),
  userGlossary: document.getElementById('userGlossary'),
  lengthHint: document.getElementById('lengthHint'),
  modePromptPreview: document.getElementById('modePromptPreview'),
  clearBtn: document.getElementById('clearBtn'),
  loadBaseGlossaryBtn: document.getElementById('loadBaseGlossaryBtn'),
  translateBtn: document.getElementById('translateBtn'),
  copyResultBtn: document.getElementById('copyResultBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  statusBox: document.getElementById('statusBox'),
  resultBoxWrap: document.getElementById('resultBoxWrap'),
  resultBox: document.getElementById('resultBox')
};

let appConfig = { baseTerminology: '', maxTextLength: 12000, maxCustomPromptLength: 3000, requiresAccessCode: false, modePrompts: {} };
let cooldownTimer = null;
const COOLDOWN_SECONDS = 30;

function showStatus(message, isError = false) {
  els.statusBox.textContent = message;
  els.statusBox.classList.remove('hidden');
  els.statusBox.classList.toggle('error', isError);
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    appConfig = await res.json();
    els.modelBadge.textContent = appConfig.model || 'GLM';
    if (appConfig.requiresAccessCode) els.accessCodeWrap.classList.remove('hidden');
    updateLengthHint();
    updateCustomPromptHint();
    updatePromptPreview();
  } catch (err) {
    showStatus('配置加载失败，请检查服务是否正常运行。', true);
  }
}

function updateLengthHint() {
  const len = els.sourceText.value.length;
  els.lengthHint.textContent = `${len} / ${appConfig.maxTextLength || 12000} 字符`;
}

function updateCustomPromptHint() {
  const len = els.customPrompt.value.length;
  els.customPromptHint.textContent = `${len} / ${appConfig.maxCustomPromptLength || 3000} 字符`;
}

function updatePromptPreview() {
  const prompt = appConfig.modePrompts?.[els.textType.value] || '';
  els.modePromptPreview.textContent = prompt || 'Prompt 加载中。';
}

function startCooldown() {
  let left = COOLDOWN_SECONDS;
  els.translateBtn.disabled = true;
  els.translateBtn.textContent = `冷却中 ${left}s`;
  cooldownTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      els.translateBtn.disabled = false;
      els.translateBtn.textContent = '按 Prompt 翻译';
      return;
    }
    els.translateBtn.textContent = `冷却中 ${left}s`;
  }, 1000);
}

els.sourceText.addEventListener('input', updateLengthHint);
els.customPrompt.addEventListener('input', updateCustomPromptHint);
els.textType.addEventListener('change', updatePromptPreview);

els.clearBtn.addEventListener('click', () => {
  els.sourceText.value = '';
  updateLengthHint();
});

els.loadBaseGlossaryBtn.addEventListener('click', () => {
  els.userGlossary.value = appConfig.baseTerminology || '';
});

els.translateBtn.addEventListener('click', async () => {
  const sourceText = els.sourceText.value.trim();
  if (!sourceText) {
    showStatus('请先输入需要翻译的内容。', true);
    return;
  }

  els.translateBtn.disabled = true;
  els.resultBoxWrap.classList.add('hidden');
  els.resultBox.textContent = '';
  showStatus('正在按当前模式 Prompt 与自定义要求执行翻译、术语提取和检查。请稍等。');

  try {
    const res = await fetch('/api/translate-workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceText,
        textType: els.textType.value,
        direction: els.direction.value,
        userGlossary: els.userGlossary.value,
        customPrompt: els.customPrompt.value,
        customPromptMode: els.customPromptMode.value,
        accessCode: els.accessCode.value
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败。');

    els.resultBox.textContent = data.result || '';
    els.resultBoxWrap.classList.remove('hidden');
    showStatus('完成。已按固定 Prompt 和自定义 Prompt 输出结果。');
  } catch (err) {
    showStatus(err.message || '翻译失败。', true);
    els.translateBtn.disabled = false;
    els.translateBtn.textContent = '按 Prompt 翻译';
    return;
  }

  startCooldown();
});

els.copyResultBtn.addEventListener('click', async () => {
  const text = els.resultBox.textContent || '';
  if (!text) {
    showStatus('还没有可复制的翻译结果。', true);
    return;
  }
  await navigator.clipboard.writeText(text);
  showStatus('翻译结果已复制。');
});

els.downloadBtn.addEventListener('click', () => {
  const result = els.resultBox.textContent || '';
  if (!result) {
    showStatus('还没有可下载的结果。', true);
    return;
  }
  const md = `# GLM Translation Workflow Result\n\n${result}\n`;
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `translation-workflow-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

loadConfig();
