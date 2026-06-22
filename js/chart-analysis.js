'use strict';

import { guardRoute, signOutAndRedirect } from './route-guard.js';

const user = guardRoute('login.html');
if (!user) throw new Error('Unauthenticated — redirecting.');

const nameEl = document.getElementById('userDisplayName');
const planEl = document.getElementById('userDisplayPlan');
const avatarEl = document.getElementById('userAvatarInitial');
const signOutBtn = document.getElementById('signOutBtn');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');

if (nameEl) nameEl.textContent = user.name ?? user.email;
if (planEl) planEl.textContent = user.plan === 'free' ? 'Free plan' : 'Pro plan';
if (avatarEl) avatarEl.textContent = (user.name ?? user.email).charAt(0).toUpperCase();
signOutBtn?.addEventListener('click', () => signOutAndRedirect('index.html'));
menuToggle?.addEventListener('click', () => {
  const isOpen = sidebar?.classList.toggle('open') ?? false;
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});
document.addEventListener('click', (event) => {
  if (!sidebar?.classList.contains('open')) return;
  if (sidebar.contains(event.target) || menuToggle?.contains(event.target)) return;
  sidebar.classList.remove('open');
  menuToggle?.setAttribute('aria-expanded', 'false');
});

const chartAiPipeline = {
  provider: 'local-preview',
  async analyze({ file }) {
    const fileSizeMb = file.size / (1024 * 1024);
    const score = Math.max(58, Math.min(92, Math.round(86 - fileSizeMb * 4)));
    return {
      score,
      result: 'Chart structure is ready for AI review. Preview engine flags a trend-continuation setup only if price reclaims the marked liquidity zone with clean candle closes and volume confirmation.',
      action: score >= 80 ? 'Plan a conditional long only after confirmation; avoid chasing the first impulse candle.' : 'Wait for a cleaner retest and stronger risk/reward before entering.',
      risks: [
        'Invalidate the idea if price closes back inside the prior consolidation range.',
        'Keep position size conservative until the future vision model confirms support/resistance quality.',
        'Avoid entries directly into nearby supply or demand without at least 1:2 planned reward.'
      ]
    };
  }
};

const upload = document.getElementById('chartUpload');
const preview = document.getElementById('chartPreviewPanel');
const runBtn = document.getElementById('runAnalysisBtn');
const status = document.getElementById('analysisStatus');
const ingestionState = document.getElementById('ingestionState');
const riskEngineState = document.getElementById('riskEngineState');
const resultEl = document.getElementById('analysisResult');
const scoreEl = document.getElementById('qualityScore');
const ringFill = document.getElementById('scoreRingFill');
const actionEl = document.getElementById('suggestedAction');
const riskEl = document.getElementById('riskSummary');
let selectedFile = null;

function setStatus(label, mode = 'waiting') {
  if (!status) return;
  status.textContent = label;
  status.className = `status-pill ${mode}`;
}

function renderRisk(items) {
  if (!riskEl) return;
  riskEl.replaceChildren(...items.map((item) => {
    const element = document.createElement('li');
    element.textContent = item;
    return element;
  }));
}

upload?.addEventListener('change', () => {
  selectedFile = upload.files?.[0] || null;
  if (!selectedFile) return;
  const url = URL.createObjectURL(selectedFile);
  if (preview) {
    const image = document.createElement('img');
    image.src = url;
    image.alt = 'Uploaded trading chart screenshot preview';

    const metadata = document.createElement('div');
    metadata.className = 'chart-file-meta';
    const fileName = document.createElement('strong');
    fileName.textContent = selectedFile.name;
    const fileSize = document.createElement('span');
    fileSize.textContent = `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`;
    metadata.replaceChildren(fileName, fileSize);
    preview.replaceChildren(image, metadata);
  }
  if (runBtn) runBtn.disabled = false;
  ingestionState?.replaceChildren('Image loaded');
  riskEngineState?.replaceChildren('Ready');
  setStatus('Ready', 'ready');
});

runBtn?.addEventListener('click', async () => {
  if (!selectedFile) return;
  runBtn.disabled = true;
  setStatus('Analyzing', 'ready');
  riskEngineState?.replaceChildren('Running');
  const analysis = await chartAiPipeline.analyze({ file: selectedFile });
  resultEl?.replaceChildren(analysis.result);
  scoreEl?.replaceChildren(String(analysis.score));
  if (ringFill) ringFill.style.width = `${analysis.score}%`;
  actionEl?.replaceChildren(analysis.action);
  renderRisk(analysis.risks);
  setStatus('Complete', 'complete');
  riskEngineState?.replaceChildren('Complete');
  runBtn.disabled = false;
});
