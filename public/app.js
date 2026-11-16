const $ = id => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
let scenes = [];
let totalDuration = 30;
let animationId = 0;
let audioUrl = '';
let recorder = null;
let renderChunks = [];
let isPlaying = false;

function setStatus(message, type = 'info') {
  const el = $('status');
  el.textContent = message;
  el.className = `status visible ${type}`;
}
function clearStatus() { $('status').className = 'status'; }
function clamp(n, low, high) { return Math.max(low, Math.min(high, n)); }
function hexColor(value, fallback) { return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback; }
function roundRect(context, x, y, w, h, r) {
  context.beginPath(); context.roundRect(x, y, w, h, r); context.fill();
}
function wrapText(text, maxWidth, font) {
  ctx.font = font;
  const words = String(text || '').split(/\s+/); const lines = []; let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
function sceneAt(time) {
  let elapsed = 0;
  for (let i = 0; i < scenes.length; i++) {
    const duration = Number(scenes[i].duration) || totalDuration / scenes.length;
    if (time < elapsed + duration || i === scenes.length - 1) return { scene: scenes[i], index: i, local: clamp((time - elapsed) / duration, 0, 1), elapsed, duration };
    elapsed += duration;
  }
  return { scene: scenes[scenes.length - 1], index: scenes.length - 1, local: 1, elapsed: totalDuration, duration: 1 };
}
function drawFrame(time) {
  if (!scenes.length) return;
  const { scene, index, local } = sceneAt(time);
  const w = canvas.width, h = canvas.height;
  const bg = hexColor(scene.background, ['#20223b','#263340','#332849','#202d36'][index % 4]);
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, bg); gradient.addColorStop(1, '#101116');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  // Subtle drifting stars and atmospheric circles create a safe, deterministic animation.
  for (let i = 0; i < 44; i++) {
    const x = ((i * 197 + time * (8 + i % 9)) % w);
    const y = (i * 83) % h;
    ctx.globalAlpha = .15 + (i % 5) * .07;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, i % 7 === 0 ? 2 : 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const progress = local;
  const cx = w * (.5 + Math.sin(progress * Math.PI * 2 + index) * .18);
  const cy = h * (.47 + Math.cos(progress * Math.PI * 2 + index) * .09);
  const accent = hexColor(scene.accent, '#a58bff');
  const orb = ctx.createRadialGradient(cx, cy, 5, cx, cy, 115);
  orb.addColorStop(0, `${accent}bb`); orb.addColorStop(1, `${accent}00`);
  ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(cx, cy, 115, 0, Math.PI * 2); ctx.fill();
  const shapes = Array.isArray(scene.shapes) ? scene.shapes.slice(0, 8) : [];
  shapes.forEach((shape, i) => {
    const shapeX = w * (.2 + ((i * .23 + progress * .12) % .65));
    const shapeY = h * (.24 + ((i * .31) % .5));
    ctx.save(); ctx.translate(shapeX, shapeY); ctx.rotate(progress * 1.8 + i);
    ctx.fillStyle = hexColor(shape.color, accent); ctx.globalAlpha = .65;
    if (shape.type === 'circle') { ctx.beginPath(); ctx.arc(0, 0, 18 + (i % 3) * 8, 0, Math.PI * 2); ctx.fill(); }
    else if (shape.type === 'triangle') { ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(24, 20); ctx.lineTo(-24, 20); ctx.closePath(); ctx.fill(); }
    else roundRect(ctx, -19, -19, 38, 38, 8);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
  const title = String(scene.title || `Scene ${index + 1}`).slice(0, 100);
  const titleLines = wrapText(title, 720, '700 43px Manrope, sans-serif');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  titleLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, w / 2, h * .39 + i * 54));
  const description = String(scene.visual || '').slice(0, 180);
  const descLines = wrapText(description, 660, '400 20px "DM Sans", sans-serif');
  ctx.fillStyle = '#e2e0eb';
  descLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, w / 2, h * .57 + i * 29));
  const caption = String(scene.caption || '').slice(0, 180);
  if (caption) {
    ctx.font = '500 19px "DM Sans", sans-serif'; const capLines = wrapText(caption, 760, '500 19px "DM Sans", sans-serif').slice(0, 2);
    const boxH = capLines.length * 28 + 22; ctx.fillStyle = '#08090ddf'; roundRect(ctx, (w - 820) / 2, h - 85 - boxH / 2, 820, boxH, 11);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; capLines.forEach((line, i) => ctx.fillText(line, w / 2, h - 85 - (capLines.length - 1) * 14 + i * 28));
  }
  ctx.textAlign = 'left'; ctx.font = '500 13px "DM Mono", monospace'; ctx.fillStyle = '#ffffffaa'; ctx.fillText(`${String(index + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`, 28, 29);
}
function showSceneResults() {
  $('storyTab').innerHTML = scenes.map((scene, i) => `<article class="scene-card"><div class="scene-card-top"><span>SCENE ${String(i + 1).padStart(2, '0')}</span><span>${Number(scene.duration).toFixed(1)}s</span></div><div class="scene-title"></div><div class="scene-caption"></div><div class="scene-narration"></div></article>`).join('');
  [...$('storyTab').querySelectorAll('.scene-card')].forEach((card, i) => {
    card.querySelector('.scene-title').textContent = scenes[i].title || `Scene ${i + 1}`;
    card.querySelector('.scene-caption').textContent = `Caption: ${scenes[i].caption || ''}`;
    card.querySelector('.scene-narration').textContent = `Voice-over: ${scenes[i].narration || ''}`;
  });
  $('codeTab').innerHTML = '';
  const pre = document.createElement('pre'); pre.className = 'code-preview';
  pre.textContent = `// Safe scene blueprint — rendered by the built-in canvas engine.\n// Generated content is data, never executed as JavaScript.\nconst video = { duration: ${totalDuration}, scenes: ${JSON.stringify(scenes, null, 2)} };`;
  $('codeTab').appendChild(pre);
  $('sceneTrack').innerHTML = '';
  scenes.forEach(scene => {
    const segment = document.createElement('div'); segment.className = 'scene-segment';
    segment.style.flex = `${Math.max(1, Number(scene.duration))} 1 0%`;
    segment.textContent = scene.title || 'Scene'; $('sceneTrack').appendChild(segment);
  });
  $('emptyState').classList.add('hidden');
  $('previewState').textContent = `${scenes.length} SCENES · ${totalDuration}s`;
  $('timeLabel').textContent = `00:00 / 00:${String(totalDuration).padStart(2, '0')}`;
  $('play').disabled = false; $('export').disabled = false;
}
function parseModelJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The model did not return a valid scene plan. Try another model or prompt.');
  return JSON.parse(cleaned.slice(start, end + 1));
}
async function providerPost(path, apiKey, payload) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: $('provider').value, apiKey, payload }) });
  if (!response.ok) { let data; try { data = await response.json(); } catch { data = {}; } throw new Error(data.error || `Request failed (${response.status}).`); }
  return response;
}
async function generate() {
  const prompt = $('prompt').value.trim(); const apiKey = $('apiKey').value.trim(); const model = $('model').value.trim();
  if (!prompt) return setStatus('Describe the video you want to make first.', 'error');
  if (!apiKey) return setStatus('Enter an API key to connect to your model provider.', 'error');
  if (!model) return setStatus('Enter a model ID supported by your provider.', 'error');
  totalDuration = Number($('duration').value);
  $('generate').disabled = true; $('generate').querySelector('span:nth-child(2)').textContent = 'Planning scenes…';
  $('previewState').textContent = 'GENERATING'; setStatus('Asking your model to plan scenes, narration, and captions…');
  try {
    const instruction = `Create a short animated video plan from this idea: "${prompt}". Visual style: ${$('style').value}. Total duration: exactly ${totalDuration} seconds. Return ONLY valid JSON, no markdown, in this schema: {"title":"short title","scenes":[{"title":"short on-screen title","visual":"one concise visual description","narration":"spoken voice-over, 1-2 short sentences","caption":"short readable caption matching narration","duration":number,"background":"#RRGGBB","accent":"#RRGGBB","shapes":[{"type":"circle|square|triangle","color":"#RRGGBB"}]}]}. Create 3 to 6 scenes, duration values must add up to ${totalDuration}, with a beginning, middle, and ending. Use polished, specific narration and captions. Do not include code or instructions to execute code. Limit each scene to at most 4 shapes.`;
    const response = await providerPost('/api/chat/completions', apiKey, { model, temperature: 0.7, messages: [{ role: 'system', content: 'You are a creative animation director. Return only the exact JSON requested by the user.' }, { role: 'user', content: instruction }] });
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('The selected model returned no text. Check that the model supports chat completions.');
    const plan = parseModelJson(text);
    if (!Array.isArray(plan.scenes) || !plan.scenes.length) throw new Error('The model response did not contain scenes. Try generating again.');
    scenes = plan.scenes.slice(0, 8).map((scene, i) => ({
      title: String(scene.title || `Scene ${i + 1}`).slice(0, 100), visual: String(scene.visual || '').slice(0, 250),
      narration: String(scene.narration || '').slice(0, 1200), caption: String(scene.caption || scene.narration || '').slice(0, 220),
      duration: Math.max(1, Number(scene.duration) || totalDuration / plan.scenes.length),
      background: hexColor(scene.background, '#20223b'), accent: hexColor(scene.accent, '#a58bff'),
      shapes: Array.isArray(scene.shapes) ? scene.shapes.slice(0, 4).map(s => ({ type: ['circle','square','triangle'].includes(s.type) ? s.type : 'circle', color: hexColor(s.color, '#a58bff') })) : []
    }));
    const scale = totalDuration / scenes.reduce((sum, scene) => sum + scene.duration, 0);
    scenes.forEach(scene => scene.duration *= scale);
    showSceneResults(); drawFrame(0); $('previewState').textContent = `${scenes.length} SCENES · ${totalDuration}s`;
    if ($('makeVoice').checked) {
      setStatus('Scene plan ready. Generating voice-over…');
      try { await generateVoiceover(apiKey); setStatus('Your video plan and voice-over are ready. Play the preview or export your video.', 'success'); }
      catch (error) { setStatus(`Scenes and captions are ready, but voice-over could not be generated: ${error.message} You can still export the video without narration.`, 'info'); }
    } else setStatus('Your scenes and captions are ready. Play the preview or export your video.', 'success');
  } catch (error) { $('previewState').textContent = 'WAITING FOR IDEA'; setStatus(error.message, 'error'); }
  finally { $('generate').disabled = false; $('generate').querySelector('span:nth-child(2)').textContent = 'Build my video'; }
}
async function generateVoiceover(apiKey) {
  const narration = scenes.map(s => s.narration).filter(Boolean).join(' ');
  if (!narration) throw new Error('The scene plan did not include narration.');
  const response = await providerPost('/api/audio/speech', apiKey, { model: $('voiceModel').value.trim() || 'tts-1', voice: $('voice').value, input: narration, response_format: 'mp3' });
  const blob = await response.blob();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(blob);
}
function audioElement() { const audio = new Audio(audioUrl); audio.preload = 'auto'; return audio; }
function playPreview() {
  if (!scenes.length || isPlaying) return;
  isPlaying = true; $('play').disabled = true;
  const start = performance.now(); let audio = null;
  if (audioUrl) { audio = audioElement(); audio.play().catch(() => {}); }
  const tick = now => {
    const elapsed = (now - start) / 1000;
    if (elapsed >= totalDuration) { isPlaying = false; $('play').disabled = false; drawFrame(totalDuration - .01); return; }
    drawFrame(elapsed); $('timeLabel').textContent = `00:${String(Math.floor(elapsed)).padStart(2, '0')} / 00:${String(totalDuration).padStart(2, '0')}`;
    animationId = requestAnimationFrame(tick);
  };
  animationId = requestAnimationFrame(tick);
}
async function exportVideo() {
  if (!scenes.length) return;
  if (!canvas.captureStream || !window.MediaRecorder) return setStatus('Video export is not supported by this browser. Try a current version of Chrome, Edge, or Firefox.', 'error');
  $('export').disabled = true; $('renderBadge').classList.remove('hidden'); $('previewState').textContent = 'RENDERING';
  setStatus('Rendering your animation in this browser. Keep this tab open until the download begins.');
  let stream = canvas.captureStream(30); let audioContext; let audio; let source;
  if (audioUrl) {
    try {
      audioContext = new AudioContext(); audio = audioElement();
      source = audioContext.createMediaElementSource(audio);
      const destination = audioContext.createMediaStreamDestination(); source.connect(destination); source.connect(audioContext.destination);
      destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      await audioContext.resume();
    } catch (error) { console.warn('Audio track could not be prepared', error); }
  }
  const mimeType = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) { $('export').disabled = false; $('renderBadge').classList.add('hidden'); return setStatus('This browser does not support WebM video export.', 'error'); }
  renderChunks = [];
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
    recorder.ondataavailable = event => { if (event.data.size) renderChunks.push(event.data); };
    recorder.onerror = event => setStatus(`Video export failed: ${event.error?.message || 'recording error'}`, 'error');
    recorder.onstop = () => {
      const blob = new Blob(renderChunks, { type: mimeType }); const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'motioncraft-video.webm'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      stream.getTracks().forEach(track => track.stop()); if (audioContext) audioContext.close();
      $('export').disabled = false; $('renderBadge').classList.add('hidden'); $('previewState').textContent = `${scenes.length} SCENES · ${totalDuration}s`;
      setStatus('Video exported as WebM. You can play it or convert it to MP4 with a video editor.', 'success'); drawFrame(0);
    };
    recorder.start(250);
    if (audio) { audio.currentTime = 0; await audio.play(); }
    const start = performance.now();
    const renderTick = now => {
      const elapsed = (now - start) / 1000;
      drawFrame(Math.min(elapsed, totalDuration - .01));
      $('timeLabel').textContent = `00:${String(Math.floor(Math.min(elapsed, totalDuration))).padStart(2, '0')} / 00:${String(totalDuration).padStart(2, '0')}`;
      if (elapsed < totalDuration) animationId = requestAnimationFrame(renderTick); else setTimeout(() => recorder?.state === 'recording' && recorder.stop(), 350);
    };
    animationId = requestAnimationFrame(renderTick);
  } catch (error) {
    stream.getTracks().forEach(track => track.stop()); if (audioContext) audioContext.close();
    $('export').disabled = false; $('renderBadge').classList.add('hidden');
    setStatus(`Could not export video: ${error.message}`, 'error');
  }
}

$('generate').addEventListener('click', generate);
$('play').addEventListener('click', playPreview);
$('export').addEventListener('click', exportVideo);
$('toggleKey').addEventListener('click', () => { const input = $('apiKey'); input.type = input.type === 'password' ? 'text' : 'password'; $('toggleKey').textContent = input.type === 'password' ? 'Show' : 'Hide'; });
$('makeVoice').addEventListener('change', () => $('voiceSettings').classList.toggle('hidden', !$('makeVoice').checked));
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
  $('storyTab').classList.toggle('hidden', tab.dataset.tab !== 'story'); $('codeTab').classList.toggle('hidden', tab.dataset.tab !== 'code');
}));
$('provider').addEventListener('change', () => {
  const defaults = { openai: 'gpt-4o-mini', openrouter: 'openai/gpt-4o-mini', groq: 'llama-3.3-70b-versatile', together: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', mistral: 'mistral-small-latest', deepseek: 'deepseek-chat', fireworks: 'accounts/fireworks/models/llama-v3p1-8b-instruct' };
  $('model').value = defaults[$('provider').value];
});
window.addEventListener('beforeunload', () => { if (audioUrl) URL.revokeObjectURL(audioUrl); cancelAnimationFrame(animationId); });
