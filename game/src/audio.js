// HELIOSTAT — sound. Everything is synthesized with WebAudio: engine hum,
// gunshots, sirens, UI blips and three procedural radio stations. No audio
// files are shipped; the radio is a tiny step sequencer over oscillators.

import { RADIOS } from './config.js';

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;
  let radioIndex = 0;
  let radioTimer = null;
  let radioStep = 0;
  let radioNextTime = 0;

  const ensure = () => {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: sawtooth through a low-pass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: sine whose frequency wails between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 750;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      return true;
    } catch (_e) {
      ctx = null;
      return false;
    }
  };

  const blip = (freq, dur, type = 'sine', vol = 0.25, when = 0) => {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  const noiseBurst = (dur, vol, filterFreq) => {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  };

  const scheduleRadioStep = () => {
    if (!ctx || muted) return;
    const st = RADIOS[radioIndex];
    const stepDur = 60 / st.bpm / 2; // eighth notes
    while (radioNextTime < ctx.currentTime + 0.25) {
      const i = radioStep % 8;
      const t = radioNextTime;
      // Bass on every step, lead on even steps.
      const bass = ctx.createOscillator();
      bass.type = st.wave;
      bass.frequency.value = midiToFreq(st.bass[i]);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.16, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.9);
      bass.connect(bg);
      bg.connect(master);
      bass.start(t);
      bass.stop(t + stepDur);
      if (i % 2 === 0) {
        const lead = ctx.createOscillator();
        lead.type = 'triangle';
        lead.frequency.value = midiToFreq(st.lead[i]);
        const lg = ctx.createGain();
        lg.gain.setValueAtTime(0.09, t);
        lg.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.8);
        lead.connect(lg);
        lg.connect(master);
        lead.start(t);
        lead.stop(t + stepDur * 2);
      }
      radioStep++;
      radioNextTime += stepDur;
    }
  };

  return {
    unlock() {
      ensure();
    },
    get ready() {
      return ctx !== null;
    },
    setEngine(speed01, on) {
      if (!ctx || muted) return;
      const target = on ? 0.05 + speed01 * 0.11 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 165, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(380 + speed01 * 1400, ctx.currentTime, 0.1);
    },
    setSiren(on, closeness01) {
      if (!ctx) return;
      const v = on && !muted ? 0.028 + closeness01 * 0.05 : 0;
      sirenGain.gain.setTargetAtTime(v, ctx.currentTime, 0.2);
    },
    gunshot() {
      noiseBurst(0.16, 0.5, 2400);
      blip(120, 0.12, 'square', 0.2);
    },
    enemyShot() {
      noiseBurst(0.12, 0.22, 1800);
    },
    crash(strength01) {
      noiseBurst(0.3, 0.2 + strength01 * 0.4, 900);
      blip(70, 0.25, 'sawtooth', 0.25);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.25);
      blip(990, 0.14, 'sine', 0.25, 0.08);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.22, 'triangle', 0.28, i * 0.11));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.2, i * 0.14));
    },
    uiClick() {
      blip(880, 0.05, 'square', 0.12);
    },
    hurt() {
      blip(140, 0.2, 'sawtooth', 0.3);
    },
    busted() {
      [660, 660, 520, 520].forEach((f, i) => blip(f, 0.16, 'square', 0.22, i * 0.16));
    },
    get radioName() {
      return RADIOS[radioIndex].name;
    },
    get radioIndex() {
      return radioIndex;
    },
    setRadio(i) {
      radioIndex = ((i % RADIOS.length) + RADIOS.length) % RADIOS.length;
      radioStep = 0;
      if (ctx) radioNextTime = ctx.currentTime + 0.05;
      this.uiClick();
    },
    startRadio() {
      if (!ensure()) return;
      if (radioTimer) return;
      radioNextTime = ctx.currentTime + 0.05;
      radioStep = 0;
      radioTimer = setInterval(scheduleRadioStep, 90);
    },
    stopRadio() {
      if (radioTimer) {
        clearInterval(radioTimer);
        radioTimer = null;
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get isMuted() {
      return muted;
    },
  };
}
