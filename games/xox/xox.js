/**
 * X O X (Tic-Tac-Toe) - Minimax AI & Leaderboard Engine
 * Platform: game.dwicky.dev
 */

(function () {
  'use strict';

  // --- Sound Synthesizer ---
  var Sound = {
    ctx: null,
    enabled: true,

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
        gain.gain.setValueAtTime(vol || 0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
      } catch (e) {}
    },
    markX: function () {
      this.init(); this.resume();
      this.tone(523.25, 'triangle', 0.1, 0.15); // C5
    },
    markO: function () {
      this.init(); this.resume();
      this.tone(659.25, 'triangle', 0.1, 0.15); // E5
    },
    win: function () {
      this.init(); this.resume();
      var self = this;
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 'sine', 0.25, 0.2); }, i * 80);
      });
    },
    draw: function () {
      this.init(); this.resume();
      this.tone(260, 'sawtooth', 0.25, 0.1);
    }
  };

  var WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];

  var XoxApp = {
    board: Array(9).fill(''),
    turn: 'X', // 'X' or 'O'
    mode: 'ai', // 'ai' or 'pvp'
    difficulty: 'impossible', // 'easy', 'medium', 'impossible'
    gameOver: false,
    isAiThinking: false,

    // Stats
    winsX: 0,
    winsO: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,

    // Shared Profile
    username: 'Pemain Baru',
    avatar: '',

    init: function () {
      this.loadProfile();
      this.cacheDom();
      this.bindEvents();
      this.resetRound();
    },

    loadProfile: function () {
      try {
        var u = localStorage.getItem('user_profile_name') || localStorage.getItem('2048_username');
        if (u) this.username = u;
        var av = localStorage.getItem('user_profile_avatar') || localStorage.getItem('2048_avatar');
        if (av) this.avatar = av;
        var s = localStorage.getItem('xox_best_streak');
        if (s) this.bestStreak = parseInt(s, 10) || 0;
      } catch (e) {}
    },

    saveProfile: function () {
      try {
        localStorage.setItem('user_profile_name', this.username);
        localStorage.setItem('user_profile_avatar', this.avatar);
        localStorage.setItem('xox_best_streak', this.bestStreak);
      } catch (e) {}
    },

    cacheDom: function () {
      this.cells = document.querySelectorAll('.grid-cell');
      this.turnTextEl = document.getElementById('turn-text');
      this.turnSymbolEl = document.getElementById('turn-symbol');

      this.statWinsXEl = document.getElementById('stat-wins-x');
      this.statWinsOEl = document.getElementById('stat-wins-o');
      this.statDrawsEl = document.getElementById('stat-draws');

      this.modeAiBtn = document.getElementById('btn-mode-ai');
      this.modePvpBtn = document.getElementById('btn-mode-pvp');
      this.diffSelect = document.getElementById('select-difficulty');

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

      this.cells.forEach(function (cell, idx) {
        cell.addEventListener('click', function () {
          self.handleCellClick(idx);
        });
      });

      // Mode toggles
      if (this.modeAiBtn) {
        this.modeAiBtn.addEventListener('click', function () {
          self.mode = 'ai';
          self.modeAiBtn.classList.add('active');
          self.modePvpBtn.classList.remove('active');
          if (self.diffSelect) self.diffSelect.style.display = 'inline-block';
          self.resetRound();
        });
      }

      if (this.modePvpBtn) {
        this.modePvpBtn.addEventListener('click', function () {
          self.mode = 'pvp';
          self.modePvpBtn.classList.add('active');
          self.modeAiBtn.classList.remove('active');
          if (self.diffSelect) self.diffSelect.style.display = 'none';
          self.resetRound();
        });
      }

      if (this.diffSelect) {
        this.diffSelect.addEventListener('change', function () {
          self.difficulty = self.diffSelect.value;
          self.resetRound();
        });
      }

      // Action buttons
      var btnReset = document.getElementById('btn-reset');
      if (btnReset) btnReset.addEventListener('click', function () { self.resetRound(); });

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
    },

    resetRound: function () {
      this.board = Array(9).fill('');
      this.turn = 'X';
      this.gameOver = false;
      this.isAiThinking = false;

      this.cells.forEach(function (cell) {
        cell.textContent = '';
        cell.className = 'grid-cell';
      });

      this.updateTurnUI();
    },

    updateTurnUI: function (winnerText) {
      if (winnerText) {
        if (this.turnTextEl) this.turnTextEl.textContent = winnerText;
        if (this.turnSymbolEl) this.turnSymbolEl.textContent = '🎉';
        return;
      }

      if (this.turnSymbolEl) {
        this.turnSymbolEl.textContent = this.turn;
        this.turnSymbolEl.className = 'turn-symbol ' + (this.turn === 'X' ? 'x' : 'o');
      }

      if (this.turnTextEl) {
        if (this.mode === 'ai') {
          this.turnTextEl.textContent = (this.turn === 'X') ? 'Giliran Kamu (X)' : 'AI sedang berpikir...';
        } else {
          this.turnTextEl.textContent = 'Giliran Pemain ' + this.turn;
        }
      }
    },

    handleCellClick: function (idx) {
      if (this.gameOver || this.isAiThinking || this.board[idx] !== '') return;

      this.placeMark(idx, this.turn);

      var winResult = this.checkWin(this.board);
      if (winResult) {
        this.handleGameEnd(winResult.winner, winResult.line);
        return;
      }

      if (this.isBoardFull(this.board)) {
        this.handleGameEnd('draw');
        return;
      }

      // Switch turn
      this.turn = (this.turn === 'X') ? 'O' : 'X';
      this.updateTurnUI();

      // Trigger AI turn if applicable
      if (this.mode === 'ai' && this.turn === 'O') {
        var self = this;
        this.isAiThinking = true;
        setTimeout(function () {
          self.makeAiMove();
        }, 350);
      }
    },

    placeMark: function (idx, mark) {
      this.board[idx] = mark;
      var cell = this.cells[idx];
      cell.textContent = mark;
      cell.classList.add('taken', mark === 'X' ? 'cell-x' : 'cell-o');
      if (mark === 'X') Sound.markX(); else Sound.markO();
    },

    makeAiMove: function () {
      if (this.gameOver) return;

      var bestMove = null;
      if (this.difficulty === 'easy') {
        bestMove = this.getRandomMove();
      } else if (this.difficulty === 'medium') {
        // Blocks win or seizes win, else random
        bestMove = this.getWinningMove('O') || this.getWinningMove('X') || this.getRandomMove();
      } else {
        // Impossible: Perfect Minimax
        bestMove = this.getMinimaxMove();
      }

      this.isAiThinking = false;
      if (bestMove !== null && bestMove !== undefined) {
        this.handleCellClick(bestMove);
      }
    },

    getRandomMove: function () {
      var available = [];
      this.board.forEach(function (v, i) { if (v === '') available.push(i); });
      return available[Math.floor(Math.random() * available.length)];
    },

    getWinningMove: function (mark) {
      for (var i = 0; i < 9; i++) {
        if (this.board[i] === '') {
          this.board[i] = mark;
          var res = this.checkWin(this.board);
          this.board[i] = '';
          if (res && res.winner === mark) return i;
        }
      }
      return null;
    },

    getMinimaxMove: function () {
      var bestScore = -Infinity;
      var move = null;
      for (var i = 0; i < 9; i++) {
        if (this.board[i] === '') {
          this.board[i] = 'O';
          var score = this.minimax(this.board, 0, false);
          this.board[i] = '';
          if (score > bestScore) {
            bestScore = score;
            move = i;
          }
        }
      }
      return move;
    },

    minimax: function (board, depth, isMaximizing) {
      var res = this.checkWin(board);
      if (res) {
        return (res.winner === 'O') ? (10 - depth) : (depth - 10);
      }
      if (this.isBoardFull(board)) return 0;

      if (isMaximizing) {
        var maxScore = -Infinity;
        for (var i = 0; i < 9; i++) {
          if (board[i] === '') {
            board[i] = 'O';
            var s = this.minimax(board, depth + 1, false);
            board[i] = '';
            maxScore = Math.max(s, maxScore);
          }
        }
        return maxScore;
      } else {
        var minScore = Infinity;
        for (var j = 0; j < 9; j++) {
          if (board[j] === '') {
            board[j] = 'X';
            var s2 = this.minimax(board, depth + 1, true);
            board[j] = '';
            minScore = Math.min(s2, minScore);
          }
        }
        return minScore;
      }
    },

    checkWin: function (board) {
      for (var i = 0; i < WIN_LINES.length; i++) {
        var line = WIN_LINES[i];
        var a = board[line[0]], b = board[line[1]], c = board[line[2]];
        if (a && a === b && a === c) {
          return { winner: a, line: line };
        }
      }
      return null;
    },

    isBoardFull: function (board) {
      return board.every(function (v) { return v !== ''; });
    },

    handleGameEnd: function (winner, line) {
      this.gameOver = true;

      if (winner === 'draw') {
        Sound.draw();
        this.draws++;
        if (this.statDrawsEl) this.statDrawsEl.textContent = this.draws;
        this.updateTurnUI('Permainan Seri!');
        this.showToast('Pertandingan Berakhir Seri!');
        return;
      }

      Sound.win();
      var self = this;
      if (line) {
        line.forEach(function (idx) {
          self.cells[idx].classList.add('winning-cell');
        });
      }

      if (winner === 'X') {
        this.winsX++;
        this.streak++;
        if (this.streak > this.bestStreak) {
          this.bestStreak = this.streak;
          this.saveProfile();
        }
        if (this.statWinsXEl) this.statWinsXEl.textContent = this.winsX;
        this.updateTurnUI('Pemain X Menang!');
        this.showToast('Kemenangan untuk X! Streak: ' + this.streak);

        // Sync Leaderboard score (Streak * 100 + Wins * 50)
        var totalScore = (this.bestStreak * 100) + (this.winsX * 50);
        this.syncScoreToBackend(totalScore);
      } else {
        this.winsO++;
        this.streak = 0;
        if (this.statWinsOEl) this.statWinsOEl.textContent = this.winsO;
        this.updateTurnUI(this.mode === 'ai' ? 'AI Menang!' : 'Pemain O Menang!');
        this.showToast(this.mode === 'ai' ? 'AI Mengalahkanmu!' : 'Kemenangan untuk O!');
      }
    },

    syncScoreToBackend: function (score) {
      fetch('/api/leaderboard.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: 'xox',
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
      if (b) b.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">Memuat peringkat X O X...</div>';

      fetch('/api/leaderboard.php?game=xox&username=' + encodeURIComponent(this.username))
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
          '<span style="font-size:12px; color:#94a3b8;">Poin Pertempuran: <strong>' + (player.best_score || 0) + '</strong></span></div>' +
          '<div style="background:#06b6d4; color:#000; font-size:12px; font-weight:800; padding:4px 10px; border-radius:20px;">Rank #' + (player.rank || '-') + '</div>' +
          '</div>';
      }

      if (!list || list.length === 0) {
        b.innerHTML = html + '<div style="text-align:center; padding:20px; color:#94a3b8;">Belum ada skor tercatat. Menangkan putaran pertama!</div>';
        return;
      }

      html += '<table style="width:100%; border-collapse:collapse;"><thead><tr><th style="text-align:left; padding:6px; color:#94a3b8; font-size:11px;">Rank</th><th style="text-align:left; padding:6px; color:#94a3b8; font-size:11px;">Pemain</th><th style="text-align:right; padding:6px; color:#94a3b8; font-size:11px;">Poin</th></tr></thead><tbody>';

      list.forEach(function (row) {
        var av = row.avatar ? '<img src="' + row.avatar + '" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">' : (row.username ? row.username.charAt(0).toUpperCase() : '👤');
        html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">' +
          '<td style="padding:8px 6px; font-weight:800; color:#06b6d4;">#' + row.rank + '</td>' +
          '<td style="padding:8px 6px;"><div style="display:flex; align-items:center; gap:8px;">' + av + '<span>' + row.username + '</span></div></td>' +
          '<td style="padding:8px 6px; text-align:right; font-weight:700; color:#f43f5e;">' + row.best_score + '</td>' +
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
    XoxApp.init();
    window.XoxApp = XoxApp;
  });

})();
