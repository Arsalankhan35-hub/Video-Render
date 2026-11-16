const STORAGE_KEY = 'motioncraft-projects-v2';
const PREFS_KEY = 'motioncraft-preferences-v2';
const $ = id => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const state = { scenes: [], duration: 30, audioUrl: '', frame: 0, playing: false };
const PROVIDER_MODELS = {
  openai: 'gpt-4o-mini', openrouter: 'openai/gpt-4o-mini', groq: 'llama-3.3-70b-versatile',
  together: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', mistral: 'mistral-small-latest',
  deepseek: 'deepseek-chat', fireworks: 'accounts/fireworks/models/llama-v3p1-8b-instruct'
};

function status(message, type = 'info') {
  const el = $('status');
  el.textContent = message;
  el.className = `status visible ${type}`;
}
function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
function color(value, fallback) { return /^#[\da-f]{6}$/i.test(String(value || '')) ? value : fallback; }
function fmtTime(seconds) { return `00:${String(Math.floor(seconds)).padStart(2, '0')}`; }
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, r); c.fill(); }

function savePreferences() {
  // API credentials are deliberately excluded from browser storage.
  const prefs = { prompt: $('prompt').value, duration: $('duration').value, style: $('style').value,
    provider: $('provider').value, model: $('model').value, voiceModel: $('voiceModel').value,
    voice: $('voice').value, makeVoice: $('makeVoice').checked };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (error) { console.warn('Could not save preferences', error); }
}
function restorePreferences() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    $('prompt').value = p.prompt || '';
    $('duration').value = ['15', '30', '45', '60'].includes(String(p.duration)) ? String(p.duration) : '30';
    $('style').value = p.style || 'Cinematic';
    $('provider').value = PROVIDER_MODELS[p.provider] ? p.provider : 'openai';
    $('model').value = p.model || PROVIDER_MODELS[$('provider').value];
    $('voiceModel').value = p.voiceModel || 'tts-1';
    $('voice').value = p.voice || 'alloy';
    $('makeVoice').checked = p.makeVoice !== false;
  } catch (error) { console.warn('Could not restore preferences', error); }
  // Remove API keys persisted by previous app versions, if any.
  try {
    const projects = JSON.parse(localStorage.getItem('motioncraft-projects-v1') || '[]');
    if (Array.isArray(projects)) {
      projects.forEach(project => { if (project && Object.hasOwn(project, 'apiKey')) delete project.apiKey; });
      localStorage.setItem('motioncraft-projects-v1', JSON.stringify(projects));
    }
  } catch { /* ignore old or malformed project data */ }
  $('voiceSettings').classList.toggle('hidden', !$('makeVoice').checked);
}

function normalizeScenes(raw, duration) {
  if (!Array.isArray(raw) || !raw.length) throw new Error('The model returned no scenes. Try again with a different prompt or model.');
  const scenes = raw.slice(0, 8).map((s, i) => ({
    title: String(s?.title || `Scene ${i + 1}`).slice(0, 100),
    visual: String(s?.visual || '').slice(0, 250),
    narration: String(s?.narration || '').slice(0, 1000),
    caption: String(s?.caption || s?.narration || '').slice(0, 220),
    duration: Math.max(1, Number(s?.duration) || duration / raw.length),
    background: color(s?.background, ['#20223b', '#263340', '#332849', '#202d36'][i % 4]),
    accent: color(s?.accent, '#a58bff'),
    shapes: Array.isArray(s?.shapes) ? s.shapes.slice(0, 4).map(shape => ({
      type: ['circle', 'square', 'triangle'].includes(shape?.type) ? shape.type : 'circle',
      color: color(shape?.color, '#a58bff')
    })) : []
  }));
  const sum = scenes.reduce((n, s) => n + s.duration, 0) || duration;
  scenes.forEach(s => { s.duration = s.duration * duration / sum; });
  scenes[scenes.length - 1].duration += duration - scenes.reduce((n, s) => n + s.duration, 0);
  return scenes;
}
function parseJson(text) {
  const clean = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('The model response was not valid JSON. Try again or select a model that supports chat completions.');
  return JSON.parse(clean.slice(a, b + 1));
}

