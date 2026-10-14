/**
 * Flappy Bird Arcade (60fps Physics & Edge-to-Edge Fullscreen Responsive)
 * game.dwicky.dev
 */

(function () {
  'use strict';

  // 8-Bit Retro Sound Synthesizer via Web Audio API
  var Sound = {
    ctx: null,
    enabled: true,
    init: function () {
      if (this.ctx) return;
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
      try {
        var savedMute = localStorage.getItem("game_hub_sound_muted");
        if (savedMute === "true") this.enabled = false;
      } catch (e) {}
    },
    resume: function () {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },
    tone: function (freq, type, dur, vol) {
      if (!this.enabled || !this.ctx) return;
      try {
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol || 0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
      } catch (e) {}
    },
    flap: function () {
      this.init(); this.resume();
      this.tone(440, 'triangle', 0.08, 0.12);
    },
    score: function () {
      this.init(); this.resume();
      this.tone(880, 'sine', 0.15, 0.15);
    },
    hit: function () {
      this.init(); this.resume();
      this.tone(180, 'sawtooth', 0.2, 0.2);
    },
    die: function () {
      this.init(); this.resume();
      var self = this;
      [300, 240, 180].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 'sawtooth', 0.15, 0.15); }, i * 90);
      });
    },
    star: function () {
      this.init(); this.resume();
      var self = this;
      [587.33, 739.99, 880, 1174.66].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 'sine', 0.12, 0.18); }, i * 50);
      });
    },
    themeChange: function () {
      this.init(); this.resume();
      var self = this;
      [440, 554.37, 659.25, 880].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 'triangle', 0.16, 0.22); }, i * 70);
      });
    }
  };

  var FlappyApp = {
    canvas: null,
    ctx: null,
    canvasWrap: null,
    width: 288,
    height: 512,

    // Game States: 0 = IDLE, 1 = PLAYING, 2 = GAMEOVER
    state: 0,
    score: 0,
    highScore: 0,
    groundY: 450,
    groundOffset: 0,

    // Bird physics calibrated to classic arcade standards (60Hz)
    bird: {
      x: 60,
      y: 220,
      radius: 13,
      vy: 0,
      gravity: 0.28,
      jump: -5.4,
      maxFall: 8.0,
      rotation: 0,
      wingTimer: 0
    },

    // Pipes calibrated: pipeSpeed 2.0 px/frame, spacing ~190px (95 ticks)
    pipes: [],
    pipeSpawnTimer: 0,
    pipeGap: 118,
    pipeSpeed: 2.0,
    pipeSpawnInterval: 95,

    // Fixed 60Hz Timestep Accumulator (Refresh-Rate Independent)
    lastTime: 0,
    accumulator: 0,

    // Collectible Stars & Dynamic Themes
    starsCollected: 0,
    currentTheme: 0,
    themeBanner: null,
    floatingTexts: [],
    particles: [],
    starAnimTimer: 0,
    snowflakes: [],
    nightStars: [],
    THEMES: [
      { id: 'day', name: 'Siang Cerah', icon: '☀️', bannerColor: '#0284c7' },
      { id: 'sunset', name: 'Senja Keemasan', icon: '🌇', bannerColor: '#c2410c' },
      { id: 'night', name: 'Malam Berbintang', icon: '🌙', bannerColor: '#312e81' },
      { id: 'winter', name: 'Musim Salju', icon: '❄️', bannerColor: '#0369a1' },
      { id: 'cyber', name: 'Cyber Neon', icon: '⚡', bannerColor: '#9333ea' }
    ],

    // Shared Profile
    username: 'Pemain Baru',
    avatar: '',

    init: function () {
      this.loadProfile();
      this.cacheDom();
      this.bindEvents();
      this.resizeCanvas();
      this.reset();
      this.loop();

      var self = this;
      requestAnimationFrame(function () {
        self.resizeCanvas();
      });
      setTimeout(function () {
        self.resizeCanvas();
      }, 100);
    },

    loadProfile: function () {
      try {
        var u = localStorage.getItem('user_profile_name') || localStorage.getItem('2048_username');
        if (u) this.username = u;
        var av = localStorage.getItem('user_profile_avatar') || localStorage.getItem('2048_avatar');
        if (av) this.avatar = av;
        var hs = localStorage.getItem('flappy_high_score');
        if (hs) this.highScore = parseInt(hs, 10) || 0;
      } catch (e) {}
    },

    saveProfile: function () {
      try {
        localStorage.setItem('user_profile_name', this.username);
        localStorage.setItem('user_profile_avatar', this.avatar);
        localStorage.setItem('flappy_high_score', this.highScore);
      } catch (e) {}
    },

    cacheDom: function () {
      this.canvasWrap = document.querySelector('.flappy-canvas-wrap');
      this.canvas = document.getElementById('flappy-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.canvas.width = this.width;
      this.canvas.height = this.height;

      this.hudScoreEl = document.getElementById('hud-score');
      this.tapPromptEl = document.getElementById('tap-prompt');
      this.overlayEl = document.getElementById('gameover-overlay');
      this.finalScoreEl = document.getElementById('final-score');
      this.finalBestEl = document.getElementById('final-best');
      this.medalIconEl = document.getElementById('medal-icon');
      this.finalStarsEl = document.getElementById('final-stars');

      this.hudThemePill = document.getElementById('hud-theme-pill');
      this.hudStarsPill = document.getElementById('hud-stars-pill');

      this.initThemeEffects();

      // Profile Header
      this.userNameEl = document.getElementById('username-display');
      this.userAvatarImg = document.getElementById('user-avatar-img');
      this.userAvatarText = document.getElementById('user-avatar-text');

      // Modals
      this.modalHub = document.getElementById('modal-games-hub');
      this.modalLdb = document.getElementById('modal-leaderboard');
      this.modalUser = document.getElementById('modal-username');
      this.toastEl = document.getElementById('toast-notification');

      this.updateProfileUI();
    },

    resizeCanvas: function () {
      if (!this.canvas) return;
      var wrap = this.canvasWrap || this.canvas.parentElement;
      if (!wrap) return;

      var wrapW = wrap.clientWidth || window.innerWidth;
      var wrapH = wrap.clientHeight || (window.innerHeight - 48);

      if (!wrapW || wrapW < 10) wrapW = window.innerWidth || 360;
      if (!wrapH || wrapH < 10) wrapH = (window.innerHeight - 48) || 512;

      var aspect = wrapW / wrapH;
      if (!aspect || isNaN(aspect) || aspect <= 0) aspect = 288 / 512;

      // Keep virtual height 512 to preserve 100% identical 60fps arcade physics
      var targetHeight = 512;
      // Compute virtual width strictly matching display aspect ratio (zero distortion)
      var targetWidth = Math.round(targetHeight * aspect);

      // Safety clamps
      if (targetWidth < 220) targetWidth = 220;
      if (targetWidth > 2400) targetWidth = 2400;

      if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
        this.canvas.width = targetWidth;
        this.canvas.height = targetHeight;
        this.width = targetWidth;
        this.height = targetHeight;
      }

      // Dynamic bird horizontal positioning
      if (this.state === 0) {
        this.bird.x = Math.max(55, Math.round(this.width * (this.width <= 320 ? 0.21 : 0.18)));
      } else if (this.state === 1) {
        if (this.bird.x > this.width - 60) {
          this.bird.x = Math.max(55, this.width - 60);
        }
      }
    },

    updateProfileUI: function () {
      if (this.userNameEl) this.userNameEl.textContent = this.username;
      if (this.avatar) {
        if (this.userAvatarImg) {
          this.userAvatarImg.src = this.avatar;
          this.userAvatarImg.style.display = 'block';
        }
        if (this.userAvatarText) this.userAvatarText.style.display = 'none';
      } else {
        if (this.userAvatarImg) this.userAvatarImg.style.display = 'none';
        if (this.userAvatarText) {
          this.userAvatarText.textContent = this.username.charAt(0).toUpperCase() || '👤';
          this.userAvatarText.style.display = 'flex';
        }
      }
    },

    bindEvents: function () {
      var self = this;

      // Tap / Click to Flap (Supports clicking canvas and screen background)
      var handleFlapTrigger = function (e) {
        if (e && e.target && e.target.closest && e.target.closest('.modal-backdrop, .flappy-header, .gameover-overlay, button, a, input')) return;
        self.flap();
      };

      // Screen-wide touch for mobile fullscreen
      window.addEventListener('touchstart', function (e) {
        if (e.target && e.target.closest && e.target.closest('.modal-backdrop, .flappy-header, .gameover-overlay, button, a, input')) return;
        e.preventDefault();
        handleFlapTrigger(e);
      }, { passive: false });

      window.addEventListener('mousedown', function (e) {
        if (e.target && e.target.closest && e.target.closest('.modal-backdrop, .flappy-header, .gameover-overlay, button, a, input')) return;
        handleFlapTrigger(e);
      });

      window.addEventListener('keydown', function (e) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        var k = (e.key || '').toLowerCase();
        var c = e.code || '';
        if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW' || k === ' ' || k === 'arrowup' || k === 'w') {
          e.preventDefault();
          self.flap();
        }
      });

      // Window resize, orientation, and fullscreen events
      window.addEventListener('resize', function () {
        self.resizeCanvas();
      });

      window.addEventListener('orientationchange', function () {
        setTimeout(function () { self.resizeCanvas(); }, 120);
      });

      document.addEventListener('fullscreenchange', function () {
        setTimeout(function () { self.resizeCanvas(); }, 60);
      });
      document.addEventListener('webkitfullscreenchange', function () {
        setTimeout(function () { self.resizeCanvas(); }, 60);
      });

      window.addEventListener('message', function (e) {
        if (e && e.data && e.data.type === 'fullscreen_change') {
          setTimeout(function () { self.resizeCanvas(); }, 100);
        }
      });

      // Actions
      var btnPlayAgain = document.getElementById('btn-play-again');
      if (btnPlayAgain) {
        btnPlayAgain.addEventListener('click', function () {
          self.overlayEl.classList.remove('show');
          self.reset();
        });
      }

      var btnHome = document.getElementById('btn-home');
      if (btnHome) btnHome.addEventListener('click', function (e) { if (window.parent && window.parent !== window) { e.preventDefault(); window.parent.postMessage({ type: 'close_game' }, '*'); } else { window.location.href = '../../index.html'; } });

      var btnLdb = document.getElementById('btn-leaderboard');
      if (btnLdb) btnLdb.addEventListener('click', function () { self.openLeaderboard(); });

      var btnFs = document.getElementById('btn-fullscreen');
      if (btnFs) btnFs.addEventListener('click', function () { self.toggleFullscreen(); });

      var btnSound = document.getElementById('btn-sound');
      if (btnSound) {
        btnSound.addEventListener('click', function () {
          Sound.enabled = !Sound.enabled; try { localStorage.setItem("game_hub_sound_muted", Sound.enabled ? "false" : "true"); } catch (e) {}
          btnSound.textContent = Sound.enabled ? '🔊' : '🔇';
          self.showToast(Sound.enabled ? 'Suara Aktif' : 'Suara Mati');
        });
      }

      var userBadge = document.getElementById('user-badge');
      if (userBadge) userBadge.addEventListener('click', function () { self.openUsernameModal(); });

      // Modal close handlers
      document.querySelectorAll('.modal-backdrop').forEach(function (mb) {
        mb.addEventListener('click', function (e) { if (e.target === mb) self.closeModal(mb); });
      });
      document.querySelectorAll('.modal-close').forEach(function (btn) {
        btn.addEventListener('click', function () { self.closeModal(btn.closest('.modal-backdrop')); });
      });

      var formUser = document.getElementById('form-username');
      if (formUser) {
        formUser.addEventListener('submit', function (e) {
          e.preventDefault();
          var inp = document.getElementById('input-username').value.trim();
          if (inp.length >= 2 && inp.length <= 20) {
            self.username = inp;
            self.saveProfile();
            self.updateProfileUI();
            self.closeModal(self.modalUser);
            self.showToast('Profil pemain disimpan!');
          }
        });
      }
    },

    flap: function () {
      if (this.state === 0) {
        // Start game from IDLE
        this.state = 1;
        if (this.tapPromptEl) this.tapPromptEl.style.display = 'none';
        this.bird.vy = this.bird.jump;
        Sound.flap();

        // Pre-spawn oncoming pipes on screens wider than portrait (width > 340)
        if (this.width > 340) {
          var nextX = this.bird.x + 220;
          while (nextX <= this.width + 10) {
            this.spawnPipeAt(nextX);
            nextX += 190;
          }
          var overshoot = nextX - (this.width + 10);
          this.pipeSpawnTimer = Math.max(0, Math.round(this.pipeSpawnInterval - (overshoot / this.pipeSpeed)));
        }
      } else if (this.state === 1) {
        // Flap impulse
        this.bird.vy = this.bird.jump;
        Sound.flap();
      }
    },

    reset: function () {
      this.state = 0;
      this.score = 0;
      this.starsCollected = 0;
      this.currentTheme = 0;
      this.themeBanner = null;
      this.floatingTexts = [];
      this.particles = [];
      this.bird.x = Math.max(55, Math.round(this.width * (this.width <= 320 ? 0.21 : 0.18)));
      this.bird.y = 220;
      this.bird.vy = 0;
      this.bird.rotation = 0;
      this.pipes = [];
      this.pipeSpawnTimer = 0;
      if (this.hudScoreEl) this.hudScoreEl.textContent = '0';
      this.updateStarsHUD();
      this.updateThemeHUD();
      if (this.tapPromptEl) this.tapPromptEl.style.display = 'block';
      if (this.overlayEl) this.overlayEl.classList.remove('show');
    },

    update: function () {
      // Idle Hover Animation
      if (this.state === 0) {
        this.bird.wingTimer += 0.08;
        this.bird.y = 220 + Math.sin(this.bird.wingTimer) * 5;
        this.groundOffset = (this.groundOffset + 1.8) % 18;
        return;
      }

      if (this.state === 2) return; // GameOver, physics frozen

      this.starAnimTimer += 0.06;

      // Update Floating Texts
      for (var ftIdx = this.floatingTexts.length - 1; ftIdx >= 0; ftIdx--) {
        var ft = this.floatingTexts[ftIdx];
        ft.y += ft.vy;
        ft.life--;
        ft.opacity = Math.max(0, ft.life / 45);
        if (ft.life <= 0) {
          this.floatingTexts.splice(ftIdx, 1);
        }
      }

      // Update Burst Particles
      for (var ptIdx = this.particles.length - 1; ptIdx >= 0; ptIdx--) {
        var pt = this.particles[ptIdx];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.08;
        pt.life--;
        pt.alpha = Math.max(0, pt.life / 35);
        if (pt.life <= 0) {
          this.particles.splice(ptIdx, 1);
        }
      }

      // Update Snowflakes (for Winter theme)
      if (this.currentTheme === 3 && this.snowflakes.length > 0) {
        for (var snIdx = 0; snIdx < this.snowflakes.length; snIdx++) {
          var sn = this.snowflakes[snIdx];
          sn.y += sn.vy;
          sn.wobble += 0.03;
          sn.x += sn.vx + Math.sin(sn.wobble) * 0.4;
          if (sn.y > this.groundY) {
            sn.y = -6;
            sn.x = Math.random() * this.width;
          }
        }
      }

      // Update Theme Banner life
      if (this.themeBanner && this.themeBanner.life > 0) {
        this.themeBanner.life--;
      }

      // PLAYING Physics
      this.bird.vy += this.bird.gravity;
      if (this.bird.vy > this.bird.maxFall) this.bird.vy = this.bird.maxFall;
      this.bird.y += this.bird.vy;

      // Rotation based on velocity
      if (this.bird.vy < 0) {
        this.bird.rotation = -0.42;
      } else {
        this.bird.rotation = Math.min(Math.PI / 2, this.bird.rotation + 0.045);
      }

      // Ground collision
      if (this.bird.y + this.bird.radius >= this.groundY) {
        this.bird.y = this.groundY - this.bird.radius;
        this.handleDeath();
        return;
      }

      // Ceiling collision
      if (this.bird.y - this.bird.radius <= 0) {
        this.bird.y = this.bird.radius;
        this.bird.vy = 0;
      }

      // Ground scroll
      this.groundOffset = (this.groundOffset + this.pipeSpeed) % 18;

      // Spawn Pipes (interval 95 frames at 2.0px/frame = 190px pipe spacing)
      this.pipeSpawnTimer++;
      if (this.pipeSpawnTimer >= this.pipeSpawnInterval) {
        this.pipeSpawnTimer = 0;
        this.spawnPipe();
      }

      // Update Pipes
      var self = this;
      for (var i = this.pipes.length - 1; i >= 0; i--) {
        var p = this.pipes[i];
        p.x -= this.pipeSpeed;

        // Collision Check (Circle vs AABB)
        if (self.checkPipeCollision(p)) {
          self.handleDeath();
          return;
        }

        // Check Collectible Star Collision
        if (p.hasStar && !p.starCollected) {
          var curStarY = p.starY + Math.sin(self.starAnimTimer + p.x * 0.04) * 6;
          var starX = p.x + p.width / 2;
          var dist = Math.hypot(self.bird.x - starX, self.bird.y - curStarY);
          if (dist < (self.bird.radius + p.starRadius)) {
            p.starCollected = true;
            self.collectStar(starX, curStarY);
          }
        }

        // Score Check
        if (!p.scored && p.x + p.width < self.bird.x) {
          p.scored = true;
          self.score++;
          Sound.score();
          if (self.hudScoreEl) self.hudScoreEl.textContent = self.score;
          self.checkThemeUpdate();
        }

        // Remove offscreen pipes
        if (p.x + p.width < -10) {
          self.pipes.splice(i, 1);
        }
      }
    },

    spawnPipeAt: function (x) {
      var minTop = 60;
      var maxTop = this.groundY - this.pipeGap - 60;
      var topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
      var bottomY = topHeight + this.pipeGap;

      // Collectible star appears on ~45% of pipes
      var hasStar = Math.random() < 0.45;
      var starY = topHeight + Math.round(this.pipeGap / 2);

      this.pipes.push({
        x: x,
        topHeight: topHeight,
        bottomY: bottomY,
        width: 48,
        scored: false,
        hasStar: hasStar,
        starCollected: false,
        starY: starY,
        starRadius: 13
      });
    },

    spawnPipe: function () {
      this.spawnPipeAt(this.width + 10);
    },

    checkPipeCollision: function (p) {
      var bx = this.bird.x;
      var by = this.bird.y;
      var r = this.bird.radius - 2;

      // Check within horizontal bounds
      if (bx + r > p.x && bx - r < p.x + p.width) {
        // Hit top pipe or bottom pipe
        if (by - r < p.topHeight || by + r > p.bottomY) {
          return true;
        }
      }
      return false;
    },

    handleDeath: function () {
      Sound.hit();
      Sound.die();
      this.state = 2;

      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.saveProfile();
      }

      // Sync score with multi-game leaderboard
      this.syncScoreToBackend(this.score);

      // Determine medal
      var medal = '🥉';
      if (this.score >= 100) medal = '💎';
      else if (this.score >= 50) medal = '🥇';
      else if (this.score >= 25) medal = '🥈';
      else if (this.score < 10) medal = '⭐';

      if (this.finalScoreEl) this.finalScoreEl.textContent = this.score;
      if (this.finalBestEl) this.finalBestEl.textContent = this.highScore;
      if (this.medalIconEl) this.medalIconEl.textContent = medal;
      if (this.finalStarsEl) this.finalStarsEl.textContent = '⭐ ' + this.starsCollected;

      if (this.overlayEl) this.overlayEl.classList.add('show');
    },

    draw: function () {
      var ctx = this.ctx;
      var w = this.width;
      var h = this.height;

      // 1. Dynamic Thematic Background
      this.drawBackground();

      // 2. Draw Pipes & Collectible Stars
      var self = this;
      this.pipes.forEach(function (p) {
        self.drawPipe(p);
      });

      // 3. Thematic Ground
      this.drawGround();

      // 4. Draw Bird
      this.drawBird();

      // 5. Draw Collectible Burst Particles
      this.particles.forEach(function (pt) {
        ctx.save();
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 6. Draw Floating Score Texts (+3 ⭐)
      this.floatingTexts.forEach(function (ft) {
        ctx.save();
        ctx.globalAlpha = ft.opacity;
        ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ft.color || '#facc15';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });

      // 7. Draw Theme Change Banner Pill
      if (this.themeBanner && this.themeBanner.life > 0) {
        var tb = this.themeBanner;
        var alpha = Math.min(1, tb.life / 20);
        ctx.save();
        ctx.globalAlpha = alpha;

        var bWidth = Math.min(260, w - 40);
        var bHeight = 36;
        var bx = (w - bWidth) / 2;
        var by = 68;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bx, by, bWidth, bHeight, 18);
        } else {
          ctx.rect(bx, by, bWidth, bHeight);
        }
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tb.icon + ' ' + tb.title, w / 2, by + bHeight / 2);
        ctx.restore();
      }
    },

    drawBackground: function () {
      var ctx = this.ctx;
      var w = this.width;
      var gy = this.groundY;
      var theme = this.currentTheme;

      if (theme === 0) {
        // === SIANG CERAH (Day) ===
        var skyGrad = ctx.createLinearGradient(0, 0, 0, gy);
        skyGrad.addColorStop(0, '#0284c7');
        skyGrad.addColorStop(1, '#7dd3fc');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, gy);

        // Golden Radiant Sun
        var sunX = Math.min(w - 70, Math.max(70, w * 0.8));
        var sunGlow = ctx.createRadialGradient(sunX, 65, 10, sunX, 65, 45);
        sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
        sunGlow.addColorStop(0.4, 'rgba(250, 204, 21, 0.4)');
        sunGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunX, 65, 45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(sunX, 65, 20, 0, Math.PI * 2);
        ctx.fill();

        // City Silhouette (Cyan)
        ctx.fillStyle = 'rgba(14, 116, 144, 0.22)';
        for (var bx = 0; bx < w; bx += 42) {
          var bHeight = 22 + ((bx * 13) % 32);
          ctx.fillRect(bx, gy - bHeight, 38, bHeight);
        }

        // Daylight Clouds
        this.drawClouds('rgba(255, 255, 255, 0.45)');

      } else if (theme === 1) {
        // === SENJA KEEMASAN (Sunset) ===
        var sunsetGrad = ctx.createLinearGradient(0, 0, 0, gy);
        sunsetGrad.addColorStop(0, '#3b0764');
        sunsetGrad.addColorStop(0.45, '#c2410c');
        sunsetGrad.addColorStop(0.85, '#f59e0b');
        sunsetGrad.addColorStop(1, '#fde047');
        ctx.fillStyle = sunsetGrad;
        ctx.fillRect(0, 0, w, gy);

        // Sinking Sun near Horizon
        var ssunX = w * 0.65;
        var ssunY = gy - 40;
        var ssunGlow = ctx.createRadialGradient(ssunX, ssunY, 15, ssunX, ssunY, 70);
        ssunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
        ssunGlow.addColorStop(0.35, 'rgba(249, 115, 22, 0.6)');
        ssunGlow.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = ssunGlow;
        ctx.beginPath();
        ctx.arc(ssunX, ssunY, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.arc(ssunX, ssunY, 32, 0, Math.PI * 2);
        ctx.fill();

        // Sunset Skyline with glowing windows
        ctx.fillStyle = 'rgba(30, 11, 54, 0.65)';
        for (var sx = 0; sx < w; sx += 44) {
          var sHeight = 25 + ((sx * 17) % 38);
          ctx.fillRect(sx, gy - sHeight, 40, sHeight);
          ctx.fillStyle = '#fef08a';
          if ((sx % 3) === 0) {
            ctx.fillRect(sx + 8, gy - sHeight + 8, 4, 5);
            ctx.fillRect(sx + 20, gy - sHeight + 8, 4, 5);
          }
          ctx.fillStyle = 'rgba(30, 11, 54, 0.65)';
        }

        // Rosy Twilight Clouds
        this.drawClouds('rgba(253, 164, 175, 0.35)');

      } else if (theme === 2) {
        // === MALAM BERBINTANG (Night) ===
        var nightGrad = ctx.createLinearGradient(0, 0, 0, gy);
        nightGrad.addColorStop(0, '#020617');
        nightGrad.addColorStop(0.65, '#0f172a');
        nightGrad.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = nightGrad;
        ctx.fillRect(0, 0, w, gy);

        // Twinkling Night Stars
        this.drawNightStars();

        // Crescent Moon
        var moonX = Math.min(w - 70, Math.max(70, w * 0.82));
        var moonY = 65;
        var mGlow = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 40);
        mGlow.addColorStop(0, 'rgba(224, 231, 255, 0.4)');
        mGlow.addColorStop(1, 'rgba(224, 231, 255, 0)');
        ctx.fillStyle = mGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 40, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#060d1f';
        ctx.beginPath();
        ctx.arc(moonX - 7, moonY - 5, 16, 0, Math.PI * 2);
        ctx.fill();

        // Night Skyline with lit windows
        ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
        for (var nx = 0; nx < w; nx += 40) {
          var nHeight = 28 + ((nx * 19) % 35);
          ctx.fillRect(nx, gy - nHeight, 36, nHeight);
          ctx.fillStyle = (nx % 2 === 0) ? '#38bdf8' : '#facc15';
          ctx.fillRect(nx + 6, gy - nHeight + 6, 4, 4);
          ctx.fillRect(nx + 16, gy - nHeight + 14, 4, 4);
          ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
        }

        // Night Clouds
        this.drawClouds('rgba(148, 163, 184, 0.18)');

      } else if (theme === 3) {
        // === MUSIM SALJU (Winter) ===
        var winterGrad = ctx.createLinearGradient(0, 0, 0, gy);
        winterGrad.addColorStop(0, '#0f172a');
        winterGrad.addColorStop(0.55, '#334155');
        winterGrad.addColorStop(1, '#93c5fd');
        ctx.fillStyle = winterGrad;
        ctx.fillRect(0, 0, w, gy);

        // Snow-capped Mountain Peaks
        ctx.fillStyle = '#475569';
        for (var mx = -20; mx < w + 80; mx += 90) {
          ctx.beginPath();
          ctx.moveTo(mx, gy);
          ctx.lineTo(mx + 45, gy - 65);
          ctx.lineTo(mx + 90, gy);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.moveTo(mx + 30, gy - 43);
          ctx.lineTo(mx + 45, gy - 65);
          ctx.lineTo(mx + 60, gy - 43);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#475569';
        }

        // Winter Clouds
        this.drawClouds('rgba(241, 245, 249, 0.35)');

        // Falling Snowflakes
        this.drawFallingSnow();

      } else {
        // === CYBER NEON RETRO (Score 40+) ===
        var cyberGrad = ctx.createLinearGradient(0, 0, 0, gy);
        cyberGrad.addColorStop(0, '#18002a');
        cyberGrad.addColorStop(0.6, '#4a044e');
        cyberGrad.addColorStop(1, '#831843');
        ctx.fillStyle = cyberGrad;
        ctx.fillRect(0, 0, w, gy);

        // Synthwave Sun with horizontal scanlines
        var rsunX = w * 0.5;
        var rsunY = gy - 30;
        var rsunGlow = ctx.createRadialGradient(rsunX, rsunY, 10, rsunX, rsunY, 75);
        rsunGlow.addColorStop(0, 'rgba(244, 63, 94, 0.8)');
        rsunGlow.addColorStop(0.5, 'rgba(236, 72, 153, 0.3)');
        rsunGlow.addColorStop(1, 'rgba(236, 72, 153, 0)');
        ctx.fillStyle = rsunGlow;
        ctx.beginPath();
        ctx.arc(rsunX, rsunY, 75, 0, Math.PI * 2);
        ctx.fill();

        for (var slit = 0; slit < 6; slit++) {
          var sY = rsunY - 35 + slit * 12;
          ctx.fillStyle = slit < 3 ? '#facc15' : '#f43f5e';
          ctx.beginPath();
          ctx.arc(rsunX, rsunY, 36, 0, Math.PI * 2);
          ctx.rect(rsunX - 40, sY, 80, 7);
          ctx.fill();
        }

        // Cyber Skyline with glowing outlines
        for (var cx2 = 0; cx2 < w; cx2 += 46) {
          var cyHeight = 30 + ((cx2 * 11) % 40);
          ctx.fillStyle = '#0f051d';
          ctx.fillRect(cx2, gy - cyHeight, 42, cyHeight);
          ctx.strokeStyle = (cx2 % 2 === 0) ? '#ec4899' : '#06b6d4';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(cx2, gy - cyHeight, 42, 2);
        }
      }
    },

    drawClouds: function (fillColor) {
      var ctx = this.ctx;
      var w = this.width;
      ctx.fillStyle = fillColor || 'rgba(255, 255, 255, 0.45)';
      for (var cx = 60; cx < w + 80; cx += 180) {
        var step = Math.floor(cx / 180);
        var cy = (step % 2 === 0) ? 95 : 135;
        var r = (step % 2 === 0) ? 26 : 22;
        ctx.beginPath();
        ctx.arc(cx - 20, cy + 5, r * 0.8, 0, Math.PI * 2);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.arc(cx + 22, cy + 5, r * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    drawNightStars: function () {
      var ctx = this.ctx;
      if (!this.nightStars || this.nightStars.length === 0) return;
      var self = this;
      this.nightStars.forEach(function (s) {
        var alpha = 0.3 + 0.65 * (Math.sin(self.starAnimTimer * 2 + s.phase) * 0.5 + 0.5);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(s.x % self.width, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
    },

    drawFallingSnow: function () {
      var ctx = this.ctx;
      if (!this.snowflakes || this.snowflakes.length === 0) return;
      var self = this;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      this.snowflakes.forEach(function (sn) {
        ctx.beginPath();
        ctx.arc(sn.x % self.width, sn.y, sn.r, 0, Math.PI * 2);
        ctx.fill();
      });
    },

    drawGround: function () {
      var ctx = this.ctx;
      var w = this.width;
      var h = this.height;
      var gy = this.groundY;
      var theme = this.currentTheme;

      if (theme === 0) {
        ctx.fillStyle = '#ded895';
        ctx.fillRect(0, gy, w, h - gy);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(0, gy, w, 12);
        ctx.fillStyle = '#15803d';
        ctx.fillRect(0, gy + 12, w, 4);
        ctx.strokeStyle = '#c5b86b';
      } else if (theme === 1) {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(0, gy, w, h - gy);
        ctx.fillStyle = '#65a30d';
        ctx.fillRect(0, gy, w, 12);
        ctx.fillStyle = '#3f6212';
        ctx.fillRect(0, gy + 12, w, 4);
        ctx.strokeStyle = '#92400e';
      } else if (theme === 2) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, gy, w, h - gy);
        ctx.fillStyle = '#065f46';
        ctx.fillRect(0, gy, w, 12);
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(0, gy + 12, w, 4);
        ctx.strokeStyle = '#0f172a';
      } else if (theme === 3) {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(0, gy, w, h - gy);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, gy, w, 14);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(0, gy + 14, w, 4);
        ctx.strokeStyle = '#64748b';
      } else {
        ctx.fillStyle = '#110226';
        ctx.fillRect(0, gy, w, h - gy);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(0, gy, w, 6);
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(0, gy + 6, w, 4);
        ctx.strokeStyle = '#c084fc';
      }

      ctx.lineWidth = 2;
      for (var x = -this.groundOffset; x < w; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, gy + 16);
        ctx.lineTo(x + 10, h);
        ctx.stroke();
      }
    },

    drawPipe: function (p) {
      var ctx = this.ctx;
      var theme = this.currentTheme;

      var g0, g1, g2, stroke;
      if (theme === 0) {
        g0 = '#15803d'; g1 = '#4ade80'; g2 = '#166534'; stroke = '#052e16';
      } else if (theme === 1) {
        g0 = '#78350f'; g1 = '#fb923c'; g2 = '#9a3412'; stroke = '#451a03';
      } else if (theme === 2) {
        g0 = '#1e3a8a'; g1 = '#38bdf8'; g2 = '#0369a1'; stroke = '#082f49';
      } else if (theme === 3) {
        g0 = '#0284c7'; g1 = '#e0f2fe'; g2 = '#0369a1'; stroke = '#075985';
      } else {
        g0 = '#701a75'; g1 = '#f43f5e'; g2 = '#c084fc'; stroke = '#4a044e';
      }

      var pipeGrad = ctx.createLinearGradient(p.x, 0, p.x + p.width, 0);
      pipeGrad.addColorStop(0, g0);
      pipeGrad.addColorStop(0.3, g1);
      pipeGrad.addColorStop(1, g2);

      ctx.fillStyle = pipeGrad;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;

      // Top pipe
      ctx.fillRect(p.x, 0, p.width, p.topHeight);
      ctx.strokeRect(p.x, 0, p.width, p.topHeight);

      // Top pipe cap rim
      ctx.fillRect(p.x - 3, p.topHeight - 20, p.width + 6, 20);
      ctx.strokeRect(p.x - 3, p.topHeight - 20, p.width + 6, 20);

      // Bottom pipe
      ctx.fillRect(p.x, p.bottomY, p.width, this.groundY - p.bottomY);
      ctx.strokeRect(p.x, p.bottomY, p.width, this.groundY - p.bottomY);

      // Bottom pipe cap rim
      ctx.fillRect(p.x - 3, p.bottomY, p.width + 6, 20);
      ctx.strokeRect(p.x - 3, p.bottomY, p.width + 6, 20);

      // Winter Snowcaps on Pipes
      if (theme === 3) {
        ctx.fillStyle = '#f8fafc';
        // Snow on bottom pipe rim
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(p.x - 4, p.bottomY - 4, p.width + 8, 8, 4);
          ctx.fill();
        } else {
          ctx.fillRect(p.x - 4, p.bottomY - 4, p.width + 8, 8);
        }
        // Icicles
        ctx.beginPath();
        ctx.moveTo(p.x + 6, p.bottomY + 4);
        ctx.lineTo(p.x + 10, p.bottomY + 12);
        ctx.lineTo(p.x + 14, p.bottomY + 4);
        ctx.moveTo(p.x + 28, p.bottomY + 4);
        ctx.lineTo(p.x + 32, p.bottomY + 14);
        ctx.lineTo(p.x + 36, p.bottomY + 4);
        ctx.fill();
      }

      // Collectible Star in middle of pipe
      if (p.hasStar && !p.starCollected) {
        this.drawCollectibleStar(p);
      }
    },

    drawCollectibleStar: function (p) {
      var ctx = this.ctx;
      var starX = p.x + p.width / 2;
      var curStarY = p.starY + Math.sin(this.starAnimTimer + p.x * 0.04) * 6;
      var r = p.starRadius || 13;

      ctx.save();
      ctx.translate(starX, curStarY);

      var pulse = 1 + Math.sin(this.starAnimTimer * 2 + p.x * 0.05) * 0.08;
      ctx.scale(pulse, pulse);

      // Radial golden glow
      var glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
      glow.addColorStop(0, 'rgba(250, 204, 21, 0.7)');
      glow.addColorStop(0.5, 'rgba(250, 204, 21, 0.22)');
      glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();

      // Outer Star Shape
      this.drawStarPath(0, 0, 5, r, r * 0.48);
      var starGrad = ctx.createLinearGradient(0, -r, 0, r);
      starGrad.addColorStop(0, '#fef08a');
      starGrad.addColorStop(0.5, '#facc15');
      starGrad.addColorStop(1, '#eab308');
      ctx.fillStyle = starGrad;
      ctx.fill();
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Inner Highlight
      this.drawStarPath(-1, -1, 5, r * 0.65, r * 0.32);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fill();

      // Rotating sparkle glint
      var spAngle = (this.starAnimTimer * 1.5) % (Math.PI * 2);
      ctx.rotate(spAngle);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, -r - 3, 2, (r + 3) * 2);
      ctx.fillRect(-r - 3, -1, (r + 3) * 2, 2);

      ctx.restore();
    },

    drawStarPath: function (cx, cy, spikes, outerRadius, innerRadius) {
      var ctx = this.ctx;
      var rot = (Math.PI / 2) * 3;
      var x = cx;
      var y = cy;
      var step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (var i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
    },

    collectStar: function (x, y) {
      this.starsCollected++;
      this.score += 3; // +3 bonus points
      Sound.star();
      if (this.hudScoreEl) this.hudScoreEl.textContent = this.score;
      this.updateStarsHUD();

      // Floating text
      this.floatingTexts.push({
        x: x,
        y: y - 10,
        text: '+3 ⭐',
        color: '#facc15',
        opacity: 1,
        vy: -1.6,
        life: 45
      });

      // Burst particles
      for (var k = 0; k < 12; k++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = Math.random() * 2.8 + 1.2;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 3.5 + 2,
          color: k % 2 === 0 ? '#facc15' : '#ffffff',
          alpha: 1,
          life: 25 + Math.random() * 15
        });
      }

      // Check if theme updates due to score bump
      this.checkThemeUpdate();
    },

    getThemeIndex: function (score) {
      // 0-9: Day, 10-19: Sunset, 20-29: Night, 30-39: Winter, 40+: Cyber Neon (cycles)
      var cycle = Math.floor(score / 10) % 5;
      return cycle;
    },

    checkThemeUpdate: function () {
      var nextTheme = this.getThemeIndex(this.score);
      if (nextTheme !== this.currentTheme) {
        this.currentTheme = nextTheme;
        Sound.themeChange();
        var th = this.THEMES[nextTheme];
        this.showThemeAnnouncement(th);
        this.updateThemeHUD();
      }
    },

    showThemeAnnouncement: function (th) {
      this.themeBanner = {
        title: th.name.toUpperCase(),
        icon: th.icon,
        opacity: 1,
        life: 120
      };
      this.showToast(th.icon + ' ' + th.name + ' Tiba!');
    },

    updateThemeHUD: function () {
      if (this.hudThemePill) {
        var th = this.THEMES[this.currentTheme] || this.THEMES[0];
        this.hudThemePill.textContent = th.icon + ' ' + th.name.split(' ')[0];
      }
    },

    updateStarsHUD: function () {
      if (this.hudStarsPill) {
        this.hudStarsPill.textContent = '⭐ ' + this.starsCollected;
      }
    },

    initThemeEffects: function () {
      // Initialize Night Stars
      this.nightStars = [];
      for (var i = 0; i < 50; i++) {
        this.nightStars.push({
          x: Math.random() * 2400,
          y: Math.random() * 360,
          r: Math.random() * 1.5 + 0.8,
          phase: Math.random() * Math.PI * 2
        });
      }

      // Initialize Winter Snowflakes
      this.snowflakes = [];
      for (var j = 0; j < 45; j++) {
        this.snowflakes.push({
          x: Math.random() * 2400,
          y: Math.random() * 512,
          r: Math.random() * 2.2 + 1,
          vy: Math.random() * 1.2 + 0.8,
          vx: Math.random() * 0.6 - 0.3,
          wobble: Math.random() * Math.PI * 2
        });
      }
    },

    drawBird: function () {
      var ctx = this.ctx;
      var b = this.bird;

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rotation);

      // Body (Yellow)
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Wing
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.ellipse(-4, 2, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Big Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(6, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(7.5, -4, 2, 0, Math.PI * 2);
      ctx.fill();

      // Beak (Orange)
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(16, 3);
      ctx.lineTo(9, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    },

    loop: function (timestamp) {
      var self = this;
      if (!timestamp) timestamp = performance.now();
      if (!this.lastTime) this.lastTime = timestamp;
      var dt = timestamp - this.lastTime;
      this.lastTime = timestamp;

      // Clamp dt to avoid spiral of death on background tab
      if (dt > 100) dt = 100;
      if (dt < 0) dt = 0;

      this.accumulator += dt;
      var stepMs = 1000 / 60; // 60Hz physics ticks

      while (this.accumulator >= stepMs) {
        this.update();
        this.accumulator -= stepMs;
      }

      this.draw();
      requestAnimationFrame(function (ts) { self.loop(ts); });
    },

    syncScoreToBackend: function (score) {
      fetch('/api/leaderboard.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: 'flappy',
          username: this.username,
          score: score,
          avatar: this.avatar
        })
      }).catch(function () {});
    },

    openLeaderboard: function () {
      var self = this;
      this.openModal(this.modalLdb);
      var b = document.getElementById('leaderboard-body-content');
      if (b) b.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">Memuat peringkat Flappy Bird...</div>';

      fetch('/api/leaderboard.php?game=flappy&username=' + encodeURIComponent(this.username))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.status === 'success') {
            self.renderLeaderboardTable(data.leaderboard, data.player);
          }
        }).catch(function () {});
    },

    renderLeaderboardTable: function (list, player) {
      var b = document.getElementById('leaderboard-body-content');
      if (!b) return;

      var html = '';
      if (player) {
        html += '<div style="background:rgba(255,255,255,0.06); padding:10px; border-radius:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">' +
          '<div><span>Pemain: <strong>' + (player.username || '-') + '</strong></span><br>' +
          '<span style="font-size:12px; color:#94a3b8;">Skor Tertinggi: <strong>' + (player.best_score || 0) + '</strong></span></div>' +
          '<div style="background:#10b981; color:#000; font-size:12px; font-weight:800; padding:4px 10px; border-radius:20px;">Rank #' + (player.rank || '-') + '</div>' +
          '</div>';
      }

      if (!list || list.length === 0) {
        b.innerHTML = html + '<div style="text-align:center; padding:20px; color:#94a3b8;">Belum ada rekor jarak tercatat. Terbangkan burungmu sekarang!</div>';
        return;
      }

      html += '<table style="width:100%; border-collapse:collapse;"><thead><tr><th style="text-align:left; padding:6px; color:#94a3b8; font-size:11px;\">Rank</th><th style="text-align:left; padding:6px; color:#94a3b8; font-size:11px;\">Pemain</th><th style="text-align:right; padding:6px; color:#94a3b8; font-size:11px;\">Pipa</th></tr></thead><tbody>';

      list.forEach(function (row) {
        var av = row.avatar ? '<img src="' + row.avatar + '" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">' : (row.username ? row.username.charAt(0).toUpperCase() : '👤');
        html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">' +
          '<td style="padding:8px 6px; font-weight:800; color:#10b981;">#' + row.rank + '</td>' +
          '<td style="padding:8px 6px;"><div style="display:flex; align-items:center; gap:8px;">' + av + '<span>' + row.username + '</span></div></td>' +
          '<td style="padding:8px 6px; text-align:right; font-weight:700; color:#38bdf8;">' + row.best_score + '</td>' +
          '</tr>';
      });

      html += '</tbody></table>';
      b.innerHTML = html;
    },

    openUsernameModal: function () {
      var inp = document.getElementById('input-username');
      if (inp) inp.value = this.username;
      this.openModal(this.modalUser);
    },

    openModal: function (m) {
      if (m) { m.classList.add('is-open'); m.style.display = 'flex'; }
    },
    closeModal: function (m) {
      if (m) { m.classList.remove('is-open'); m.style.display = 'none'; }
    },

    toggleFullscreen: function () {
      if (window.FullscreenSync) { window.FullscreenSync.toggle(); return; }
      var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (isFs) {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) ex.call(document);
        document.body.classList.remove('is-fullscreen');
      } else {
        var req = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
        if (req) req.call(document.documentElement);
        document.body.classList.add('is-fullscreen');
        this.showToast('⛶ Mode Fullscreen Aktif');
      }
    },

    showToast: function (msg) {
      if (!this.toastEl) return;
      this.toastEl.textContent = msg;
      this.toastEl.classList.add('show');
      var self = this;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(function () {
        self.toastEl.classList.remove('show');
      }, 2500);
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    FlappyApp.init();
    window.FlappyApp = FlappyApp;
  });

})();
