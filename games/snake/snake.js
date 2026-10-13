/**
 * Snake Neon Arcade - Game Engine
 * Platform: game.dwicky.dev
 */

(function () {
  'use strict';

  var GRID_SIZE = 20; // 20x20 grid
  var CANVAS_SIZE = 400;
  var CELL_SIZE = CANVAS_SIZE / GRID_SIZE; // 20px per cell

  var SnakeGame = {
    canvas: null,
    ctx: null,

    // State
    snake: [],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 5, y: 5 },
    bonusFood: null,
    bonusTimer: 0,
    foodsEaten: 0,

    score: 0,
    highScore: 0,
    level: 1,
    speed: 130, // ms per tick

    isRunning: false,
    isPaused: false,
    gameLoopTimer: null,

    // Player
    username: 'Pemain Baru',
    avatar: '',

    init: function () {
      this.canvas = document.getElementById('snake-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      this.loadProfile();
      this.loadHighScore();
      this.cacheDom();
      this.bindEvents();
      this.updateProfileUI();

      this.resetGame();
      this.draw();
    },

    loadProfile: function () {
      try {
        var u = localStorage.getItem('user_profile_name') || localStorage.getItem('2048_username');
        if (u) this.username = u;
        var av = localStorage.getItem('user_profile_avatar') || localStorage.getItem('2048_avatar');
        if (av) this.avatar = av;
      } catch (e) {}
    },

    loadHighScore: function () {
      try {
        var hs = parseInt(localStorage.getItem('snake_best_score') || '0', 10);
        this.highScore = isNaN(hs) ? 0 : hs;
      } catch (e) {
        this.highScore = 0;
      }

      // Check server score
      var self = this;
      if (this.username && this.username !== 'Pemain Baru') {
        fetch('/api/leaderboard.php?game=snake&username=' + encodeURIComponent(this.username))
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data && data.player && data.player.best_score > self.highScore) {
              self.highScore = data.player.best_score;
              if (self.elHighScore) self.elHighScore.textContent = self.highScore.toLocaleString();
            }
          })
          .catch(function () {});
      }
    },

    cacheDom: function () {
      this.elCurrentScore = document.getElementById('current-score');
      this.elHighScore = document.getElementById('high-score');
      this.elSnakeLength = document.getElementById('snake-length');
      this.elSnakeLevel = document.getElementById('snake-level');

      this.overlayStart = document.getElementById('overlay-start');
      this.overlayGameOver = document.getElementById('overlay-gameover');
      this.goFinalScore = document.getElementById('go-final-score');
      this.goBestScore = document.getElementById('go-best-score');
      this.goNewRecord = document.getElementById('go-new-record');

      this.btnStart = document.getElementById('btn-start');
      this.btnRestart = document.getElementById('btn-restart');
      this.btnViewLeaderboard = document.getElementById('btn-view-leaderboard');
      this.btnSound = document.getElementById('btn-sound');
      this.btnLeaderboard = document.getElementById('btn-leaderboard');
      this.btnFullscreen = document.getElementById('btn-fullscreen');
      this.modalLeaderboard = document.getElementById('modal-leaderboard');
      this.toastEl = document.getElementById('toast-notification');

      this.navAvatarImg = document.getElementById('user-avatar-img');
      this.navAvatarText = document.getElementById('user-avatar-text');
      this.navUsername = document.getElementById('username-display');

      if (this.elHighScore) this.elHighScore.textContent = this.highScore.toLocaleString();
    },

    updateProfileUI: function () {
      if (this.navUsername) this.navUsername.textContent = this.username;
      if (this.avatar) {
        if (this.navAvatarImg) { this.navAvatarImg.src = this.avatar; this.navAvatarImg.style.display = 'block'; }
        if (this.navAvatarText) this.navAvatarText.style.display = 'none';
      } else {
        if (this.navAvatarImg) this.navAvatarImg.style.display = 'none';
        if (this.navAvatarText) {
          this.navAvatarText.textContent = this.username.charAt(0).toUpperCase() || '👤';
          this.navAvatarText.style.display = 'flex';
        }
      }

      if (this.btnSound && window.RetroAudio) {
        this.btnSound.textContent = window.RetroAudio.isEnabled() ? '🔊' : '🔇';
      }
    },

    bindEvents: function () {
      var self = this;

      // Start & Restart buttons
      if (this.btnStart) {
        this.btnStart.addEventListener('click', function () {
          self.startGame();
        });
      }
      if (this.btnRestart) {
        this.btnRestart.addEventListener('click', function () {
          self.startGame();
        });
      }

      // Sound toggle
      if (this.btnSound) {
        this.btnSound.addEventListener('click', function () {
          if (window.RetroAudio) {
            var enabled = window.RetroAudio.toggle();
            self.btnSound.textContent = enabled ? '🔊' : '🔇';
            self.showToast(enabled ? 'Suara Aktif 🔊' : 'Suara Dimatikan 🔇');
          }
        });
      }

      // Leaderboard modal
      if (this.btnLeaderboard) {
        this.btnLeaderboard.addEventListener('click', function () {
          self.openLeaderboard();
        });
      }
      if (this.btnViewLeaderboard) {
        this.btnViewLeaderboard.addEventListener('click', function () {
          self.openLeaderboard();
        });
      }

      // Fullscreen toggle
      if (this.btnFullscreen) {
        this.btnFullscreen.addEventListener('click', function () {
          self.toggleFullscreen();
        });
      }

      // Modal close
      document.querySelectorAll('.modal-close, .modal-backdrop').forEach(function (el) {
        el.addEventListener('click', function (e) {
          if (e.target === el) {
            var mb = el.classList.contains('modal-backdrop') ? el : el.closest('.modal-backdrop');
            if (mb) mb.style.display = 'none';
          }
        });
      });

      // Keyboard navigation
      window.addEventListener('keydown', function (e) {
        var key = e.key;
        if (['ArrowUp', 'w', 'W'].indexOf(key) !== -1) {
          e.preventDefault(); self.changeDirection(0, -1);
        } else if (['ArrowDown', 's', 'S'].indexOf(key) !== -1) {
          e.preventDefault(); self.changeDirection(0, 1);
        } else if (['ArrowLeft', 'a', 'A'].indexOf(key) !== -1) {
          e.preventDefault(); self.changeDirection(-1, 0);
        } else if (['ArrowRight', 'd', 'D'].indexOf(key) !== -1) {
          e.preventDefault(); self.changeDirection(1, 0);
        } else if (key === ' ' || key === 'p' || key === 'P') {
          e.preventDefault(); self.togglePause();
        }
      });

      // Virtual D-pad
      var btnUp = document.getElementById('dpad-up');
      var btnDown = document.getElementById('dpad-down');
      var btnLeft = document.getElementById('dpad-left');
      var btnRight = document.getElementById('dpad-right');
      var btnPause = document.getElementById('dpad-pause');

      if (btnUp) btnUp.addEventListener('click', function () { self.changeDirection(0, -1); });
      if (btnDown) btnDown.addEventListener('click', function () { self.changeDirection(0, 1); });
      if (btnLeft) btnLeft.addEventListener('click', function () { self.changeDirection(-1, 0); });
      if (btnRight) btnRight.addEventListener('click', function () { self.changeDirection(1, 0); });
      if (btnPause) btnPause.addEventListener('click', function () { self.togglePause(); });

      // Touch Swipe Gestures on Canvas & Wrapper
      var touchStartX = 0;
      var touchStartY = 0;
      var container = document.getElementById('canvas-container') || this.canvas;

      container.addEventListener('touchstart', function (e) {
        if (!e.touches || e.touches.length === 0) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      container.addEventListener('touchend', function (e) {
        if (!e.changedTouches || e.changedTouches.length === 0) return;
        var touchEndX = e.changedTouches[0].clientX;
        var touchEndY = e.changedTouches[0].clientY;

        var dx = touchEndX - touchStartX;
        var dy = touchEndY - touchStartY;
        var absDx = Math.abs(dx);
        var absDy = Math.abs(dy);

        // Min swipe distance 20px
        if (Math.max(absDx, absDy) < 20) return;

        if (absDx > absDy) {
          // Horizontal swipe
          if (dx > 0) self.changeDirection(1, 0);
          else self.changeDirection(-1, 0);
        } else {
          // Vertical swipe
          if (dy > 0) self.changeDirection(0, 1);
          else self.changeDirection(0, -1);
        }
      }, { passive: true });
    },

    resetGame: function () {
      this.snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
      ];
      this.dir = { x: 1, y: 0 };
      this.nextDir = { x: 1, y: 0 };
      this.score = 0;
      this.level = 1;
      this.foodsEaten = 0;
      this.speed = 130;
      this.bonusFood = null;
      this.bonusTimer = 0;

      this.spawnFood();
      this.updateStatsUI();
    },

    startGame: function () {
      this.resetGame();
      this.isRunning = true;
      this.isPaused = false;

      if (this.overlayStart) this.overlayStart.style.display = 'none';
      if (this.overlayGameOver) this.overlayGameOver.style.display = 'none';

      if (window.RetroAudio) window.RetroAudio.play('click');

      this.scheduleNextTick();
    },

    scheduleNextTick: function () {
      if (!this.isRunning) return;
      clearTimeout(this.gameLoopTimer);
      var self = this;
      this.gameLoopTimer = setTimeout(function () {
        self.tick();
      }, this.speed);
    },

    tick: function () {
      if (!this.isRunning || this.isPaused) return;

      this.dir = { x: this.nextDir.x, y: this.nextDir.y };

      // Head next position
      var head = this.snake[0];
      var newX = head.x + this.dir.x;
      var newY = head.y + this.dir.y;

      // Wall collision check
      if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) {
        this.gameOver();
        return;
      }

      // Self collision check
      for (var i = 0; i < this.snake.length; i++) {
        if (this.snake[i].x === newX && this.snake[i].y === newY) {
          this.gameOver();
          return;
        }
      }

      // Advance snake
      var newHead = { x: newX, y: newY };
      this.snake.unshift(newHead);

      // Check food collision
      var ateFood = false;
      if (newX === this.food.x && newY === this.food.y) {
        ateFood = true;
        this.foodsEaten++;
        this.score += 10;
        if (window.RetroAudio) window.RetroAudio.play('eat');

        // Ramp speed slightly every 4 foods
        if (this.foodsEaten % 4 === 0 && this.speed > 60) {
          this.speed -= 8;
          this.level++;
        }

        // Spawn bonus food every 5 foods
        if (this.foodsEaten % 5 === 0 && !this.bonusFood) {
          this.spawnBonusFood();
        }

        this.spawnFood();
      }

      // Check bonus food collision
      if (this.bonusFood && newX === this.bonusFood.x && newY === this.bonusFood.y) {
        ateFood = true;
        this.score += 50;
        this.bonusFood = null;
        if (window.RetroAudio) window.RetroAudio.play('bonus');
        this.showToast('+50 BONUS BINTANG! ⭐');
      }

      // Decay bonus food timer
      if (this.bonusFood) {
        this.bonusTimer--;
        if (this.bonusTimer <= 0) {
          this.bonusFood = null;
        }
      }

      // If didn't eat food, pop tail
      if (!ateFood) {
        this.snake.pop();
      }

      this.updateStatsUI();
      this.draw();

      this.scheduleNextTick();
    },

    changeDirection: function (dx, dy) {
      if (!this.isRunning) {
        this.startGame();
        return;
      }

      // Prevent 180-degree instant reversal
      if (dx !== 0 && this.dir.x !== 0) return;
      if (dy !== 0 && this.dir.y !== 0) return;

      this.nextDir = { x: dx, y: dy };
      if (window.RetroAudio) window.RetroAudio.play('turn');
    },

    togglePause: function () {
      if (!this.isRunning) return;
      this.isPaused = !this.isPaused;
      if (!this.isPaused) {
        this.scheduleNextTick();
        this.showToast('Lanjut Bermain ▶');
      } else {
        this.showToast('Game Dijeda (Pause) ⏸');
      }
    },

    spawnFood: function () {
      var valid = false;
      var fx = 0, fy = 0;
      var attempts = 0;

      while (!valid && attempts < 200) {
        attempts++;
        fx = Math.floor(Math.random() * GRID_SIZE);
        fy = Math.floor(Math.random() * GRID_SIZE);
        valid = true;

        for (var i = 0; i < this.snake.length; i++) {
          if (this.snake[i].x === fx && this.snake[i].y === fy) {
            valid = false;
            break;
          }
        }
        if (this.bonusFood && this.bonusFood.x === fx && this.bonusFood.y === fy) {
          valid = false;
        }
      }

      this.food = { x: fx, y: fy };
    },

    spawnBonusFood: function () {
      var bx = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
      var by = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
      this.bonusFood = { x: bx, y: by };
      this.bonusTimer = 45; // ~45 ticks duration
    },

    gameOver: function () {
      this.isRunning = false;
      clearTimeout(this.gameLoopTimer);

      if (window.RetroAudio) window.RetroAudio.play('gameover');

      var isNewRecord = this.score > this.highScore;
      if (isNewRecord) {
        this.highScore = this.score;
        try {
          localStorage.setItem('snake_best_score', this.highScore);
        } catch (e) {}
      }

      this.syncScoreToBackend(this.score);

      // Show Game Over Overlay
      if (this.goFinalScore) this.goFinalScore.textContent = this.score.toLocaleString();
      if (this.goBestScore) this.goBestScore.textContent = this.highScore.toLocaleString();
      if (this.goNewRecord) this.goNewRecord.style.display = isNewRecord ? 'inline-block' : 'none';
      if (this.overlayGameOver) this.overlayGameOver.style.display = 'flex';
    },

    syncScoreToBackend: function (score) {
      if (!this.username || this.username === 'Pemain Baru') return;

      fetch('/api/leaderboard.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: 'snake',
          username: this.username,
          score: score,
          avatar: this.avatar || ''
        })
      }).catch(function () {});
    },

    updateStatsUI: function () {
      if (this.elCurrentScore) this.elCurrentScore.textContent = this.score.toLocaleString();
      if (this.elHighScore) this.elHighScore.textContent = this.highScore.toLocaleString();
      if (this.elSnakeLength) this.elSnakeLength.textContent = this.snake.length;
      if (this.elSnakeLevel) this.elSnakeLevel.textContent = this.level;
    },

    draw: function () {
      var ctx = this.ctx;
      if (!ctx) return;

      // 1. Clear background
      ctx.fillStyle = '#060b13';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // 2. Subtle grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (var x = 0; x <= CANVAS_SIZE; x += CELL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_SIZE);
        ctx.stroke();
      }
      for (var y = 0; y <= CANVAS_SIZE; y += CELL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_SIZE, y);
        ctx.stroke();
      }

      // 3. Draw Normal Food (Glowing Emerald / Cyan Orb)
      var fx = this.food.x * CELL_SIZE + CELL_SIZE / 2;
      var fy = this.food.y * CELL_SIZE + CELL_SIZE / 2;
      var fRad = CELL_SIZE / 2 - 2;

      ctx.save();
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(fx, fy, fRad, 0, Math.PI * 2);
      ctx.fill();

      // Food shiny center
      ctx.fillStyle = '#a7f3d0';
      ctx.beginPath();
      ctx.arc(fx - 2, fy - 2, fRad / 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. Draw Bonus Food if active (Glowing Gold Star)
      if (this.bonusFood) {
        var bx = this.bonusFood.x * CELL_SIZE + CELL_SIZE / 2;
        var by = this.bonusFood.y * CELL_SIZE + CELL_SIZE / 2;
        var bRad = CELL_SIZE / 2 - 1;

        ctx.save();
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(bx, by, bRad, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', bx, by);
        ctx.restore();
      }

      // 5. Draw Snake Body & Head
      for (var i = this.snake.length - 1; i >= 0; i--) {
        var seg = this.snake[i];
        var sx = seg.x * CELL_SIZE;
        var sy = seg.y * CELL_SIZE;
        var isHead = (i === 0);

        ctx.save();
        if (isHead) {
          // Snake Head: Cyan Glow
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 14;
          ctx.fillStyle = '#06b6d4';
          this.roundRect(ctx, sx + 1, sy + 1, CELL_SIZE - 2, CELL_SIZE - 2, 6);
          ctx.fill();

          // Eyes
          ctx.fillStyle = '#0f172a';
          var eyeOffsetX = this.dir.x * 3;
          var eyeOffsetY = this.dir.y * 3;
          var eye1X = sx + CELL_SIZE / 2 + (this.dir.y !== 0 ? -4 : 0) + eyeOffsetX;
          var eye1Y = sy + CELL_SIZE / 2 + (this.dir.x !== 0 ? -4 : 0) + eyeOffsetY;
          var eye2X = sx + CELL_SIZE / 2 + (this.dir.y !== 0 ? 4 : 0) + eyeOffsetX;
          var eye2Y = sy + CELL_SIZE / 2 + (this.dir.x !== 0 ? 4 : 0) + eyeOffsetY;

          ctx.beginPath();
          ctx.arc(eye1X, eye1Y, 2.2, 0, Math.PI * 2);
          ctx.arc(eye2X, eye2Y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Snake Body: Gradient Emerald to Cyan
          var ratio = i / this.snake.length;
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 6;
          ctx.fillStyle = ratio < 0.5 ? '#10b981' : '#059669';
          this.roundRect(ctx, sx + 2, sy + 2, CELL_SIZE - 4, CELL_SIZE - 4, 4);
          ctx.fill();
        }
        ctx.restore();
      }
    },

    roundRect: function (ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    },

    openLeaderboard: function () {
      var self = this;
      if (!this.modalLeaderboard) return;
      var content = document.getElementById('leaderboard-content');
      this.modalLeaderboard.style.display = 'flex';

      if (content) content.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">Memuat data...</div>';

      fetch('/api/leaderboard.php?game=snake&username=' + encodeURIComponent(this.username))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!content) return;
          if (!data || !data.leaderboard || data.leaderboard.length === 0) {
            content.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">Belum ada rekor di Snake Neon. Jadilah yang pertama!</div>';
            return;
          }

          var html = '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
          html += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#94a3b8; text-align:left;">' +
                  '<th style="padding:8px 6px;">Rank</th>' +
                  '<th style="padding:8px 6px;">Pemain</th>' +
                  '<th style="padding:8px 6px; text-align:right;">Skor Rekor</th>' +
                  '</tr></thead><tbody>';

          data.leaderboard.forEach(function (row) {
            var medal = row.rank === 1 ? '🥇' : (row.rank === 2 ? '🥈' : (row.rank === 3 ? '🥉' : '#' + row.rank));
            var av = row.avatar ? '<img src="' + row.avatar + '" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">' :
                     '<div style="width:24px; height:24px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">' + (row.username ? row.username.charAt(0).toUpperCase() : '?') + '</div>';

            html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">' +
                    '<td style="padding:8px 6px; font-weight:800;">' + medal + '</td>' +
                    '<td style="padding:8px 6px;"><div style="display:flex; align-items:center; gap:8px;">' + av + '<span style="font-weight:700;">' + row.username + '</span></div></td>' +
                    '<td style="padding:8px 6px; text-align:right; font-weight:800; color:#10b981;">' + Number(row.best_score).toLocaleString() + '</td>' +
                    '</tr>';
          });

          html += '</tbody></table>';
          content.innerHTML = html;
        });
    },

    toggleFullscreen: function () {
      if (window.FullscreenSync) { window.FullscreenSync.toggle(); return; }
      var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (isFs) {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) ex.call(document);
      } else {
        var req = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
        if (req) req.call(document.documentElement);
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
      }, 2000);
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    SnakeGame.init();
    window.SnakeGame = SnakeGame;
  });

})();