function getScene(time) {
  let elapsed = 0;
  for (let i = 0; i < state.scenes.length; i++) {
    const s = state.scenes[i], d = Number(s.duration) || state.duration / state.scenes.length;
    if (time < elapsed + d || i === state.scenes.length - 1) return { scene: s, index: i, progress: clamp((time - elapsed) / d, 0, 1) };
    elapsed += d;
  }
  return { scene: state.scenes[state.scenes.length - 1], index: 0, progress: 0 };
}
function wrapped(text, maxWidth, font) {
  ctx.font = font;
  let line = '', lines = [];
  for (const word of String(text || '').split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
function draw(time) {
  if (!state.scenes.length) return;
  const { scene, index, progress } = getScene(time), w = canvas.width, h = canvas.height;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, color(scene.background, '#20223b')); gradient.addColorStop(1, '#101116');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 54; i++) {
    const x = (i * 197 + time * (8 + i % 9)) % w, y = (i * 83) % h;
    ctx.globalAlpha = .15 + (i % 5) * .07; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, i % 7 === 0 ? 2 : 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const accent = color(scene.accent, '#a58bff'), cx = w * (.5 + Math.sin(progress * Math.PI * 2 + index) * .18), cy = h * (.47 + Math.cos(progress * Math.PI * 2 + index) * .09);
  const orb = ctx.createRadialGradient(cx, cy, 5, cx, cy, 135); orb.addColorStop(0, `${accent}bb`); orb.addColorStop(1, `${accent}00`);
  ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(cx, cy, 135, 0, Math.PI * 2); ctx.fill();
  (scene.shapes || []).forEach((shape, i) => {
    const x = w * (.17 + ((i * .23 + progress * .12) % .68)), y = h * (.22 + (i * .31 % .53));
    ctx.save(); ctx.translate(x, y); ctx.rotate(progress * 1.8 + i); ctx.fillStyle = color(shape.color, accent); ctx.globalAlpha = .65;
    if (shape.type === 'triangle') { ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(24, 20); ctx.lineTo(-24, 20); ctx.closePath(); ctx.fill(); }
    else if (shape.type === 'square') roundRect(ctx, -19, -19, 38, 38, 8);
    else { ctx.beginPath(); ctx.arc(0, 0, 20 + i % 3 * 8, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  });
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  wrapped(scene.title, 720, '700 43px Manrope, sans-serif').slice(0, 2).forEach((line, i) => ctx.fillText(line, w / 2, h * .37 + i * 54));
  ctx.fillStyle = '#e2e0eb';
  wrapped(scene.visual, 660, '400 20px "DM Sans", sans-serif').slice(0, 2).forEach((line, i) => ctx.fillText(line, w / 2, h * .56 + i * 29));
  if (scene.caption) {
    const lines = wrapped(scene.caption, 760, '500 19px "DM Sans", sans-serif').slice(0, 2), bh = lines.length * 28 + 22;
    ctx.fillStyle = '#08090ddf'; roundRect(ctx, (w - 820) / 2, h - 85 - bh / 2, 820, bh, 11);
    ctx.fillStyle = '#fff'; lines.forEach((line, i) => ctx.fillText(line, w / 2, h - 85 - (lines.length - 1) * 14 + i * 28));
  }
  ctx.textAlign = 'left'; ctx.font = '500 13px "DM Mono", monospace'; ctx.fillStyle = '#ffffffaa';
  ctx.fillText(`${String(index + 1).padStart(2, '0')} / ${String(state.scenes.length).padStart(2, '0')}`, 28, 29);
}

function renderResults() {
  const story = $('storyTab'); story.replaceChildren();
  state.scenes.forEach((scene, i) => {
    const card = document.createElement('article'); card.className = 'scene-card';
    const top = document.createElement('div'); top.className = 'scene-card-top';
    const number = document.createElement('span'); number.textContent = `SCENE ${String(i + 1).padStart(2, '0')}`;
    const duration = document.createElement('span'); duration.textContent = `${scene.duration.toFixed(1)}s`; top.append(number, duration);
    const title = document.createElement('div'); title.className = 'scene-title'; title.textContent = scene.title;
    const caption = document.createElement('div'); caption.className = 'scene-caption'; caption.textContent = `Caption: ${scene.caption}`;
    const narration = document.createElement('div'); narration.className = 'scene-narration'; narration.textContent = `Voice-over: ${scene.narration}`;
    card.append(top, title, caption, narration); story.append(card);
  });
  const code = document.createElement('pre'); code.className = 'code-preview';
  code.textContent = `// Safe scene data. This is rendered by Motioncraft's built-in animation engine.\nconst video = ${JSON.stringify({ duration: state.duration, scenes: state.scenes }, null, 2)};`;
  $('codeTab').replaceChildren(code);
  const track = $('sceneTrack'); track.replaceChildren();
  state.scenes.forEach(scene => {
    const segment = document.createElement('div'); segment.className = 'scene-segment';
    segment.style.flex = `${Math.max(1, scene.duration)} 1 0%`; segment.textContent = scene.title; track.append(segment);
  });
  $('emptyState').classList.add('hidden'); $('play').disabled = false; $('export').disabled = false;
  $('previewState').textContent = `${state.scenes.length} SCENES · ${state.duration}s`;
  $('timeLabel').textContent = `${fmtTime(0)} / ${fmtTime(state.duration)}`;
}

async function providerPost(endpoint, apiKey, payload) {
  let response;
  try {
    response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: $('provider').value, apiKey, payload }) });
  } catch {
    throw new Error('Cannot reach the local app server. Start it with npm start, then open http://localhost:3000.');
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `Request failed (${response.status}).`);
  }
  return response;
}
async function generateVoice(apiKey) {
  const input = state.scenes.map(s => s.narration).filter(Boolean).join(' ');
  if (!input) throw new Error('The scene plan did not include narration.');
  const response = await providerPost('/api/audio/speech', apiKey, { model: $('voiceModel').value.trim() || 'tts-1', voice: $('voice').value, input, response_format: 'mp3' });
  const blob = await response.blob();
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(blob);
}

