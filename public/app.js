const $ = (id) => document.getElementById(id);

$('translateBtn').addEventListener('click', async () => {
  const btn = $('translateBtn');
  const output = $('outputText');
  btn.disabled = true;
  btn.textContent = '翻译中...';
  output.textContent = '正在按工作流处理，请稍候。';

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Site-Access-Code': $('accessCode')?.value || ''
      },
      body: JSON.stringify({
        text: $('inputText').value,
        mode: $('mode').value,
        sourceLang: $('sourceLang').value,
        targetLang: $('targetLang').value,
        glossary: $('glossary').value,
        temperature: $('temperature').value,
        accessCode: $('accessCode')?.value || ''
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    output.textContent = data.output || '没有返回内容。';
  } catch (err) {
    output.textContent = `出错了：${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = '开始翻译';
  }
});

$('copyBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('outputText').textContent);
  $('copyBtn').textContent = '已复制';
  setTimeout(() => $('copyBtn').textContent = '复制', 1200);
});

$('clearBtn').addEventListener('click', () => {
  $('inputText').value = '';
});
