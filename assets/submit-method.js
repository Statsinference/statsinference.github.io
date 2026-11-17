'use strict';
/* Direct submission. Credentials stay on the server; this code never opens GitHub. */
(() => {
  const trigger = document.getElementById('submit-method-btn');
  if (!trigger) return;
  const domains = {
    ate: 'Average Treatment Effect', cate: 'Conditional Average Treatment Effect',
    mediation: 'Mediation', iv: 'Instrumental Variables', proximal: 'Proximal Causal Inference',
    did_sc: 'Difference-in-Differences', nonparametric_regression: 'Nonparametric Regression',
    quantile: 'Quantile Inference', semi_supervised: 'Semi-Supervised Inference', missing_data: 'Missing Data'
  };
  const dialog = document.createElement('dialog');
  dialog.id = 'method-submit-dialog';
  dialog.setAttribute('aria-labelledby', 'ms-title');
  dialog.innerHTML = `<div class="ms-heading"><h2 id="ms-title">Submit your method</h2><button type="button" class="ms-close" aria-label="Close submission form">×</button></div>
    <form id="method-submit-form" novalidate>
      <label for="ms-domain">Research domain</label>
      <select id="ms-domain" name="domain" required><option value="">Choose a domain</option></select>
      <label for="ms-url">Hugging Face model link</label>
      <input id="ms-url" name="huggingface_url" type="url" required maxlength="512" placeholder="https://huggingface.co/owner/model" autocomplete="off" spellcheck="false" aria-describedby="ms-status">
      <div class="ms-honeypot" aria-hidden="true"><label for="ms-website">Leave empty</label><input id="ms-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
      <p class="ms-status" id="ms-status" role="status" aria-live="polite" hidden></p>
      <div class="ms-actions"><button type="button" class="ms-cancel">Cancel</button><button type="submit" class="ms-send" disabled>Submit your method</button></div>
    </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form'), input = dialog.querySelector('#ms-url');
  const select = dialog.querySelector('#ms-domain'), status = dialog.querySelector('#ms-status');
  const send = dialog.querySelector('.ms-send'), closeButtons = [...dialog.querySelectorAll('.ms-close,.ms-cancel')];
  for (const [id, name] of Object.entries(domains)) select.add(new Option(name, id));
  let busy = false;
  function canonicalURL(value) {
    if (typeof value !== 'string' || value.length > 512) return null;
    const raw = value.trim();
    if (!/^https:\/\/huggingface\.co\/[A-Za-z0-9][A-Za-z0-9_-]*\/[A-Za-z0-9][A-Za-z0-9._-]*(?:\/tree\/[A-Za-z0-9][A-Za-z0-9._-]*)?\/?$/.test(raw) || raw.includes('..')) return null;
    if (['spaces','datasets','organizations','api','settings','collections','join','login'].includes(raw.split('/')[3].toLowerCase())) return null;
    return raw.replace(/\/$/, '');
  }
  function message(text, kind = '') { status.textContent = text; status.dataset.kind = kind; status.hidden = !text; }
  function updateSend() {
    send.disabled = busy || !Object.hasOwn(domains, select.value) || !canonicalURL(input.value);
    input.disabled = select.disabled = busy;
    for (const button of closeButtons) button.disabled = busy;
    form.setAttribute('aria-busy', String(busy));
  }
  trigger.addEventListener('click', () => {
    if (dialog.open) return;
    const selected = document.querySelector('#tabs [aria-selected="true"]')?.dataset.t;
    select.value = Object.hasOwn(domains, selected) ? selected : '';
    message(''); updateSend();
    dialog.showModal(); trigger.setAttribute('aria-expanded', 'true'); select.focus();
  });
  for (const button of closeButtons) button.addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); });
  for (const field of [input, select]) field.addEventListener('input', () => { field.setCustomValidity(''); message(''); updateSend(); });
  select.addEventListener('change', updateSend);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (!Object.hasOwn(domains, select.value)) { select.setCustomValidity('Choose a research domain.'); select.reportValidity(); return; }
    const url = canonicalURL(input.value), domain = select.value;
    if (!url) { input.setCustomValidity('Enter a Hugging Face model link without credentials or query parameters.'); input.reportValidity(); return; }
    busy = true; updateSend(); send.textContent = 'Submitting…'; message('');
    try {
      const configResponse = await fetch('assets/submission-config.json', {cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(8000)});
      if (!configResponse.ok) throw new Error('configuration');
      const config = await configResponse.json();
      if (config.mode !== 'direct' || config.enabled !== true || typeof config.endpoint !== 'string' || !config.endpoint) throw new Error('configuration');
      const endpoint = new URL(config.endpoint);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.port || endpoint.pathname !== '/api/submit') throw new Error('configuration');
      const response = await fetch(endpoint.href, {
        method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: {'Content-Type': 'application/json', 'X-Arena-Submission': '1'},
        body: JSON.stringify({domain, huggingface_url: url, website: form.elements.website.value}),
        signal: AbortSignal.timeout(55000)
      });
      const result = await response.json();
      if (response.status === 429) { message('Too many submissions. Please try again later.', 'error'); return; }
      if (![200,201].includes(response.status) || result.ok !== true || !/^[a-f0-9]{32}$/.test(result.receipt || '')) throw new Error('unconfirmed');
      message(result.duplicate ? 'This link has already been submitted to this domain.' : 'Your method has been submitted successfully.', 'success');
      input.value = ''; // Clear only after a confirmed stored receipt.
    } catch (_) { message('We could not confirm your submission. Your link has been kept; please try again.', 'error'); }
    finally { busy = false; send.textContent = 'Submit your method'; updateSend(); }
  });
})();
