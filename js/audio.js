/**
 * DWICKY GAME HUB - Universal Retro Web Audio Engine
 * Platform: game.dwicky.dev
 * Zero external audio files, 100% synthesized 8-bit retro sound effects.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RetroAudio = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var AudioEngine = {
    ctx: null,
    enabled: true,

    init: function () {
      try {
        var saved = localStorage.getItem('game_hub_sound_muted');
        this.enabled = saved !== 'true';
      } catch (e) {
        this.enabled = true;
      }

      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          try {
            this.ctx = new AC();
          } catch (e) {}
        }
      }
      return this;
    },

    resume: function () {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(function () {});
      }
    },

    toggle: function () {
      this.enabled = !this.enabled;
      try {
        localStorage.setItem('game_hub_sound_muted', this.enabled ? 'false' : 'true');
      } catch (e) {}
      return this.enabled;
    },

    isEnabled: function () {
      return this.enabled;
    },

    tone: function (freq, type, dur, vol, startDelay) {
      if (!this.enabled) return;
      this.init();
      this.resume();
      if (!this.ctx) return;

      var delay = startDelay || 0;
      var t = this.ctx.currentTime + delay;

      try {
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);

        var v = vol || 0.12;
        gain.gain.setValueAtTime(v, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + dur + 0.05);
      } catch (e) {}
    },

    play: function (soundName) {
      if (!this.enabled) return;
      this.init();
      this.resume();
      if (!this.ctx) return;

      switch (soundName) {
        case 'click':
          this.tone(600, 'sine', 0.04, 0.08);
          break;

        case 'move':
        case 'turn':
        case 'step':
          this.tone(320, 'triangle', 0.05, 0.08);
          break;

        case 'eat':
        case 'food':
          this.tone(523.25, 'sine', 0.06, 0.14);
          this.tone(783.99, 'sine', 0.08, 0.14, 0.05);
          break;

        case 'bonus':
        case 'power':
          this.tone(587.33, 'triangle', 0.07, 0.15);
          this.tone(880.00, 'sine', 0.07, 0.15, 0.06);
          this.tone(1174.66, 'sine', 0.12, 0.18, 0.12);
          break;

        case 'merge':
        case 'score':
          this.tone(440, 'triangle', 0.06, 0.12);
          this.tone(880, 'sine', 0.10, 0.15, 0.05);
          break;

        case 'flap':
        case 'jump':
          this.tone(392, 'triangle', 0.07, 0.12);
          break;

        case 'line':
          this.tone(523.25, 'square', 0.08, 0.10);
          this.tone(659.25, 'square', 0.08, 0.10, 0.07);
          this.tone(783.99, 'square', 0.12, 0.12, 0.14);
          break;

        case 'tetris':
          this.tone(523.25, 'triangle', 0.08, 0.12);
          this.tone(659.25, 'sine', 0.08, 0.12, 0.07);
          this.tone(783.99, 'sine', 0.08, 0.12, 0.14);
          this.tone(1046.50, 'sine', 0.20, 0.16, 0.21);
          break;

        case 'match':
          this.tone(659.25, 'sine', 0.08, 0.14);
          this.tone(987.77, 'sine', 0.14, 0.16, 0.07);
          break;

        case 'wrong':
        case 'hit':
          this.tone(190, 'sawtooth', 0.14, 0.16);
          break;

        case 'gameover':
        case 'die':
          this.tone(330, 'sawtooth', 0.12, 0.15);
          this.tone(260, 'sawtooth', 0.14, 0.15, 0.10);
          this.tone(196, 'sawtooth', 0.16, 0.16, 0.22);
          this.tone(130, 'sawtooth', 0.25, 0.18, 0.36);
          break;

        case 'win':
          this.tone(523.25, 'triangle', 0.10, 0.14);
          this.tone(659.25, 'triangle', 0.10, 0.14, 0.09);
          this.tone(783.99, 'sine', 0.10, 0.14, 0.18);
          this.tone(1046.50, 'sine', 0.28, 0.18, 0.27);
          break;
      }
    }
  };

  AudioEngine.init();
  return AudioEngine;
}));
