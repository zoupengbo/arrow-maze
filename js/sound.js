"use strict";

class SoundManager {
  constructor() {
    this.enabled = true;
    this.audioContext = null;
    this.init();
  }

  init() {
    try {
      const AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (AudioCtor) {
        this.audioContext = new AudioCtor();
      }
    } catch (error) {
      this.audioContext = null;
    }

    if (wx.setInnerAudioOption) {
      try {
        wx.setInnerAudioOption({
          mixWithOther: true,
          obeyMuteSwitch: false
        });
      } catch (error) {
      }
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  unlock() {
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  play(type) {
    if (!this.enabled) {
      return;
    }

    const presets = {
      tap: { freq: 620, duration: 0.05, gain: 0.025, endFreq: 690, wave: "triangle" },
      crash: { freq: 220, duration: 0.16, gain: 0.04, endFreq: 150, wave: "sawtooth" },
      clear: { freq: 520, duration: 0.18, gain: 0.035, endFreq: 790, wave: "triangle" },
      revive: { freq: 420, duration: 0.22, gain: 0.035, endFreq: 660, wave: "sine" },
      button: { freq: 480, duration: 0.08, gain: 0.025, endFreq: 540, wave: "square" }
    };
    const preset = presets[type];
    if (!preset) {
      return;
    }

    if (!this.audioContext) {
      if (type === "crash" && wx.vibrateShort) {
        wx.vibrateShort({ type: "medium" });
      }
      return;
    }

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = preset.wave;
    osc.frequency.setValueAtTime(preset.freq, now);
    osc.frequency.exponentialRampToValueAtTime(preset.endFreq, now + preset.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(preset.gain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.start(now);
    osc.stop(now + preset.duration + 0.02);
  }
}

module.exports = {
  SoundManager
};
