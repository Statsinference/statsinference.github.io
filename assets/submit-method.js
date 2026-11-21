'use strict';
/* GitHub-native intake: no backend, browser credentials, or anonymous writes. */
(() => {
  const trigger = document.getElementById('submit-method-btn');
  if (!trigger) return;
  const issueEndpoint = 'https://github.com/Statsinference/statsinference.github.io/issues/new';
  const dataGuide = 'https://github.com/Statsinference/Statistical-Intelligence-Arena/blob/main/CONTRIBUTING.md';
  const domains = new Set(['ate','cate','mediation','iv','proximal','did_sc','nonparametric_regression','quantile','semi_supervised','missing_data']);
  const dialog = document.createElement('dialog');
  dialog.id = 'method-submit-dialog';
  dialog.setAttribute('aria-labelledby', 'ms-title');
  dialog.innerHTML = `<div class="ms-heading"><h2 id="ms-title">Contribute to StatArena</h2><button type="button" class="ms-close" aria-label="Close contribution dialog">×</button></div>
    <div class="ms-choices">
      <button type="button" class="ms-method" autofocus>Submit a method</button>
      <a href="${dataGuide}">Contribute data</a>
    </div>
    <form id="method-submit-form" novalidate hidden>
      <p class="ms-intro">Submit a Hugging Face model link.</p>
      <label for="ms-url">Hugging Face model link</label>
      <input id="ms-url" type="url" required maxlength="1024" placeholder="https://huggingface.co/owner/model" autocomplete="off" spellcheck="false" aria-describedby="ms-help ms-status">
      <p class="ms-status" id="ms-help">Confirm your submission on GitHub. A GitHub account is required; submitted links are public.</p>
      <p class="ms-status" id="ms-status" role="status" aria-live="polite" hidden></p>
      <div class="ms-actions"><button type="button" class="ms-back">Back</button><button type="submit" class="ms-send" disabled>Continue on GitHub ↗</button></div>
    </form>`;
  document.body.append(dialog);
  const title = dialog.querySelector('#ms-title');
  const choices = dialog.querySelector('.ms-choices');
  const method = dialog.querySelector('.ms-method');
  const form = dialog.querySelector('form'), input = dialog.querySelector('#ms-url');
  const status = dialog.querySelector('#ms-status'), send = dialog.querySelector('.ms-send');
  let domain = '';
  function canonicalURL(value) {
    if (typeof value !== 'string' || value.length > 1024) return null;
    const raw = value.trim();
    if (!/^https:\/\/huggingface\.co\/[A-Za-z0-9][A-Za-z0-9_-]*\/[A-Za-z0-9][A-Za-z0-9._-]*(?:\/tree\/[A-Za-z0-9][A-Za-z0-9._-]*)?\/?$/.test(raw) || raw.includes('..')) return null;
    const u = new URL(raw);
    if (['spaces','datasets','organizations','api','settings','collections','join','login'].includes(u.pathname.split('/')[1].toLowerCase())) return null;
    return raw.replace(/\/$/, '');
  }
  function message(text, kind = '') { status.textContent = text; status.dataset.kind = kind; status.hidden = !text; }
  function updateSend() { send.disabled = !canonicalURL(input.value); }
  function showChoices() {
    title.textContent = 'Contribute to StatArena';
    form.hidden = true;
    choices.hidden = false;
  }
  trigger.addEventListener('click', () => {
    if (dialog.open) return;
    const selected = document.querySelector('#tabs [aria-selected="true"]')?.dataset.t;
    domain = domains.has(selected) ? selected : '';
    showChoices();
    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
  });
  method.addEventListener('click', () => {
    if (domain === 'mediation') {
      window.location.assign(issueEndpoint + '?template=mediation-method.yml');
      return;
    }
    title.textContent = 'Submit a method';
    choices.hidden = true;
    form.hidden = false;
    message(''); updateSend();
    input.focus();
  });
  dialog.querySelector('.ms-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.ms-back').addEventListener('click', () => {
    showChoices();
    method.focus();
  });
  dialog.addEventListener('close', () => { trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); });
  input.addEventListener('input', () => { input.setCustomValidity(''); message(''); updateSend(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const url = canonicalURL(input.value);
    if (!url) { input.setCustomValidity('Enter a Hugging Face model link, without credentials or query parameters.'); input.reportValidity(); return; }
    const model = new URL(url).pathname.split('/').slice(1, 3).join('/');
    const body = '### Hugging Face model link\n' + url + '\n\n### Research domain\n' + (domain || 'unspecified') + '\n\n<!-- arena-method-submission:v1 -->';
    const query = new URLSearchParams({title: '[Method submission] ' + model, body});
    const link = document.createElement('a');
    link.href = issueEndpoint + '?' + query; link.target = '_blank'; link.rel = 'noopener noreferrer';
    document.body.append(link); link.click(); link.remove();
    // Opening a prefilled form is not confirmation that the issue was submitted.
    message('Click Create on GitHub to finish submitting your link.');
  });
})();
