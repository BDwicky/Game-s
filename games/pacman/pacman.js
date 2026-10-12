/**
 * Pacman Arcade - HTML5 Canvas Engine & Multi-Game Leaderboard
 * Platform: game.dwicky.dev
 */

(function () {
  'use strict';

  // --- Sound Synthesizer ---
  var Sound = {
    ctx: null,
    enabled: true,
    wakaState: 0,

    init: function () {
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
        gain.gain.setValueAtTime(vol || 0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
      } catch (e) {}
    },
    waka: function () {
      this.init(); this.resume();
      this.wakaState = 1 - this.wakaState;
      this.tone(this.wakaState ? 340 : 480, 'triangle', 0.08, 0.08);
    },
    eatGhost: function () {
      this.init(); this.resume();
      var self = this;
      [400, 550, 700, 850].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 'sine', 0.08, 0.15); }, i * 60);
      });
    },
    death: function () {
      this.init(); this.resume();
      var self = this;
      [500, 460, 420, 380, 340, 300, 260, 220].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 'sawtooth', 0.1, 0.12); }, i * 90);
      });
    }
  };

  // --- Directions ---
  var D = { NONE: 0, UP: 1, LEFT: 2, DOWN: 3, RIGHT: 4 };

  // --- Classic Maze Grid (19x22 compact arcade optimized for crisp rendering) ---
  // 1: Wall, 2: Dot, 3: Energizer, 0: Path, 4: Ghost Gate
  var BASE_MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,3,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,3,1],
    [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
    [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,2,1],
    [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1],
    [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
    [1,1,1,1,2,1,0,1,1,4,1,1,0,1,2,1,1,1,1],
    [0,0,0,0,2,0,0,1,0,0,0,1,0,0,2,0,0,0,0],
    [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
    [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
    [1,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
    [1,3,2,1,2,2,2,2,2,0,2,2,2,2,2,1,2,3,1],
    [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
    [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ];

  var PacmanApp = {
    canvas: null,
    ctx: null,
    tile: 20,
    cols: 19,
    rows: 22,
    map: [],
    score: 0,
    highScore: 0,
    lives: 3,
    level: 1,
    dotsLeft: 0,
    frightenedTimer: 0,
    gameOver: false,
    paused: false,
    username: 'Pemain Baru',
    avatar: '',

    // Pacman State
    pac: { x: 9, y: 16, dir: D.NONE, nextDir: D.NONE, mouth: 0.2, mouthDir: 1, speed: 0.080 },

    // Ghosts
    ghosts: [],

    // Fixed 60Hz Timestep Accumulator (Refresh-Rate Independent)
    lastTime: 0,
    accumulator: 0,

    init: function () {
      this.loadProfile();
      this.cacheDom();
      this.bindControls();
      this.resetGame();
      this.loop();
    },

    loadProfile: function () {
      try {
        var u = localStorage.getItem('user_profile_name') || localStorage.getItem('2048_username');
        if (u) this.username = u;
        var av = localStorage.getItem('user_profile_avatar') || localStorage.getItem('2048_avatar');
        if (av) this.avatar = av;
        var hs = localStorage.getItem('pacman_high_score');
        if (hs) this.highScore = parseInt(hs, 10) || 0;
      } catch (e) {}
    },

    saveProfile: function () {
      try {
        localStorage.setItem('user_profile_name', this.username);
        localStorage.setItem('user_profile_avatar', this.avatar);
        localStorage.setItem('pacman_high_score', this.highScore);
      } catch (e) {}
    },

    cacheDom: function () {
      this.canvas = document.getElementById('pacman-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.canvas.width = this.cols * this.tile;
      this.canvas.height = this.rows * this.tile;

      this.scoreEl = document.getElementById('stat-score');
      this.highScoreEl = document.getElementById('stat-highscore');
      this.livesEl = document.getElementById('lives-display');
      this.msgOverlay = document.getElementById('game-msg-overlay');

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
      if (this.highScoreEl) this.highScoreEl.textContent = this.highScore;
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

    bindControls: function () {
      var self = this;

      // Keyboard Arrow & WASD
      window.addEventListener('keydown', function (e) {
        if (['ArrowUp', 'KeyW'].indexOf(e.code) !== -1) { e.preventDefault(); self.setDir(D.UP); }
        if (['ArrowDown', 'KeyS'].indexOf(e.code) !== -1) { e.preventDefault(); self.setDir(D.DOWN); }
        if (['ArrowLeft', 'KeyA'].indexOf(e.code) !== -1) { e.preventDefault(); self.setDir(D.LEFT); }
        if (['ArrowRight', 'KeyD'].indexOf(e.code) !== -1) { e.preventDefault(); self.setDir(D.RIGHT); }
      });

      // Virtual D-Pad
      var dpadUp = document.getElementById('dpad-up');
      var dpadDown = document.getElementById('dpad-down');
      var dpadLeft = document.getElementById('dpad-left');
      var dpadRight = document.getElementById('dpad-right');

      if (dpadUp) dpadUp.addEventListener('touchstart', function (e) { e.preventDefault(); self.setDir(D.UP); });
      if (dpadDown) dpadDown.addEventListener('touchstart', function (e) { e.preventDefault(); self.setDir(D.DOWN); });
      if (dpadLeft) dpadLeft.addEventListener('touchstart', function (e) { e.preventDefault(); self.setDir(D.LEFT); });
      if (dpadRight) dpadRight.addEventListener('touchstart', function (e) { e.preventDefault(); self.setDir(D.RIGHT); });

      if (dpadUp) dpadUp.addEventListener('click', function () { self.setDir(D.UP); });
      if (dpadDown) dpadDown.addEventListener('click', function () { self.setDir(D.DOWN); });
      if (dpadLeft) dpadLeft.addEventListener('click', function () { self.setDir(D.LEFT); });
      if (dpadRight) dpadRight.addEventListener('click', function () { self.setDir(D.RIGHT); });

      // Swipe Gestures on Canvas
      var touchStartX = 0, touchStartY = 0;
      this.canvas.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      this.canvas.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        var dy = e.changedTouches[0].clientY - touchStartY;
        var absDx = Math.abs(dx);
        var absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) > 20) {
          if (absDx > absDy) {
            self.setDir(dx > 0 ? D.RIGHT : D.LEFT);
          } else {
            self.setDir(dy > 0 ? D.DOWN : D.UP);
          }
        }
      }, { passive: true });

      // Header Actions
      var btnReset = document.getElementById('btn-reset');
      if (btnReset) btnReset.addEventListener('click', function () { self.resetGame(); });

      var btnHub = document.getElementById('btn-games-hub');
      if (btnHub) btnHub.addEventListener('click', function () { self.openModal(self.modalHub); });

      var btnLdb = document.getElementById('btn-leaderboard');
      if (btnLdb) btnLdb.addEventListener('click', function () { self.openLeaderboard(); });

      var btnFs = document.getElementById('btn-fullscreen');
      if (btnFs) btnFs.addEventListener('click', function () { self.toggleFullscreen(); });

      var btnSound = document.getElementById('btn-sound');
      if (btnSound) {
        btnSound.addEventListener('click', function () {
          Sound.enabled = !Sound.enabled;
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

      var btnOverlayRestart = document.getElementById('btn-overlay-restart');
      if (btnOverlayRestart) {
        btnOverlayRestart.addEventListener('click', function () { self.resetGame(); });
      }
    },

    setDir: function (d) {
      if (this.gameOver) return;
      var opposites = { 1: 3, 2: 4, 3: 1, 4: 2 };
      if (opposites[this.pac.dir] === d) {
        this.pac.dir = d;
        this.pac.nextDir = d;
        return;
      }
      this.pac.nextDir = d;
      if (this.pac.dir === D.NONE) this.pac.dir = d;
    },

    resetGame: function () {
      this.score = 0;
      this.lives = 3;
      this.gameOver = false;
      this.frightenedTimer = 0;
      if (this.msgOverlay) this.msgOverlay.classList.remove('show');
      this.initLevel();
    },

    initLevel: function () {
      // Deep copy map
      this.map = [];
      this.dotsLeft = 0;
      for (var r = 0; r < this.rows; r++) {
        var row = [];
        for (var c = 0; c < this.cols; c++) {
          var val = BASE_MAP[r][c];
          if (val === 2 || val === 3) this.dotsLeft++;
          row.push(val);
        }
        this.map.push(row);
      }

      this.resetPositions();
      this.updateDashboard();
    },

    resetPositions: function () {
      this.pac.x = 9;
      this.pac.y = 16;
      this.pac.dir = D.NONE;
      this.pac.nextDir = D.NONE;

      this.ghosts = [
        { name: 'Blinky', color: '#ef4444', x: 9, y: 8,  dir: D.UP,   frightened: false },
        { name: 'Pinky',  color: '#f472b6', x: 8, y: 10, dir: D.UP,   frightened: false },
        { name: 'Inky',   color: '#06b6d4', x: 9, y: 10, dir: D.UP,   frightened: false },
        { name: 'Clyde',  color: '#f97316', x: 10, y: 10, dir: D.UP, frightened: false }
      ];
    },

    updateDashboard: function () {
      if (this.scoreEl) this.scoreEl.textContent = this.score;
      if (this.highScoreEl) this.highScoreEl.textContent = this.highScore;
      if (this.livesEl) {
        var hearts = '';
        for (var i = 0; i < this.lives; i++) hearts += '❤️';
        this.livesEl.textContent = hearts || '💀';
      }
    },

    canMove: function (x, y, dir) {
      var nx = x, ny = y;
      if (dir === D.UP) ny -= 1;
      if (dir === D.DOWN) ny += 1;
      if (dir === D.LEFT) nx -= 1;
      if (dir === D.RIGHT) nx += 1;

      // Screen wrap tunnel
      if (nx < 0 || nx >= this.cols) return true;

      var tile = this.map[Math.round(ny)][Math.round(nx)];
      return tile !== 1 && tile !== 4;
    },

    update: function () {
      if (this.gameOver || this.paused) return;

      // Update Pacman Direction
      if (this.pac.nextDir !== D.NONE && this.pac.nextDir !== this.pac.dir) {
        var opposites = { 1: 3, 2: 4, 3: 1, 4: 2 };
        if (opposites[this.pac.dir] === this.pac.nextDir) {
          this.pac.dir = this.pac.nextDir;
        } else {
          var cx = Math.round(this.pac.x);
          var cy = Math.round(this.pac.y);
          var isAligned = Math.abs(this.pac.x - cx) <= this.pac.speed && Math.abs(this.pac.y - cy) <= this.pac.speed;
          if (isAligned && this.canMove(cx, cy, this.pac.nextDir)) {
            this.pac.dir = this.pac.nextDir;
            this.pac.x = cx;
            this.pac.y = cy;
          }
        }
      }

      // Move Pacman
      if (this.pac.dir !== D.NONE) {
        var dx = 0, dy = 0;
        if (this.pac.dir === D.UP) dy = -this.pac.speed;
        if (this.pac.dir === D.DOWN) dy = this.pac.speed;
        if (this.pac.dir === D.LEFT) dx = -this.pac.speed;
        if (this.pac.dir === D.RIGHT) dx = this.pac.speed;

        if (this.canMove(this.pac.x, this.pac.y, this.pac.dir)) {
          this.pac.x += dx;
          this.pac.y += dy;

          // Wrap tunnel
          if (this.pac.x < -0.5) this.pac.x = this.cols - 0.5;
          if (this.pac.x > this.cols - 0.5) this.pac.x = -0.5;
        } else {
          this.pac.x = Math.round(this.pac.x);
          this.pac.y = Math.round(this.pac.y);
        }
      }

      // Eat Pellets
      var currentTileX = Math.round(this.pac.x);
      var currentTileY = Math.round(this.pac.y);

      if (currentTileX >= 0 && currentTileX < this.cols && currentTileY >= 0 && currentTileY < this.rows) {
        var currentTile = this.map[currentTileY][currentTileX];
        if (currentTile === 2) {
          // Regular dot
          this.map[currentTileY][currentTileX] = 0;
          this.score += 10;
          this.dotsLeft--;
          Sound.waka();
          this.updateDashboard();
        } else if (currentTile === 3) {
          // Power Energizer
          this.map[currentTileY][currentTileX] = 0;
          this.score += 50;
          this.dotsLeft--;
          this.frightenedTimer = 360; // 6 seconds at 60Hz
          this.ghosts.forEach(function (g) { g.frightened = true; });
          Sound.eatGhost();
          this.updateDashboard();
        }
      }

      // Win level check
      if (this.dotsLeft <= 0) {
        this.level++;
        this.score += 500;
        this.showToast('Level ' + this.level + ' Selesai! +500 Poin');
        this.initLevel();
        return;
      }

      // Frightened timer countdown
      if (this.frightenedTimer > 0) {
        this.frightenedTimer--;
        if (this.frightenedTimer === 0) {
          this.ghosts.forEach(function (g) { g.frightened = false; });
        }
      }

      // Move Ghosts
      var self = this;
      this.ghosts.forEach(function (g) {
        self.moveGhost(g);

        // Collision Check
        var dist = Math.hypot(g.x - self.pac.x, g.y - self.pac.y);
        if (dist < 0.75) {
          if (g.frightened) {
            // Eat ghost
            self.score += 200;
            g.frightened = false;
            g.x = 9; g.y = 10; // respawn in house
            Sound.eatGhost();
            self.showToast('Hantu Tertangkap! +200');
            self.updateDashboard();
          } else {
            // Pacman death
            self.handlePacmanDeath();
          }
        }
      });

      // Animate mouth
      this.pac.mouth += 0.035 * this.pac.mouthDir;
      if (this.pac.mouth > 0.3 || this.pac.mouth < 0.02) this.pac.mouthDir *= -1;
    },

    moveGhost: function (g) {
      var speed = g.frightened ? 0.045 : 0.065;
      var gx = Math.round(g.x);
      var gy = Math.round(g.y);
      var isAligned = Math.abs(g.x - gx) <= speed && Math.abs(g.y - gy) <= speed;

      if (isAligned) {
        g.x = gx;
        g.y = gy;

        // Pick available dirs (excluding reverse)
        var opposites = { 1: 3, 2: 4, 3: 1, 4: 2 };
        var validDirs = [];
        [D.UP, D.DOWN, D.LEFT, D.RIGHT].forEach(function (d) {
          if (d !== opposites[g.dir] && PacmanApp.canMove(gx, gy, d)) {
            validDirs.push(d);
          }
        });

        // Allow reverse if trapped
        if (validDirs.length === 0) {
          var rev = opposites[g.dir];
          if (PacmanApp.canMove(gx, gy, rev)) validDirs.push(rev);
        }

        if (validDirs.length > 0) {
          // If frightened, pick random; otherwise, gravitate toward Pacman
          if (g.frightened || Math.random() < 0.35) {
            g.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
          } else {
            // Smart targeting toward Pacman
            var bestDir = validDirs[0];
            var bestDist = 9999;
            validDirs.forEach(function (d) {
              var testX = gx + (d === D.RIGHT ? 1 : (d === D.LEFT ? -1 : 0));
              var testY = gy + (d === D.DOWN ? 1 : (d === D.UP ? -1 : 0));
              var dist = Math.hypot(testX - PacmanApp.pac.x, testY - PacmanApp.pac.y);
              if (dist < bestDist) {
                bestDist = dist;
                bestDir = d;
              }
            });
            g.dir = bestDir;
          }
        }
      }

      // Advance ghost position
      if (g.dir === D.UP) g.y -= speed;
      if (g.dir === D.DOWN) g.y += speed;
      if (g.dir === D.LEFT) g.x -= speed;
      if (g.dir === D.RIGHT) g.x += speed;

      // Wrap tunnel
      if (g.x < -0.5) g.x = this.cols - 0.5;
      if (g.x > this.cols - 0.5) g.x = -0.5;
    },

    handlePacmanDeath: function () {
      Sound.death();
      this.lives--;
      this.updateDashboard();

      if (this.lives <= 0) {
        this.gameOver = true;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          this.saveProfile();
        }
        this.syncScoreToBackend(this.score);

        // Show Game Over Overlay
        document.getElementById('msg-title').textContent = 'GAME OVER';
        document.getElementById('msg-score-summary').innerHTML = 'SKOR AKHIR: ' + this.score + '<br>REKOR TERTINGGI: ' + this.highScore;
        if (this.msgOverlay) this.msgOverlay.classList.add('show');
      } else {
        this.resetPositions();
      }
    },

    draw: function () {
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      var t = this.tile;

      // Draw Maze
      for (var r = 0; r < this.rows; r++) {
        for (var c = 0; c < this.cols; c++) {
          var val = this.map[r][c];
          var x = c * t;
          var y = r * t;

          if (val === 1) {
            // Wall
            this.ctx.fillStyle = '#1d4ed8';
            this.ctx.fillRect(x + 2, y + 2, t - 4, t - 4);
          } else if (val === 4) {
            // Ghost house gate
            this.ctx.fillStyle = '#f472b6';
            this.ctx.fillRect(x, y + t / 2 - 2, t, 4);
          } else if (val === 2) {
            // Pellet
            this.ctx.fillStyle = '#fde047';
            this.ctx.beginPath();
            this.ctx.arc(x + t / 2, y + t / 2, 2.5, 0, Math.PI * 2);
            this.ctx.fill();
          } else if (val === 3) {
            // Energizer
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(x + t / 2, y + t / 2, 6, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
      }

      // Draw Pacman
      var px = this.pac.x * t + t / 2;
      var py = this.pac.y * t + t / 2;
      var rad = t / 2 - 2;
      var angle = 0;
      if (this.pac.dir === D.RIGHT) angle = 0;
      if (this.pac.dir === D.DOWN)  angle = Math.PI * 0.5;
      if (this.pac.dir === D.LEFT)  angle = Math.PI;
      if (this.pac.dir === D.UP)    angle = Math.PI * 1.5;

      this.ctx.fillStyle = '#facc15';
      this.ctx.beginPath();
      this.ctx.arc(px, py, rad, angle + this.pac.mouth, angle + Math.PI * 2 - this.pac.mouth);
      this.ctx.lineTo(px, py);
      this.ctx.fill();

      // Draw Ghosts
      this.ghosts.forEach(function (g) {
        var gx = g.x * t + t / 2;
        var gy = g.y * t + t / 2;

        PacmanApp.ctx.fillStyle = g.frightened ? '#38bdf8' : g.color;
        PacmanApp.ctx.beginPath();
        PacmanApp.ctx.arc(gx, gy - 2, rad, Math.PI, 0, false);
        PacmanApp.ctx.lineTo(gx + rad, gy + rad);
        PacmanApp.ctx.lineTo(gx - rad, gy + rad);
        PacmanApp.ctx.fill();

        // Eyes
        PacmanApp.ctx.fillStyle = '#ffffff';
        PacmanApp.ctx.beginPath();
        PacmanApp.ctx.arc(gx - 4, gy - 4, 3, 0, Math.PI * 2);
        PacmanApp.ctx.arc(gx + 4, gy - 4, 3, 0, Math.PI * 2);
        PacmanApp.ctx.fill();

        PacmanApp.ctx.fillStyle = '#1e3a8a';
        PacmanApp.ctx.beginPath();
        PacmanApp.ctx.arc(gx - 4, gy - 4, 1.5, 0, Math.PI * 2);
        PacmanApp.ctx.arc(gx + 4, gy - 4, 1.5, 0, Math.PI * 2);
        PacmanApp.ctx.fill();
      });
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

    syncScoreToBackend: function (sc) {
      fetch('/api/leaderboard.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: 'pacman',
          username: this.username,
          score: sc || this.highScore,
          avatar: this.avatar
        })
      }).catch(function () {});
    },

    openLeaderboard: function () {
      var self = this;
      this.openModal(this.modalLdb);
      var b = document.getElementById('leaderboard-body-content');
      if (b) b.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">Memuat peringkat Pacman...</div>';

      fetch('/api/leaderboard.php?game=pacman&username=' + encodeURIComponent(this.username))
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
          '<span style="font-size:12px; color:#94a3b8;">Best Skor: <strong>' + (player.best_score || 0) + '</strong></span></div>' +
          '<div style="background:#facc15; color:#000; font-size:12px; font-weight:800; padding:4px 10px; border-radius:20px;">Rank #' + (player.rank || '-') + '</div>' +
          '</div>';
      }

      if (!list || list.length === 0) {
        b.innerHTML = html + '<div style="text-align:center; padding:20px; color:#94a3b8;">Belum ada skor tercatat. Jadilah juara Pacman pertama!</div>';
        return;
      }

      html += '<table style="width:100%; border-collapse:collapse;"><thead><tr><th style="text-align:left; padding:6px; color:#94a3b8; font-size:11px;">Rank</th><th style="text-align:left; padding:6px; color:#94a3b8; font-size:11px;">Pemain</th><th style="text-align:right; padding:6px; color:#94a3b8; font-size:11px;">Skor</th></tr></thead><tbody>';

      list.forEach(function (row) {
        var av = row.avatar ? '<img src="' + row.avatar + '" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">' : (row.username ? row.username.charAt(0).toUpperCase() : '👤');
        html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">' +
          '<td style="padding:8px 6px; font-weight:800; color:#facc15;">#' + row.rank + '</td>' +
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
    PacmanApp.init();
    window.PacmanApp = PacmanApp;
  });

})();
