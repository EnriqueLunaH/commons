import { generateThought, speakThought, voiceConfigured } from './inner-voice.js';

export function reflectionMarkup(copy) {
  return `<section class="reflection" aria-labelledby="reflection-title">
    <h3 id="reflection-title">${copy.title}</h3>
    <p class="job-pay-note">${copy.description}</p>
    <label for="reflection-entry">${copy.entry}</label>
    <textarea id="reflection-entry" rows="2" maxlength="240" ${voiceConfigured ? '' : ' disabled'}></textarea>
    <div class="button-row">
      <button type="button" class="primary" id="reflect">${copy.reflect}</button>
      <button type="button" class="secondary" id="record-thought" aria-pressed="false" hidden>${copy.record}</button>
    </div>
    <p class="job-pay-note" id="reflection-status" role="status"></p>
    <p class="reflection-result" aria-live="polite" hidden></p>
    <audio controls preload="none" aria-label="${copy.title}" hidden></audio>
  </section>`;
}

export function bindReflection(root, { copy, context, fallback }) {
  const listen = root.querySelector('#reflect');
  const mic = root.querySelector('#record-thought');
  const status = root.querySelector('#reflection-status');
  const entry = root.querySelector('#reflection-entry');
  const result = root.querySelector('.reflection-result');
  const audio = root.querySelector('audio');
  const mimeType = ['audio/webm;codecs=opus', 'audio/mp4'].find((type) => window.MediaRecorder?.isTypeSupported(type));
  let isOpen = true;
  let recording;
  let clip;
  let audioUrl;
  let timer;
  mic.hidden = !(voiceConfigured && mimeType && navigator.mediaDevices?.getUserMedia);
  if (!voiceConfigured) status.textContent = copy.unconfigured;

  function clearAudio() {
    audio.pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audio.removeAttribute('src');
    audio.hidden = true;
    audioUrl = null;
  }

  function stopRecording() {
    clearTimeout(timer);
    if (!recording) return;
    if (recording.state === 'recording') recording.stop();
    recording.stream.getTracks().forEach((track) => track.stop());
    recording = null;
  }

  mic.addEventListener('click', async () => {
    if (recording) {
      stopRecording();
      return;
    }
    mic.disabled = listen.disabled = true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isOpen) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      clearAudio();
      clip = null;
      recording = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      recording.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
      recording.addEventListener('stop', () => {
        if (!isOpen) return;
        clip = chunks.length ? new Blob(chunks, { type: mimeType }) : null;
        mic.disabled = listen.disabled = false;
        mic.setAttribute('aria-pressed', 'false');
        mic.textContent = copy.record;
        status.textContent = clip ? copy.recorded : copy.micError;
      }, { once: true });
      recording.addEventListener('error', () => {
        stopRecording();
        if (!isOpen) return;
        status.textContent = copy.micError;
        mic.disabled = listen.disabled = false;
        mic.setAttribute('aria-pressed', 'false');
        mic.textContent = copy.record;
      }, { once: true });
      recording.start();
      timer = setTimeout(stopRecording, 12_000);
      mic.disabled = false;
      mic.setAttribute('aria-pressed', 'true');
      mic.textContent = copy.stop;
      status.textContent = copy.recording;
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      recording = null;
      if (!isOpen) return;
      status.textContent = copy.micError;
      mic.disabled = listen.disabled = false;
    }
  });

  listen.addEventListener('click', async () => {
    clearAudio();
    if (!voiceConfigured) {
      result.textContent = fallback();
      result.hidden = false;
      return;
    }
    const state = context();
    const text = entry.value.trim();
    const recorded = clip;
    listen.disabled = mic.disabled = entry.disabled = true;
    status.textContent = copy.thinking;
    try {
      const thought = await generateThought(state, text, recorded);
      if (!isOpen) return;
      clip = null;
      result.textContent = thought;
      result.hidden = false;
      status.textContent = copy.preparing;
      const voice = await speakThought(thought, state);
      if (!isOpen) return;
      audioUrl = URL.createObjectURL(voice);
      audio.src = audioUrl;
      audio.hidden = false;
      status.textContent = '';
      audio.play().catch(() => { /* Audio controls remain available. */ });
    } catch (error) {
      if (!isOpen) return;
      if (status.textContent === copy.thinking) {
        result.textContent = fallback();
        result.hidden = false;
      }
      status.textContent = copy.unavailable;
      if (import.meta.env.DEV) console.warn('Firebase inner voice:', error.code ?? error.name);
    } finally {
      if (isOpen) listen.disabled = mic.disabled = entry.disabled = false;
    }
  });

  return () => {
    isOpen = false;
    stopRecording();
    clearAudio();
    clip = null;
  };
}