async function generate() {
  const prompt = $('prompt').value.trim(), apiKey = $('apiKey').value.trim(), model = $('model').value.trim();
  if (!prompt) return status('Enter a video idea, or click “Demo prompt” to try the local renderer without an API key.', 'error');
  if (!apiKey) return status('Enter your provider API key to generate an AI storyboard. Use “Demo prompt” to test the app without a key.', 'error');
  if (!model) return status('Enter the model ID supported by your selected provider.', 'error');
  state.duration = Number($('duration').value) || 30; savePreferences();
  $('generate').disabled = true; $('generate').querySelector('span:nth-child(2)').textContent = 'Planning scenes…';
  $('previewState').textContent = 'GENERATING'; status('Connecting to your selected AI provider…');
  try {
    const instruction = `Create a polished animated video plan for this idea: "${prompt}". Style: ${$('style').value}. Total duration exactly ${state.duration} seconds. Return ONLY valid JSON: {"title":"short title","scenes":[{"title":"short on-screen title","visual":"short visual description","narration":"one or two concise voice-over sentences","caption":"readable subtitle","duration":number,"background":"#RRGGBB","accent":"#RRGGBB","shapes":[{"type":"circle|square|triangle","color":"#RRGGBB"}]}]}. Create 3 to 6 scenes whose durations add up to ${state.duration} seconds. Use no more than 4 shapes per scene.`;
    const response = await providerPost('/api/chat/completions', apiKey, { model, temperature: 0.7, messages: [
      { role: 'system', content: 'You are an animation storyboard writer. Return only valid JSON. Never return executable code.' },
      { role: 'user', content: instruction }
    ] });
    const data = await response.json(), text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('The model returned no text. Check the model ID and chat-completions support.');
    state.scenes = normalizeScenes(parseJson(text).scenes, state.duration);
    renderResults(); draw(0);
    if ($('makeVoice').checked) {
      status('Storyboard ready. Creating voice-over…');
      try { await generateVoice(apiKey); status('Your animation, captions, and voice-over are ready.', 'success'); }
      catch (error) { status(`Storyboard ready; voice-over failed: ${error.message}. You can still export video.`, 'info'); }
    } else status('Storyboard ready. Preview or export your video.', 'success');
  } catch (error) {
    $('previewState').textContent = 'WAITING FOR IDEA'; status(error.message, 'error');
  } finally {
    $('generate').disabled = false; $('generate').querySelector('span:nth-child(2)').textContent = 'Build my video';
  }
}

