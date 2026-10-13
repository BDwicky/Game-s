/**
 * Tetris Classic - HTML5 Canvas Engine & Multi-Game Leaderboard
 * Platform: game.dwicky.dev
 */

(function () {
  'use strict';

  // --- Retro Sound Synthesizer (Web Audio API) ---
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
        gain.gain.setValueAtTime(vol || 0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
      } catch (e) {}
    },
    move: function () {
      this.init(); this.resume();
      this.tone(260, 'triangle', 0.05, 0.08);
    },
    rotate: function () {
      this.init(); this.resume();
      this.tone(440, 'triangle', 0.06, 0.1);
    },
    softDrop: function () {
      this.init(); this.resume();
      this.tone(180, 'sine', 0.04, 0.06);
    },
    hardDrop: function () {
      this.init(); this.resume();
      this.tone(130, 'sawtooth', 0.1, 0.15);
    },
    hold: function () {
      this.init(); this.resume();
      this.tone(360, 'sine', 0.08, 0.1);
    },
    lock: function () {
      this.init(); this.resume();
      this.tone(220, 'triangle', 0.07, 0.1);
    },
    lineClear: function (lines) {
      this.init(); this.resume();
      var self = this;
      if (lines >= 4) {
        // Tetris 4-Line Clear Fanfare
        [523, 659, 784, 1046].forEach(function (f, i) {
          setTimeout(function () { self.tone(f, 'square', 0.14, 0.14); }, i * 70);
        });
      } else {
        // Standard Line Clear
        [440, 587].forEach(function (f, i) {
          setTimeout(function () { self.tone(f, 'triangle', 0.1, 0.12); }, i * 80);
        });
      }
    },
    levelUp: function () {
      this.init(); this.resume();
      var self = this;
      [440, 554, 659, 880].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 'sine', 0.12, 0.15); }, i * 65);
      });
    },
    gameOver: function () {
      this.init(); this.resume();
      var self = this;
      [350, 310, 260, 190].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 'sawtooth', 0.18, 0.14); }, i * 110);
      });
    }
  };

  // --- 7 Classic Tetrominoes & Colors ---
  var SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    O: [
      [1, 1],
      [1, 1]
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  };

  var COLORS = {
    I: { base: '#06b6d4', light: '#67e8f9', dark: '#0891b2' },
    J: { base: '#3b82f6', light: '#93c5fd', dark: '#1d4ed8' },
    L: { base: '#f97316', light: '#fdba74', dark: '#c2410c' },
    O: { base: '#eab308', light: '#fde047', dark: '#a16207' },
    S: { base: '#22c55e', light: '#86efac', dark: '#15803d' },
    T: { base: '#a855f7', light: '#d8b4fe', dark: '#7e22ce' },
    Z: { base: '#ef4444', light: '#fca5a5', dark: '#b91c1c' }
  };

  var TetrisApp = {
    cols: 10,
    rows: 20,
    grid: [],

    // Game stats
    score: 0,
    highScore: 0,
    lines: 0,
    level: 1,

    // Active piece state
    currentPiece: null,
    nextPiece: null,
    heldPiece: null,
    canHold: true,

    // Timing & gravity
    dropInterval: 800,
    dropTimer: 0,
    lastTime: 0,
    lockDelay: 500,
    lockTimer: 0,
    isLocking: false,
    lockResets: 0,

    // Bag Randomizer
    bag: [],

    // State flags
    state: 0, // 0 = IDLE, 1 = PLAYING, 2 = GAMEOVER, 3 = PAUSED

    // Line clearing animation
    clearingRows: [],
    clearAnimTimer: 0,

    // Profile
    username: 'Pemain Baru',
    avatar: '',

    init: function () {
      this.loadProfile();
      this.cacheDom();
      this.bindEvents();
      this.resetGame();
      this.loop(0);
    },

    loadProfile: function () {
      try {
        var u = localStorage.getItem('user_profile_name') || localStorage.getItem('2048_username');
        if (u) this.username = u;
        var av = localStorage.getItem('user_profile_avatar') || localStorage.getItem('2048_avatar');
        if (av) this.avatar = av;
        var hs = localStorage.getItem('tetris_high_score');
        if (hs) this.highScore = parseInt(hs, 10) || 0;
      } catch (e) {}
    },

    saveProfile: function () {
      try {
        localStorage.setItem('user_profile_name', this.username);
        localStorage.setItem('user_profile_avatar', this.avatar);
        localStorage.setItem('tetris_high_score', this.highScore);
      } catch (e) {}
    },

    cacheDom: function () {
      this.canvasBoard = document.getElementById('canvas-board');
      this.ctxBoard = this.canvasBoard.getContext('2d');

      this.canvasHold = document.getElementById('canvas-hold');
      this.ctxHold = this.canvasHold.getContext('2d');

      this.canvasNext = document.getElementById('canvas-next');
      this.ctxNext = this.canvasNext.getContext('2d');

      // HUD elements
      this.scoreEl = document.getElementById('hud-score');
      this.linesEl = document.getElementById('hud-lines');
      this.levelEl = document.getElementById('hud-level');
      this.bestEl = document.getElementById('hud-best');

      // Overlays
      this.pauseOverlay = document.getElementById('pause-overlay');
      this.gameoverOverlay = document.getElementById('gameover-overlay');
      this.finalScoreEl = document.getElementById('final-score');
      this.finalLinesEl = document.getElementById('final-lines');
      this.finalBestEl = document.getElementById('final-best');
      this.medalIconEl = document.getElementById('medal-icon');

      // Profile Header
      this.userNameEl = document.getElementById('username-display');
      this.userAvatarImg = document.getElementById('user-avatar-img');
      this.userAvatarText = document.getElementById('user-avatar-text');

      // Modals
      this.modalLdb = document.getElementById('modal-leaderboard');
      this.modalUser = document.getElementById('modal-username');
      this.toastEl = document.getElementById('toast-notification');

      this.updateProfileUI();
      if (this.bestEl) this.bestEl.textContent = this.highScore;
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

      // Keyboard Controls
      window.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT') return;

        if (e.code === 'KeyP') {
          e.preventDefault();
          self.togglePause();
          return;
        }

        if (self.state !== 1) return;

        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault();
          self.movePiece(-1);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          self.movePiece(1);
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          e.preventDefault();
          self.softDrop();
        } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyX') {
          e.preventDefault();
          self.rotatePiece(1);
        } else if (e.code === 'KeyZ' || e.code === 'KeyQ') {
          e.preventDefault();
          self.rotatePiece(-1);
        } else if (e.code === 'Space') {
          e.preventDefault();
          self.hardDrop();
        } else if (e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          e.preventDefault();
          self.holdAction();
        }
      });

      // Touch Buttons with Auto-repeat
      var bindTouchBtn = function (id, action, isHoldable) {
        var btn = document.getElementById(id);
        if (!btn) return;

        var timer = null;
        var interval = null;

        var start = function (e) {
          if (e.cancelable) e.preventDefault();
          if (self.state !== 1) return;
          action();

          if (isHoldable) {
            timer = setTimeout(function () {
              interval = setInterval(function () {
                if (self.state === 1) action();
              }, 60);
            }, 180);
          }
        };

        var end = function (e) {
          if (e.cancelable) e.preventDefault();
          clearTimeout(timer);
          clearInterval(interval);
        };

        btn.addEventListener('touchstart', start, { passive: false });
        btn.addEventListener('touchend', end, { passive: false });
        btn.addEventListener('touchcancel', end, { passive: false });
        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseup', end);
        btn.addEventListener('mouseleave', end);
      };

      bindTouchBtn('touch-left', function () { self.movePiece(-1); }, true);
      bindTouchBtn('touch-right', function () { self.movePiece(1); }, true);
      bindTouchBtn('touch-down', function () { self.softDrop(); }, true);
      bindTouchBtn('touch-rotate', function () { self.rotatePiece(1); }, false);
      bindTouchBtn('touch-harddrop', function () { self.hardDrop(); }, false);
      bindTouchBtn('touch-hold', function () { self.holdAction(); }, false);

      // Mobile Touch Gestures on canvas
      var touchStartX = 0, touchStartY = 0, touchStartTime = 0;
      this.canvasBoard.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }, { passive: true });

      this.canvasBoard.addEventListener('touchend', function (e) {
        if (self.state !== 1) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        var dy = e.changedTouches[0].clientY - touchStartY;
        var dt = Date.now() - touchStartTime;
        var absX = Math.abs(dx);
        var absY = Math.abs(dy);

        // Tap = Rotate
        if (dt < 250 && absX < 15 && absY < 15) {
          self.rotatePiece(1);
          return;
        }

        // Swipes
        if (absX > absY && absX > 25) {
          if (dx > 0) self.movePiece(1);
          else self.movePiece(-1);
        } else if (absY > absX && absY > 25) {
          if (dy > 0) self.softDrop();
          else self.hardDrop(); // Swipe up = Hard drop
        }
      }, { passive: true });

      // Action Buttons
      var btnReset = document.getElementById('btn-reset');
      if (btnReset) btnReset.addEventListener('click', function () { self.resetGame(); });

      var btnResume = document.getElementById('btn-resume');
      if (btnResume) btnResume.addEventListener('click', function () { self.togglePause(); });

      var btnPlayAgain = document.getElementById('btn-play-again');
      if (btnPlayAgain) {
        btnPlayAgain.addEventListener('click', function () {
          self.gameoverOverlay.classList.remove('show');
          self.resetGame();
        });
      }

      var btnLdb = document.getElementById('btn-leaderboard');
      if (btnLdb) btnLdb.addEventListener('click', function () { self.openLeaderboard(); });

      var btnHome = document.getElementById('btn-home'); if (btnHome) btnHome.addEventListener('click', function (e) { if (window.parent && window.parent !== window) { e.preventDefault(); window.parent.postMessage({ type: 'close_game' }, '*'); } });
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

    resetGame: function () {
      // 10x20 empty board
      this.grid = [];
      for (var r = 0; r < this.rows; r++) {
        var row = [];
        for (var c = 0; c < this.cols; c++) {
          row.push(null);
        }
        this.grid.push(row);
      }

      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.dropInterval = 800;
      this.dropTimer = 0;
      this.lockTimer = 0;
      this.isLocking = false;
      this.heldPiece = null;
      this.canHold = true;
      this.bag = [];
      this.state = 1; // Playing
      this.clearingRows = [];

      this.nextPiece = this.generatePiece();
      this.spawnPiece();

      if (this.scoreEl) this.scoreEl.textContent = '0';
      if (this.linesEl) this.linesEl.textContent = '0';
      if (this.levelEl) this.levelEl.textContent = '1';
      if (this.pauseOverlay) this.pauseOverlay.classList.remove('show');
      if (this.gameoverOverlay) this.gameoverOverlay.classList.remove('show');

      this.drawHold();
      this.drawNext();
    },

    generatePiece: function () {
      if (this.bag.length === 0) {
        var pieces = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
        // Fisher-Yates Shuffle
        for (var i = pieces.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var temp = pieces[i];
          pieces[i] = pieces[j];
          pieces[j] = temp;
        }
        this.bag = pieces;
      }

      var type = this.bag.pop();
      var matrix = [];
      var template = SHAPES[type];
      for (var r = 0; r < template.length; r++) {
        matrix.push(template[r].slice());
      }

      return {
        type: type,
        matrix: matrix,
        color: COLORS[type],
        x: Math.floor((this.cols - matrix[0].length) / 2),
        y: type === 'I' ? -1 : 0
      };
    },

    spawnPiece: function () {
      this.currentPiece = this.nextPiece;
      this.nextPiece = this.generatePiece();
      this.canHold = true;
      this.isLocking = false;
      this.lockTimer = 0;
      this.lockResets = 0;

      // Check spawn collision -> Game Over
      if (!this.isValid(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
        this.handleGameOver();
      }

      this.drawNext();
    },

    isValid: function (matrix, offX, offY) {
      for (var r = 0; r < matrix.length; r++) {
        for (var c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c]) {
            var newX = offX + c;
            var newY = offY + r;

            // Boundaries
            if (newX < 0 || newX >= this.cols || newY >= this.rows) {
              return false;
            }
            // Overlap with existing placed blocks
            if (newY >= 0 && this.grid[newY][newX] !== null) {
              return false;
            }
          }
        }
      }
      return true;
    },

    movePiece: function (dir) {
      if (!this.currentPiece || this.state !== 1) return;
      if (this.isValid(this.currentPiece.matrix, this.currentPiece.x + dir, this.currentPiece.y)) {
        this.currentPiece.x += dir;
        Sound.move();
        if (this.isLocking && this.lockResets < 10) {
          this.lockTimer = 0;
          this.lockResets++;
        }
      }
    },

    softDrop: function () {
      if (!this.currentPiece || this.state !== 1) return;
      if (this.isValid(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
        this.currentPiece.y += 1;
        this.score += 1;
        if (this.scoreEl) this.scoreEl.textContent = this.score;
        Sound.softDrop();
      } else {
        this.lockPiece();
      }
    },

    hardDrop: function () {
      if (!this.currentPiece || this.state !== 1) return;
      var ghostY = this.getGhostY();
      var droppedRows = ghostY - this.currentPiece.y;
      this.currentPiece.y = ghostY;
      this.score += droppedRows * 2;
      if (this.scoreEl) this.scoreEl.textContent = this.score;
      Sound.hardDrop();
      this.lockPiece();
    },

    rotatePiece: function (dir) {
      if (!this.currentPiece || this.state !== 1) return;
      var matrix = this.currentPiece.matrix;
      var N = matrix.length;
      var rotated = [];

      for (var r = 0; r < N; r++) {
        rotated.push([]);
        for (var c = 0; c < N; c++) {
          if (dir > 0) {
            // 90 deg clockwise
            rotated[r][c] = matrix[N - 1 - c][r];
          } else {
            // 90 deg counter-clockwise
            rotated[r][c] = matrix[c][N - 1 - r];
          }
        }
      }

      // Wall-kick offsets: [0, 0], [-1, 0], [+1, 0], [-2, 0], [+2, 0], [0, -1]
      var kicks = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];
      for (var i = 0; i < kicks.length; i++) {
        var kx = kicks[i][0];
        var ky = kicks[i][1];
        if (this.isValid(rotated, this.currentPiece.x + kx, this.currentPiece.y + ky)) {
          this.currentPiece.matrix = rotated;
          this.currentPiece.x += kx;
          this.currentPiece.y += ky;
          Sound.rotate();
          if (this.isLocking && this.lockResets < 10) {
            this.lockTimer = 0;
            this.lockResets++;
          }
          return;
        }
      }
    },

    holdAction: function () {
      if (!this.canHold || !this.currentPiece || this.state !== 1) return;

      var currentType = this.currentPiece.type;
      Sound.hold();

      if (!this.heldPiece) {
        this.heldPiece = currentType;
        this.spawnPiece();
      } else {
        var temp = this.heldPiece;
        this.heldPiece = currentType;

        // Create piece from held type
        var template = SHAPES[temp];
        var matrix = [];
        for (var r = 0; r < template.length; r++) {
          matrix.push(template[r].slice());
        }

        this.currentPiece = {
          type: temp,
          matrix: matrix,
          color: COLORS[temp],
          x: Math.floor((this.cols - matrix[0].length) / 2),
          y: temp === 'I' ? -1 : 0
        };
      }

      this.canHold = false;
      this.drawHold();
    },

    getGhostY: function () {
      if (!this.currentPiece) return 0;
      var testY = this.currentPiece.y;
      while (this.isValid(this.currentPiece.matrix, this.currentPiece.x, testY + 1)) {
        testY++;
      }
      return testY;
    },

    lockPiece: function () {
      if (!this.currentPiece) return;
      var m = this.currentPiece.matrix;
      var color = this.currentPiece.color;

      for (var r = 0; r < m.length; r++) {
        for (var c = 0; c < m[r].length; c++) {
          if (m[r][c]) {
            var gy = this.currentPiece.y + r;
            var gx = this.currentPiece.x + c;
            if (gy >= 0 && gy < this.rows && gx >= 0 && gx < this.cols) {
              this.grid[gy][gx] = color;
            }
          }
        }
      }

      Sound.lock();
      this.currentPiece = null;

      // Check full lines
      this.checkLineClears();
    },

    checkLineClears: function () {
      var fullRows = [];
      for (var r = 0; r < this.rows; r++) {
        var full = true;
        for (var c = 0; c < this.cols; c++) {
          if (this.grid[r][c] === null) {
            full = false;
            break;
          }
        }
        if (full) fullRows.push(r);
      }

      if (fullRows.length > 0) {
        this.clearingRows = fullRows;
        this.clearAnimTimer = 8; // Flash animation frames
        Sound.lineClear(fullRows.length);
      } else {
        this.spawnPiece();
      }
    },

    finishLineClears: function () {
      var linesCount = this.clearingRows.length;
      if (linesCount === 0) return;

      // Remove cleared rows and push empty rows on top
      for (var i = 0; i < linesCount; i++) {
        var r = this.clearingRows[i];
        this.grid.splice(r, 1);
        var emptyRow = [];
        for (var c = 0; c < this.cols; c++) emptyRow.push(null);
        this.grid.unshift(emptyRow);
      }

      // Standard Tetris Guideline Scoring
      var lineScores = { 1: 100, 2: 300, 3: 500, 4: 800 };
      var baseScore = lineScores[linesCount] || (linesCount * 200);
      this.score += baseScore * this.level;
      this.lines += linesCount;

      // Level Progression (Level increases every 10 lines)
      var prevLevel = this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      if (this.level > prevLevel) {
        Sound.levelUp();
        this.showToast('Level ' + this.level + '! Kecepatan meningkat');
      }

      // Drop Interval calculation
      this.dropInterval = Math.max(100, 800 - (this.level - 1) * 70);

      if (this.scoreEl) this.scoreEl.textContent = this.score;
      if (this.linesEl) this.linesEl.textContent = this.lines;
      if (this.levelEl) this.levelEl.textContent = this.level;

      if (linesCount === 4) {
        this.showToast('🔥 TETRIS! + ' + (baseScore * prevLevel) + ' Poin');
      }

      this.clearingRows = [];
      this.spawnPiece();
    },

    togglePause: function () {
      if (this.state === 1) {
        this.state = 3;
        if (this.pauseOverlay) this.pauseOverlay.classList.add('show');
      } else if (this.state === 3) {
        this.state = 1;
        if (this.pauseOverlay) this.pauseOverlay.classList.remove('show');
      }
    },

    handleGameOver: function () {
      this.state = 2; // Game Over
      Sound.gameOver();

      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.saveProfile();
      }

      // Post score to Multi-Game Leaderboard
      this.syncScoreToBackend(this.score);

      // Determine Medal
      var medal = '🥉';
      if (this.score >= 20000) medal = '💎';
      else if (this.score >= 10000) medal = '🥇';
      else if (this.score >= 5000) medal = '🥈';
      else if (this.score < 1000) medal = '⭐';

      if (this.finalScoreEl) this.finalScoreEl.textContent = this.score;
      if (this.finalLinesEl) this.finalLinesEl.textContent = this.lines;
      if (this.finalBestEl) this.finalBestEl.textContent = this.highScore;
      if (this.medalIconEl) this.medalIconEl.textContent = medal;

      if (this.gameoverOverlay) this.gameoverOverlay.classList.add('show');
    },

    update: function (dt) {
      if (this.state !== 1) return;

      // Handle Line Clear Animation
      if (this.clearingRows.length > 0) {
        this.clearAnimTimer--;
        if (this.clearAnimTimer <= 0) {
          this.finishLineClears();
        }
        return;
      }

      if (!this.currentPiece) return;

      // Gravity Drop Timer
      this.dropTimer += dt;
      if (this.dropTimer >= this.dropInterval) {
        this.dropTimer = 0;
        if (this.isValid(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
          this.currentPiece.y += 1;
          this.isLocking = false;
        } else {
          this.isLocking = true;
        }
      }

      // Lock Delay Logic
      if (this.isLocking) {
        this.lockTimer += dt;
        if (this.lockTimer >= this.lockDelay) {
          this.lockPiece();
        }
      }
    },

    draw: function () {
      var ctx = this.ctxBoard;
      var w = this.canvasBoard.width;
      var h = this.canvasBoard.height;
      var cell = w / this.cols; // 24px per cell

      // Clear Board
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // Draw Grid Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (var c = 1; c < this.cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cell, 0);
        ctx.lineTo(c * cell, h);
        ctx.stroke();
      }
      for (var r = 1; r < this.rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cell);
        ctx.lineTo(w, r * cell);
        ctx.stroke();
      }

      // Draw Placed Grid Blocks
      for (var row = 0; row < this.rows; row++) {
        var isClearing = this.clearingRows.indexOf(row) !== -1;
        for (var col = 0; col < this.cols; col++) {
          var color = this.grid[row][col];
          if (color) {
            if (isClearing) {
              // Flash white during line clear
              this.drawBlock(ctx, col * cell, row * cell, cell, { base: '#ffffff', light: '#ffffff', dark: '#cbd5e1' });
            } else {
              this.drawBlock(ctx, col * cell, row * cell, cell, color);
            }
          }
        }
      }

      // Draw Ghost Piece (Drop Projection Guide)
      if (this.currentPiece && this.state === 1 && this.clearingRows.length === 0) {
        var ghostY = this.getGhostY();
        var gm = this.currentPiece.matrix;
        var gc = this.currentPiece.color;

        for (var gr = 0; gr < gm.length; gr++) {
          for (var gc_idx = 0; gc_idx < gm[gr].length; gc_idx++) {
            if (gm[gr][gc_idx]) {
              var gx = (this.currentPiece.x + gc_idx) * cell;
              var gy = (ghostY + gr) * cell;
              if (gy >= 0) {
                this.drawGhostBlock(ctx, gx, gy, cell, gc);
              }
            }
          }
        }
      }

      // Draw Active Piece
      if (this.currentPiece && this.clearingRows.length === 0) {
        var m = this.currentPiece.matrix;
        var col = this.currentPiece.color;

        for (var r = 0; r < m.length; r++) {
          for (var c = 0; c < m[r].length; c++) {
            if (m[r][c]) {
              var px = (this.currentPiece.x + c) * cell;
              var py = (this.currentPiece.y + r) * cell;
              if (py >= 0) {
                this.drawBlock(ctx, px, py, cell, col);
              }
            }
          }
        }
      }
    },

    // 3D Beveled Block Renderer
    drawBlock: function (ctx, x, y, size, color) {
      var p = 1.5;
      var innerSize = size - p * 2;

      // Base
      ctx.fillStyle = color.base;
      ctx.fillRect(x + p, y + p, innerSize, innerSize);

      // Top & Left Highlight
      ctx.fillStyle = color.light;
      ctx.beginPath();
      ctx.moveTo(x + p, y + p);
      ctx.lineTo(x + size - p, y + p);
      ctx.lineTo(x + size - p - 3, y + p + 3);
      ctx.lineTo(x + p + 3, y + p + 3);
      ctx.lineTo(x + p + 3, y + size - p - 3);
      ctx.lineTo(x + p, y + size - p);
      ctx.closePath();
      ctx.fill();

      // Bottom & Right Shadow
      ctx.fillStyle = color.dark;
      ctx.beginPath();
      ctx.moveTo(x + size - p, y + p);
      ctx.lineTo(x + size - p, y + size - p);
      ctx.lineTo(x + p, y + size - p);
      ctx.lineTo(x + p + 3, y + size - p - 3);
      ctx.lineTo(x + size - p - 3, y + size - p - 3);
      ctx.lineTo(x + size - p - 3, y + p + 3);
      ctx.closePath();
      ctx.fill();
    },

    drawGhostBlock: function (ctx, x, y, size, color) {
      var p = 2;
      ctx.strokeStyle = color.base;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + p, y + p, size - p * 2, size - p * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(x + p, y + p, size - p * 2, size - p * 2);
    },

    drawPreview: function (ctx, canvas, pieceType) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!pieceType) return;

      var shape = SHAPES[pieceType];
      var color = COLORS[pieceType];
      var cellSize = 16;
      var w = shape[0].length * cellSize;
      var h = shape.length * cellSize;
      var startX = (canvas.width - w) / 2;
      var startY = (canvas.height - h) / 2;

      for (var r = 0; r < shape.length; r++) {
        for (var c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            this.drawBlock(ctx, startX + c * cellSize, startY + r * cellSize, cellSize, color);
          }
        }
      }
    },

    drawNext: function () {
      if (this.nextPiece) {
        this.drawPreview(this.ctxNext, this.canvasNext, this.nextPiece.type);
      }
    },

    drawHold: function () {
      this.drawPreview(this.ctxHold, this.canvasHold, this.heldPiece);
    },

    loop: function (timestamp) {
      var self = this;
      if (!timestamp) timestamp = performance.now();
      if (!this.lastTime) this.lastTime = timestamp;
      var dt = timestamp - this.lastTime;
      this.lastTime = timestamp;

      if (dt > 100) dt = 100;
      if (dt < 0) dt = 0;

      this.update(dt);
      this.draw();

      requestAnimationFrame(function (ts) { self.loop(ts); });
    },

    syncScoreToBackend: function (sc) {
      fetch('/api/leaderboard.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: 'tetris',
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
      if (b) b.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">Memuat peringkat Tetris...</div>';

      fetch('/api/leaderboard.php?game=tetris&username=' + encodeURIComponent(this.username))
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
          '<div style="background:#a855f7; color:#fff; font-size:12px; font-weight:800; padding:4px 10px; border-radius:20px;">Rank #' + (player.rank || '-') + '</div>' +
          '</div>';
      }

      if (!list || list.length === 0) {
        b.innerHTML = html + '<div style="text-align:center; padding:20px; color:#94a3b8;">Belum ada skor tercatat. Jadilah juara Tetris pertama!</div>';
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
    TetrisApp.init();
    window.TetrisApp = TetrisApp;
  });

})();
