"use strict";

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function toBase64(uint8Array) {
  if (typeof wx !== "undefined" && wx.arrayBufferToBase64) {
    return wx.arrayBufferToBase64(uint8Array.buffer);
  }

  let binary = "";
  for (let i = 0; i < uint8Array.length; i += 1) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  return "";
}

function createToneDataUri(options) {
  const sampleRate = 22050;
  const duration = options.duration;
  const sampleCount = Math.max(1, Math.floor(sampleRate * duration));
  const attack = Math.max(1, Math.floor(sampleCount * 0.08));
  const release = Math.max(1, Math.floor(sampleCount * 0.24));
  const pcm = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / Math.max(1, sampleCount - 1);
    const freq = options.freq + (options.endFreq - options.freq) * t;
    const phase = 2 * Math.PI * freq * (i / sampleRate);
    let wave = 0;
    if (options.wave === "square") {
      wave = Math.sin(phase) >= 0 ? 1 : -1;
    } else if (options.wave === "triangle") {
      wave = 2 * Math.asin(Math.sin(phase)) / Math.PI;
    } else if (options.wave === "sawtooth") {
      wave = 2 * ((freq * i / sampleRate) % 1) - 1;
    } else {
      wave = Math.sin(phase);
    }

    let envelope = 1;
    if (i < attack) {
      envelope = i / attack;
    } else if (i > sampleCount - release) {
      envelope = Math.max(0, (sampleCount - i) / release);
    }

    const sample = Math.max(-1, Math.min(1, wave * envelope * options.gain * 1.8));
    pcm[i] = sample * 32767;
  }

  const dataSize = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < pcm.length; i += 1) {
    view.setInt16(44 + i * 2, pcm[i], true);
  }

  return `data:audio/wav;base64,${toBase64(new Uint8Array(buffer))}`;
}

class SoundManager {
  constructor() {
    this.enabled = true;
    this.players = [];
    this.buffers = {};
    this.init();
  }

  init() {
    if (wx.setInnerAudioOption) {
      try {
        wx.setInnerAudioOption({
          mixWithOther: true,
          obeyMuteSwitch: false
        });
      } catch (error) {
      }
    }

    const presets = {
      tap: { freq: 620, duration: 0.06, gain: 0.2, endFreq: 720, wave: "triangle" },
      crash: { freq: 220, duration: 0.18, gain: 0.28, endFreq: 140, wave: "sawtooth" },
      clear: { freq: 520, duration: 0.2, gain: 0.24, endFreq: 830, wave: "triangle" },
      revive: { freq: 420, duration: 0.24, gain: 0.24, endFreq: 680, wave: "sine" },
      button: { freq: 480, duration: 0.09, gain: 0.18, endFreq: 560, wave: "square" }
    };

    Object.keys(presets).forEach((key) => {
      this.buffers[key] = createToneDataUri(presets[key]);
    });
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  unlock() {
    if (!this.enabled || !wx.createInnerAudioContext || this.players.length) {
      return;
    }
    const player = this.createPlayer();
    if (!player) {
      return;
    }
    player.src = this.buffers.button;
    try {
      player.play();
      player.stop();
    } catch (error) {
    }
  }

  createPlayer() {
    if (!wx.createInnerAudioContext) {
      return null;
    }
    const player = wx.createInnerAudioContext();
    player.obeyMuteSwitch = false;
    player.autoplay = false;
    player.volume = 1;
    this.players.push(player);
    player.onEnded(() => {
      try {
        player.stop();
      } catch (error) {
      }
    });
    return player;
  }

  play(type) {
    if (!this.enabled) {
      return;
    }
    const src = this.buffers[type];
    if (!src) {
      return;
    }

    if (!wx.createInnerAudioContext) {
      if (type === "crash" && wx.vibrateShort) {
        try {
          wx.vibrateShort({ type: "medium" });
        } catch (error) {
        }
      }
      return;
    }

    const player = this.createPlayer();
    if (!player) {
      return;
    }

    try {
      player.src = src;
      player.play();
    } catch (error) {
    }
  }
}

module.exports = {
  SoundManager
};