function demo() {
  $('prompt').value = 'A little robot discovers a glowing garden on a distant moon and watches the sunrise.';
  $('duration').value = '15'; $('style').value = 'Cinematic'; state.duration = 15; state.audioUrl = '';
  state.scenes = normalizeScenes([
    { title: 'A Quiet Arrival', visual: 'A tiny explorer lands beneath a sky full of stars.', caption: 'Somewhere beyond the stars, a new story begins.', narration: 'Beyond the quiet stars, a little explorer found a world waiting to wake.', background: '#20223b', accent: '#a58bff', shapes: [{ type: 'circle', color: '#b7ee76' }, { type: 'triangle', color: '#fff2aa' }] },
    { title: 'The Hidden Garden', visual: 'Colorful moon flowers unfold around the curious robot.', caption: 'A garden of light blooms in the dark.', narration: 'A garden of light opened around the robot, one glowing flower at a time.', background: '#19333a', accent: '#7de7cb', shapes: [{ type: 'circle', color: '#ff9bd1' }, { type: 'square', color: '#b7ee76' }, { type: 'triangle', color: '#a58bff' }] },
    { title: 'A New Day', visual: 'The robot sings as a warm sunrise fills the horizon.', caption: 'Even the smallest voice can welcome a new day.', narration: 'And when morning arrived, the smallest voice welcomed the whole new day.', background: '#403049', accent: '#ffbd79', shapes: [{ type: 'circle', color: '#ffdb83' }, { type: 'circle', color: '#ff8cb0' }] }
  ], 15);
  savePreferences(); renderResults(); draw(0);
  status('Demo animation loaded locally—no API key or internet connection needed. Play or export it now.', 'success');
}

function play() {
  if (!state.scenes.length || state.playing) return;
  state.playing = true; $('play').disabled = true;
  const started = performance.now(); let audio = null;
  if (state.audioUrl) { audio = new Audio(state.audioUrl); audio.play().catch(() => {}); }
  const tick = now => {
    const elapsed = (now - started) / 1000;
    draw(Math.min(elapsed, state.duration - 0.01)); $('timeLabel').textContent = `${fmtTime(Math.min(elapsed, state.duration))} / ${fmtTime(state.duration)}`;
    if (elapsed < state.duration) state.frame = requestAnimationFrame(tick);
    else { state.playing = false; $('play').disabled = false; if (audio) audio.pause(); }
  };
  state.frame = requestAnimationFrame(tick);
}

async function exportVideo() {
  if (!state.scenes.length) return;
  if (!canvas.captureStream || !window.MediaRecorder) return status('Video export is not supported in this browser. Try a current desktop version of Chrome, Edge, or Firefox.', 'error');
  $('export').disabled = true; $('renderBadge').classList.remove('hidden'); $('previewState').textContent = 'RENDERING';
  status('Rendering in your browser. Keep this tab open until the download starts.');
  let stream = canvas.captureStream(30), audioContext = null, audio = null;
  if (state.audioUrl) {
    try {
      audioContext = new AudioContext(); audio = new Audio(state.audioUrl);
      const source = audioContext.createMediaElementSource(audio), destination = audioContext.createMediaStreamDestination();
      source.connect(destination); source.connect(audioContext.destination); destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      await audioContext.resume();
    } catch (error) { console.warn('Voice track unavailable', error); }
  }
  const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) { stream.getTracks().forEach(t => t.stop()); if (audioContext) audioContext.close(); $('export').disabled = false; $('renderBadge').classList.add('hidden'); return status('This browser does not support WebM export.', 'error'); }
  const chunks = [], recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.onerror = event => status(`Export failed: ${event.error?.message || 'recording error'}`, 'error');
  recorder.onstop = () => {
    const url = URL.createObjectURL(new Blob(chunks, { type: mimeType })), link = document.createElement('a');
    link.href = url; link.download = 'motioncraft-video.webm'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
    stream.getTracks().forEach(t => t.stop()); if (audioContext) audioContext.close();
    $('export').disabled = false; $('renderBadge').classList.add('hidden'); $('previewState').textContent = `${state.scenes.length} SCENES · ${state.duration}s`;
    draw(0); status('Video exported as WebM. You can play it in a browser or convert it to MP4 with a video editor.', 'success');
  };
  try {
    recorder.start(250); if (audio) { audio.currentTime = 0; await audio.play(); }
    const started = performance.now();
    const tick = now => {
      const elapsed = (now - started) / 1000; draw(Math.min(elapsed, state.duration - 0.01));
      $('timeLabel').textContent = `${fmtTime(Math.min(elapsed, state.duration))} / ${fmtTime(state.duration)}`;
      if (elapsed < state.duration) state.frame = requestAnimationFrame(tick); else setTimeout(() => recorder.state === 'recording' && recorder.stop(), 350);
    };
    state.frame = requestAnimationFrame(tick);
  } catch (error) {
    stream.getTracks().forEach(t => t.stop()); if (audioContext) audioContext.close();
    $('export').disabled = false; $('renderBadge').classList.add('hidden'); status(`Could not export: ${error.message}`, 'error');
  }
}

