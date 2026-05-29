const els = {
  modelBadge: document.getElementById('modelBadge'),
  textType: document.getElementById('textType'),
  direction: document.getElementById('direction'),
  accessCodeWrap: document.getElementById('accessCodeWrap'),
  accessCode: document.getElementById('accessCode'),
  sourceText: document.getElementById('sourceText'),
  userGlossary: document.getElementById('userGlossary'),
  lengthHint: document.getElementById('lengthHint'),
  clearBtn: document.getElementById('clearBtn'),
  loadBaseGlossaryBtn: document.getElementById('loadBaseGlossaryBtn'),
  translateBtn: document.getElementById('translateBtn'),
  copyResultBtn: document.getElementById('copyResultBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  statusBox: document.getElementById('statusBox'),
  promptBoxWrap: document.getElementById('promptBoxWrap'),
  resultBoxWrap: document.getElementById('resultBoxWrap'),
  promptBox: document.getElementById('promptBox'),
  resultBox: document.getElementById('resultBox')
};

let appConfig = { baseTerminology: '', maxTextLength: 12000, requiresAccessCode: false };

function showStatus(message, isError = false) {
  els.statusBox.textContent = message;
  els.statusBox.classList.remove('hidden');
  els.statusBox.classList.toggle('error', isError);
}

function hideStatus() {
  els.statusBox.classList.add('hidden');
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    appConfig = await res.json();
    els.modelBadge.textContent = appConfig.model || 'GLM';
    if (appConfig.requiresAccessCode) {
      els.accessCodeWrap.classList.remove('hidden');
    }
    updateLengthHint();
  } catch (err) {
    showStatus('配置加载失败，请检查服务是否正常运行。', true);
  }
}

function updateLengthHint() {
  const len = els.sourceText.value.length;
  els.lengthHint.textContent = `${len} / ${appConfig.maxTextLength || 12000} 字符`;
}

els.sourceText.addEventListener('input', updateLengthHint);

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
  els.promptBoxWrap.classList.add('hidden');
  els.resultBoxWrap.classList.add('hidden');
  els.promptBox.textContent = '';
  els.resultBox.textContent = '';
  showStatus('正在执行单次工作流：生成 Prompt、提取术语、翻译和检查。请稍等。');

  try {
    const res = await fetch('/api/translate-workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceText,
        textType: els.textType.value,
        direction: els.direction.value,
        userGlossary: els.userGlossary.value,
        accessCode: els.accessCode.value
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || '请求失败。');
    }

    els.resultBox.textContent = data.result || '';
    els.resultBoxWrap.classList.remove('hidden');
    showStatus('完成。结果里已包含 Prompt、术语表、译文和检查。');
  } catch (err) {
    showStatus(err.message || '翻译失败。', true);
  } finally {
    els.translateBtn.disabled = false;
  }
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
  const prompt = els.promptBox.textContent || '';
  const result = els.resultBox.textContent || '';
  if (!prompt && !result) {
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
