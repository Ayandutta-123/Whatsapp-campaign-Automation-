/** Soft UI notification sounds via Web Audio (no asset files). */
let audioCtx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function tone(freq, durationMs, type = 'sine', gain = 0.04) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(ctx.destination);
  const now = ctx.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

export function playNotifySound(kind = 'info') {
  try {
    if (kind === 'success') {
      tone(880, 90);
      setTimeout(() => tone(1175, 120), 90);
    } else if (kind === 'error') {
      tone(320, 160, 'square', 0.035);
      setTimeout(() => tone(220, 200, 'square', 0.03), 140);
    } else if (kind === 'warning') {
      tone(520, 100);
      setTimeout(() => tone(520, 100), 140);
    } else {
      tone(660, 80);
    }
  } catch {
    /* ignore autoplay blocks */
  }
}