function savedProjects() {
  try { const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(items) ? items : []; }
  catch { return []; }
}
function renderProjectList() {
  const list = $('projectList'); list.replaceChildren();
  const projects = savedProjects();
  if (!projects.length) { const empty = document.createElement('span'); empty.className = 'track-placeholder'; empty.textContent = 'No saved projects yet'; list.append(empty); return; }
  projects.slice(0, 8).forEach(project => {
    const button = document.createElement('button'); button.className = 'project-item'; button.type = 'button';
    const title = document.createElement('strong'); title.textContent = project.title || 'Untitled';
    const duration = document.createElement('span'); duration.textContent = `${project.duration || 30}s`;
    button.append(title, duration); button.addEventListener('click', () => loadProject(project.id)); list.append(button);
  });
}
function saveProject() {
  const project = { id: (globalThis.crypto?.randomUUID?.() || String(Date.now())), title: $('prompt').value.trim().slice(0, 42) || 'Untitled project',
    prompt: $('prompt').value, duration: state.duration, style: $('style').value, provider: $('provider').value, model: $('model').value,
    makeVoice: $('makeVoice').checked, voiceModel: $('voiceModel').value, voice: $('voice').value, scenes: state.scenes, updatedAt: new Date().toISOString() };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([project, ...savedProjects()].slice(0, 8))); renderProjectList(); status('Project saved in this browser. API keys are not saved.', 'success'); }
  catch { status('Could not save project. Browser storage may be full.', 'error'); }
}
function loadProject(id) {
  const project = savedProjects().find(item => item.id === id);
  if (!project) return status('Saved project not found.', 'error');
  $('prompt').value = project.prompt || ''; $('duration').value = String(project.duration || 30); $('style').value = project.style || 'Cinematic';
  $('provider').value = PROVIDER_MODELS[project.provider] ? project.provider : 'openai'; $('model').value = project.model || PROVIDER_MODELS[$('provider').value];
  $('makeVoice').checked = project.makeVoice !== false; $('voiceModel').value = project.voiceModel || 'tts-1'; $('voice').value = project.voice || 'alloy';
  $('voiceSettings').classList.toggle('hidden', !$('makeVoice').checked); state.duration = Number(project.duration) || 30;
  if (Array.isArray(project.scenes) && project.scenes.length) { state.scenes = normalizeScenes(project.scenes, state.duration); renderResults(); draw(0); }
  savePreferences(); status('Project loaded. Enter your API key again if you want to generate or create voice-over.', 'success');
}

$('generate').addEventListener('click', generate);
$('play').addEventListener('click', play);
$('export').addEventListener('click', exportVideo);
$('demoProject').addEventListener('click', demo);
$('saveProject').addEventListener('click', saveProject);
$('loadLatest').addEventListener('click', () => { const p = savedProjects()[0]; p ? loadProject(p.id) : status('There are no saved projects yet.', 'info'); });
$('toggleKey').addEventListener('click', () => { const input = $('apiKey'); input.type = input.type === 'password' ? 'text' : 'password'; $('toggleKey').textContent = input.type === 'password' ? 'Show' : 'Hide'; });
$('provider').addEventListener('change', () => { $('model').value = PROVIDER_MODELS[$('provider').value] || ''; savePreferences(); });
$('makeVoice').addEventListener('change', () => { $('voiceSettings').classList.toggle('hidden', !$('makeVoice').checked); savePreferences(); });
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
  $('storyTab').classList.toggle('hidden', tab.dataset.tab !== 'story'); $('codeTab').classList.toggle('hidden', tab.dataset.tab !== 'code');
}));
['prompt', 'duration', 'style', 'model', 'voiceModel', 'voice'].forEach(id => $(id).addEventListener('input', savePreferences));
window.addEventListener('beforeunload', () => { if (state.audioUrl) URL.revokeObjectURL(state.audioUrl); if (state.frame) cancelAnimationFrame(state.frame); });
restorePreferences(); renderProjectList();
