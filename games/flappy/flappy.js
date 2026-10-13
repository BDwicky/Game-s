/**
 * Flappy Bird - 60FPS Canvas Physics & Multi-Game Leaderboard
 * Platform: game.dwicky.dev
 */

(function () {
  'use strict';

  // --- Sound Synthesizer ---
  var Sound = {
    ctx: null,
    enabled: true,

    init: function () { try { this.enabled = localStorage.getItem("game_hub_sound_muted") !== "true"; } catch (e) { this.enabled = true; }
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
    },
    resume: function () {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone: function (freq, type, dur, vol) {
      if (!this.enabled || !this.ctx) return;
      try {
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol || 0.12, this.ctx.currentTime);
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
    }
  };

  var FlappyApp = {
    canvas: null,
    ctx: null,
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

    // Shared Profile
    username: 'Pemain Baru',
    avatar: '',

    init: function () {
      this.loadProfile();
      this.cacheDom();
      this.bindEvents();
      this.reset();
      this.loop();
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
        if (e.code === 'Space' || e.code === 'ArrowUp') {
          e.preventDefault();
          self.flap();
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
      if (btnHome) btnHome.addEventListener('click', function () { window.location.href = '../../index.html'; });

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
      } else if (this.state === 1) {
        // Flap impulse
        this.bird.vy = this.bird.jump;
        Sound.flap();
      }
    },

    reset: function () {
      this.state = 0;
      this.score = 0;
      this.bird.y = 220;
      this.bird.vy = 0;
      this.bird.rotation = 0;
      this.pipes = [];
      this.pipeSpawnTimer = 0;
      if (this.hudScoreEl) this.hudScoreEl.textContent = '0';
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

        // Score Check
        if (!p.scored && p.x + p.width < self.bird.x) {
          p.scored = true;
          self.score++;
          Sound.score();
          if (self.hudScoreEl) self.hudScoreEl.textContent = self.score;
        }

        // Remove offscreen pipes
        if (p.x + p.width < -10) {
          self.pipes.splice(i, 1);
        }
      }
    },

    spawnPipe: function () {
      var minTop = 60;
      var maxTop = this.groundY - this.pipeGap - 60;
      var topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;

      this.pipes.push({
        x: this.width + 10,
        topHeight: topHeight,
        bottomY: topHeight + this.pipeGap,
        width: 48,
        scored: false
      });
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

      if (this.overlayEl) this.overlayEl.classList.add('show');
    },

    draw: function () {
      var ctx = this.ctx;
      var w = this.width;
      var h = this.height;

      // 1. Sky Gradient (Day vibe)
      var skyGrad = ctx.createLinearGradient(0, 0, 0, this.groundY);
      skyGrad.addColorStop(0, '#0284c7');
      skyGrad.addColorStop(1, '#7dd3fc');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, this.groundY);

      // 2. City & Cloud silhouettes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(60, 100, 24, 0, Math.PI * 2);
      ctx.arc(85, 95, 30, 0, Math.PI * 2);
      ctx.arc(115, 100, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(200, 140, 20, 0, Math.PI * 2);
      ctx.arc(220, 135, 26, 0, Math.PI * 2);
      ctx.arc(245, 140, 18, 0, Math.PI * 2);
      ctx.fill();

      // 3. Draw Pipes
      var self = this;
      this.pipes.forEach(function (p) {
        self.drawPipe(p);
      });

      // 4. Ground
      ctx.fillStyle = '#ded895';
      ctx.fillRect(0, this.groundY, w, h - this.groundY);

      // Grass strip
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, this.groundY, w, 12);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(0, this.groundY + 12, w, 4);

      // Ground pattern lines
      ctx.strokeStyle = '#c5b86b';
      ctx.lineWidth = 2;
      for (var x = -this.groundOffset; x < w; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, this.groundY + 16);
        ctx.lineTo(x + 10, h);
        ctx.stroke();
      }

      // 5. Draw Bird
      this.drawBird();
    },

    drawPipe: function (p) {
      var ctx = this.ctx;

      // Top pipe
      var topGrad = ctx.createLinearGradient(p.x, 0, p.x + p.width, 0);
      topGrad.addColorStop(0, '#15803d');
      topGrad.addColorStop(0.3, '#4ade80');
      topGrad.addColorStop(1, '#166534');

      ctx.fillStyle = topGrad;
      ctx.fillRect(p.x, 0, p.width, p.topHeight);
      ctx.strokeStyle = '#052e16';
      ctx.lineWidth = 2;
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
