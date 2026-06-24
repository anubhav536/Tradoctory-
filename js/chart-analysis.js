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
  supportedInput: ['image/png', 'image/jpeg', 'image/webp'],
  async analyze({ file, image }) {
    const fileSizeMb = file.size / (1024 * 1024);
    const resolutionBonus = image.width >= 1200 && image.height >= 700 ? 4 : 0;
    const score = Math.max(58, Math.min(94, Math.round(84 - fileSizeMb * 3 + resolutionBonus)));
    return {
      score,
      result: 'Chart screenshot is validated and normalized for the future AI vision adapter. Preview engine flags a trend-continuation setup only if price reclaims the marked liquidity zone with clean candle closes and volume confirmation.',
      action: score >= 80 ? 'Plan a conditional entry only after confirmation; avoid chasing the first impulse candle.' : 'Wait for a cleaner retest and stronger risk/reward before entering.',
      risks: [
        'Invalidate the idea if price closes back inside the prior consolidation range.',
        'Keep position size conservative until the future vision model confirms support/resistance quality.',
        'Avoid entries directly into nearby supply or demand without at least 1:2 planned reward.'
      ]
    };
  }
};

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Map([
  ['image/png', 'PNG'],
  ['image/jpeg', 'JPG/JPEG'],
  ['image/webp', 'WEBP']
]);

const upload = document.getElementById('chartUpload');
const dropzone = document.getElementById('chartDropzone');
const preview = document.getElementById('chartPreviewPanel');
const removeBtn = document.getElementById('removeImageBtn');
const validationEl = document.getElementById('uploadValidationMessage');
const runBtn = document.getElementById('runAnalysisBtn');
const status = document.getElementById('analysisStatus');
const ingestionState = document.getElementById('ingestionState');
const riskEngineState = document.getElementById('riskEngineState');
const imageDetailState = document.getElementById('imageDetailState');
const resultEl = document.getElementById('analysisResult');
const scoreEl = document.getElementById('qualityScore');
const ringFill = document.getElementById('scoreRingFill');
const actionEl = document.getElementById('suggestedAction');
const riskEl = document.getElementById('riskSummary');
let selectedFile = null;
let selectedImage = null;
let objectUrl = null;

function setStatus(label, mode = 'waiting') {
  if (!status) return;
  status.textContent = label;
  status.className = `status-pill ${mode}`;
}

function setValidation(message, mode = 'neutral') {
  if (!validationEl) return;
  validationEl.textContent = message;
  validationEl.className = `upload-validation-message ${mode}`;
}

function setRunEnabled(isEnabled) {
  if (runBtn) runBtn.disabled = !isEnabled;
}

function renderRisk(items) {
  if (!riskEl) return;
  riskEl.replaceChildren(...items.map((item) => {
    const element = document.createElement('li');
    element.textContent = item;
    return element;
  }));
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function resetUploadState(message = 'No chart selected yet.') {
  selectedFile = null;
  selectedImage = null;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
  if (upload) upload.value = '';
  preview?.replaceChildren(Object.assign(document.createElement('div'), {
    className: 'chart-preview-empty',
    textContent: message
  }));
  removeBtn?.setAttribute('hidden', '');
  setRunEnabled(false);
  ingestionState?.replaceChildren('Pending');
  riskEngineState?.replaceChildren('Standby');
  imageDetailState?.replaceChildren('Awaiting image');
  scoreEl?.replaceChildren('--');
  if (ringFill) ringFill.style.width = '0%';
  resultEl?.replaceChildren('Upload a chart screenshot to generate a market-structure summary, confluence notes, and invalidation levels.');
  actionEl?.replaceChildren('Wait for screenshot analysis before planning an entry.');
  renderRisk([
    'Define stop-loss before entry.',
    'Risk 1% or less until confirmation improves.',
    'Do not treat this educational analysis as financial advice.'
  ]);
  setStatus('Waiting');
  setValidation('Supported formats: PNG, JPG, JPEG, and WEBP up to 10 MB.', 'neutral');
}

function validateImageFile(file) {
  if (!file) return 'Choose a chart screenshot before running analysis.';
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) return 'Unsupported image type. Upload a PNG, JPG, JPEG, or WEBP screenshot.';
  if (file.size > MAX_IMAGE_SIZE_BYTES) return 'Image is too large. Upload a screenshot smaller than 10 MB.';
  return '';
}

function loadImageDimensions(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Could not read this image. Try a different screenshot.'));
    image.src = url;
  });
}

async function selectImage(file) {
  const validationError = validateImageFile(file);
  if (validationError) {
    resetUploadState('Upload rejected.');
    setValidation(validationError, 'error');
    setStatus('Invalid', 'error');
    return;
  }

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);

  try {
    selectedImage = await loadImageDimensions(objectUrl);
  } catch (error) {
    resetUploadState('Preview unavailable.');
    setValidation(error.message, 'error');
    setStatus('Invalid', 'error');
    return;
  }

  selectedFile = file;
  const image = document.createElement('img');
  image.src = objectUrl;
  image.alt = 'Uploaded trading chart screenshot preview';

  const metadata = document.createElement('div');
  metadata.className = 'chart-file-meta';
  const fileName = document.createElement('strong');
  fileName.textContent = file.name;
  const fileSize = document.createElement('span');
  fileSize.textContent = `${ACCEPTED_IMAGE_TYPES.get(file.type)} • ${formatBytes(file.size)} • ${selectedImage.width}×${selectedImage.height}`;
  metadata.replaceChildren(fileName, fileSize);
  preview?.replaceChildren(image, metadata);

  removeBtn?.removeAttribute('hidden');
  setRunEnabled(true);
  ingestionState?.replaceChildren('Validated');
  riskEngineState?.replaceChildren('Ready');
  imageDetailState?.replaceChildren(`${selectedImage.width}×${selectedImage.height}`);
  setValidation('Image validated. Preview is ready for analysis.', 'success');
  setStatus('Ready', 'ready');
}

upload?.addEventListener('change', () => selectImage(upload.files?.[0] || null));
removeBtn?.addEventListener('click', () => resetUploadState());

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove('drag-over');
  });
});

dropzone?.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files?.[0] || null;
  selectImage(file);
});

runBtn?.addEventListener('click', async () => {
  if (!selectedFile || !selectedImage) return;
  runBtn.disabled = true;
  setStatus('Analyzing', 'ready');
  riskEngineState?.replaceChildren('Running');
  const analysis = await chartAiPipeline.analyze({ file: selectedFile, image: selectedImage });
  resultEl?.replaceChildren(analysis.result);
  scoreEl?.replaceChildren(String(analysis.score));
  if (ringFill) ringFill.style.width = `${analysis.score}%`;
  actionEl?.replaceChildren(analysis.action);
  renderRisk(analysis.risks);
  setStatus('Complete', 'complete');
  riskEngineState?.replaceChildren('Complete');
  runBtn.disabled = false;
});

resetUploadState();
