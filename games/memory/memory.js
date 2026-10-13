/**
 * Memory Match - Platform Logic & Shared Leaderboard
 * Platform: game.dwicky.dev
 */

(function () {
  'use strict';

  // --- Web Audio Synthesizer (No external sound files required) ---
  var SoundSystem = {
    ctx: null,
    enabled: true,

    init: function () { try { this.enabled = localStorage.getItem("game_hub_sound_muted") !== "true"; } catch (e) { this.enabled = true; }
      if (!this.ctx) {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
    },

    resume: function () {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    playTone: function (freq, type, duration, startVol) {
      if (!this.enabled || !this.ctx) return;
      try {
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(startVol || 0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    },

    flip: function () {
      this.init();
      this.resume();
      this.playTone(480, 'sine', 0.1, 0.12);
    },

    match: function () {
      this.init();
      this.resume();
      var self = this;
      this.playTone(587.33, 'triangle', 0.15, 0.15); // D5
      setTimeout(function () {
        self.playTone(880, 'triangle', 0.25, 0.18); // A5
      }, 100);
    },

    combo: function (streak) {
      this.init();
      this.resume();
      var baseFreq = 523.25; // C5
      var semitone = Math.pow(2, (streak * 2) / 12);
      this.playTone(baseFreq * semitone, 'sine', 0.25, 0.2);
    },

    mismatch: function () {
      this.init();
      this.resume();
      this.playTone(220, 'sawtooth', 0.15, 0.08);
    },

    win: function () {
      this.init();
      this.resume();
      var notes = [523.25, 659.25, 783.99, 1046.5];
      var self = this;
      notes.forEach(function (n, i) {
        setTimeout(function () {
          self.playTone(n, 'triangle', 0.35, 0.25);
        }, i * 120);
      });
    }
  };

  // --- Themes & Emojis ---
  var CardThemes = {
    gaming: ['🎮', '🕹️', '👾', '💎', '👑', '⭐', '🔥', '🚀', '💣', '🛡️', '⚡', '🏆', '🎯', '🎲', '🎪', '🪐', '🔮', '✨'],
    food:    ['🍕', '🍔', '🍟', '🍣', '🍩', '🍦', '🍓', '🥑', '🌮', '🥞', '🍉', '🍿', '🧁', '🍰', '🍪', '🍫', '🍇', '🍒'],
    animals: ['🐶', '🐱', '🐼', '🦊', '🦁', '🐯', '🐰', '🐨', '🐵', '🐸', '🐙', '🦄', '🐬', '🦉', '🦋', '🐝', '🦖', '🐢'],
    tech:    ['💻', '📱', '⌨️', '🖱️', '🤖', '🛰️', '🎧', '📷', '🔋', '📡', '💾', '💡', '🔬', '⚙️', '🔍', '🚀', '🛸', '🖥️']
  };

  var DifficultyConfig = {
    12: { pairs: 6,  cols: 4, rows: 3, mult: 1.0, baseTime: 45 },
    16: { pairs: 8,  cols: 4, rows: 4, mult: 1.2, baseTime: 60 },
    24: { pairs: 12, cols: 6, rows: 4, mult: 1.5, baseTime: 90 },
    36: { pairs: 18, cols: 6, rows: 6, mult: 2.0, baseTime: 140 }
  };

  // --- Memory Game Core Controller ---
  var MemoryGame = {
    cardCount: 16,
    theme: 'gaming',
    cards: [],
    flippedCards: [],
    matchedCount: 0,
    moves: 0,
    score: 0,
    combo: 0,
    startTime: null,
    timerInterval: null,
    isProcessing: false,
    soundOn: true,

    // Profile storage synced with 2048
    username: 'Pemain Baru',
    avatar: '',
    bestScore: 0,

    init: function () {
      this.loadSharedProfile();
      this.cacheDom();
      this.bindEvents();
      this.startNewGame();
    },

    loadSharedProfile: function () {
      try {
        var savedUser = localStorage.getItem('user_profile_name') || localStorage.getItem('2048_username');
        if (savedUser) this.username = savedUser;

        var savedAv = localStorage.getItem('user_profile_avatar') || localStorage.getItem('2048_avatar');
        if (savedAv) this.avatar = savedAv;

        var savedBest = localStorage.getItem('memory_best_score');
        if (savedBest) this.bestScore = parseInt(savedBest, 10) || 0;
      } catch (e) {}
    },

    saveSharedProfile: function () {
      try {
        localStorage.setItem('user_profile_name', this.username);
        localStorage.setItem('user_profile_avatar', this.avatar);
        localStorage.setItem('memory_best_score', this.bestScore);
      } catch (e) {}
    },

    cacheDom: function () {
      this.boardEl        = document.getElementById('cards-grid');
      this.timerEl        = document.getElementById('stat-timer');
      this.movesEl        = document.getElementById('stat-moves');
      this.scoreEl        = document.getElementById('stat-score');
      this.comboEl        = document.getElementById('stat-combo');
      this.themeSelect    = document.getElementById('select-theme');
      this.winOverlay     = document.getElementById('win-overlay');

      // Profile Header Elements
      this.userBadgeEl    = document.getElementById('user-badge');
      this.userNameEl     = document.getElementById('username-display');
      this.userAvatarImg  = document.getElementById('user-avatar-img');
      this.userAvatarText = document.getElementById('user-avatar-text');

      // Modals
      this.modalHub       = document.getElementById('modal-games-hub');
      this.modalLdb       = document.getElementById('modal-leaderboard');
      this.modalUser      = document.getElementById('modal-username');
      this.toastEl        = document.getElementById('toast-notification');

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

      // Difficulty buttons
      var diffBtns = document.querySelectorAll('.diff-btn');
      diffBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          diffBtns.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          self.cardCount = parseInt(btn.getAttribute('data-cards'), 10);
          self.startNewGame();
        });
      });

      // Theme selector
      if (this.themeSelect) {
        this.themeSelect.addEventListener('change', function () {
          self.theme = self.themeSelect.value;
          self.startNewGame();
        });
      }

      // Action Buttons
      var btnReset = document.getElementById('btn-reset');
      if (btnReset) btnReset.addEventListener('click', function () { self.startNewGame(); });

      var btnSound = document.getElementById('btn-sound');
      if (btnSound) {
        btnSound.addEventListener('click', function () {
          self.soundOn = !self.soundOn;
          SoundSystem.enabled = self.soundOn; try { localStorage.setItem("game_hub_sound_muted", self.soundOn ? "false" : "true"); } catch (e) {}
          btnSound.textContent = self.soundOn ? '🔊' : '🔇';
          self.showToast(self.soundOn ? 'Suara Aktif' : 'Suara Dimatikan');
        });
      }

      var btnFullscreen = document.getElementById('btn-fullscreen');
      if (btnFullscreen) {
        btnFullscreen.addEventListener('click', function () { self.toggleFullscreen(); });
      }

      var btnHome = document.getElementById('btn-home');
      if (btnHome) {
        btnHome.addEventListener('click', function () { window.location.href = '../../index.html'; });
      }

      var btnLdb = document.getElementById('btn-leaderboard');
      if (btnLdb) {
        btnLdb.addEventListener('click', function () { self.openLeaderboard(); });
      }

      if (this.userBadgeEl) {
        this.userBadgeEl.addEventListener('click', function () { self.openUsernameModal(); });
      }

      // Close modal backdrop clicks
      document.querySelectorAll('.modal-backdrop').forEach(function (mb) {
        mb.addEventListener('click', function (e) {
          if (e.target === mb) self.closeModal(mb);
        });
      });
      document.querySelectorAll('.modal-close').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var modal = btn.closest('.modal-backdrop');
          if (modal) self.closeModal(modal);
        });
      });

      // Win Play Again Button
      var btnWinAgain = document.getElementById('btn-win-restart');
      if (btnWinAgain) {
        btnWinAgain.addEventListener('click', function () {
          self.winOverlay.classList.remove('show');
          self.startNewGame();
        });
      }

      // Avatar Form Submit
      var formUser = document.getElementById('form-username');
      if (formUser) {
        formUser.addEventListener('submit', function (e) {
          e.preventDefault();
          var inputVal = document.getElementById('input-username').value.trim();
          if (inputVal.length >= 2 && inputVal.length <= 20) {
            self.username = inputVal;
            self.saveSharedProfile();
            self.updateProfileUI();
            self.closeModal(self.modalUser);
            self.showToast('Profil pemain berhasil disimpan!');
            self.syncScoreToBackend(0); // sync profile to DB
          }
        });
      }

      // Avatar File Import
      var btnAvatarUpload = document.getElementById('btn-select-avatar');
      var inputAvatarFile = document.getElementById('input-avatar-file');
      if (btnAvatarUpload && inputAvatarFile) {
        btnAvatarUpload.addEventListener('click', function () { inputAvatarFile.click(); });
        inputAvatarFile.addEventListener('change', function (e) {
          if (e.target.files && e.target.files[0]) {
            var file = e.target.files[0];
            var reader = new FileReader();
            reader.onload = function (evt) {
              self.avatar = evt.target.result;
              self.saveSharedProfile();
              self.updateProfileUI();
              self.showToast('Foto profil berhasil diunggah!');
            };
            reader.readAsDataURL(file);
          }
        });
      }
    },

    startNewGame: function () {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      this.startTime = null;
      this.moves = 0;
      this.score = 0;
      this.combo = 0;
      this.matchedCount = 0;
      this.flippedCards = [];
      this.isProcessing = false;

      if (this.winOverlay) this.winOverlay.classList.remove('show');
      this.updateStatsUI();

      var cfg = DifficultyConfig[this.cardCount] || DifficultyConfig[16];
      var themeSymbols = CardThemes[this.theme] || CardThemes.gaming;
      
      // Select symbols
      var selectedSymbols = themeSymbols.slice(0, cfg.pairs);
      var deck = selectedSymbols.concat(selectedSymbols);

      // Fisher-Yates shuffle
      for (var i = deck.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = deck[i];
        deck[i] = deck[j];
        deck[j] = temp;
      }

      this.cards = deck;
      this.renderBoard();
    },

    renderBoard: function () {
      if (!this.boardEl) return;
      this.boardEl.innerHTML = '';
      this.boardEl.className = 'cards-grid-container grid-' + this.cardCount;

      var self = this;
      this.cards.forEach(function (symbol, index) {
        var card = document.createElement('div');
        card.className = 'memory-card';
        card.setAttribute('data-index', index);
        card.setAttribute('data-symbol', symbol);

        var front = document.createElement('div');
        front.className = 'card-face card-front';
        front.textContent = symbol;

        var back = document.createElement('div');
        back.className = 'card-face card-back';

        card.appendChild(front);
        card.appendChild(back);

        card.addEventListener('click', function () {
          self.handleCardClick(card, index);
        });

        self.boardEl.appendChild(card);
      });
    },

    handleCardClick: function (cardEl, index) {
      if (this.isProcessing) return;
      if (cardEl.classList.contains('is-flipped') || cardEl.classList.contains('is-matched')) return;

      // Start timer on first move
      if (!this.startTime) {
        this.startTime = Date.now();
        var self = this;
        this.timerInterval = setInterval(function () {
          self.updateTimer();
        }, 1000);
      }

      cardEl.classList.add('is-flipped');
      SoundSystem.flip();
      this.flippedCards.push(cardEl);

      if (this.flippedCards.length === 2) {
        this.moves++;
        this.updateStatsUI();
        this.checkMatch();
      }
    },

    checkMatch: function () {
      var self = this;
      this.isProcessing = true;

      var c1 = this.flippedCards[0];
      var c2 = this.flippedCards[1];
      var s1 = c1.getAttribute('data-symbol');
      var s2 = c2.getAttribute('data-symbol');

      if (s1 === s2) {
        // MATCH!
        this.matchedCount += 2;
        this.combo++;
        var cfg = DifficultyConfig[this.cardCount];
        var matchPoints = Math.round(100 * cfg.mult + (this.combo > 1 ? this.combo * 40 : 0));
        this.score += matchPoints;

        if (this.combo > 1) {
          SoundSystem.combo(this.combo);
        } else {
          SoundSystem.match();
        }

        setTimeout(function () {
          c1.classList.add('is-matched');
          c2.classList.add('is-matched');
          self.flippedCards = [];
          self.isProcessing = false;
          self.updateStatsUI();

          // Check Win Condition
          if (self.matchedCount === self.cardCount) {
            self.handleGameWin();
          }
        }, 300);
      } else {
        // MISMATCH
        this.combo = 0;
        SoundSystem.mismatch();
        setTimeout(function () {
          c1.classList.remove('is-flipped');
          c2.classList.remove('is-flipped');
          self.flippedCards = [];
          self.isProcessing = false;
          self.updateStatsUI();
        }, 850);
      }
    },

    handleGameWin: function () {
      clearInterval(this.timerInterval);
      SoundSystem.win();

      var elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
      var cfg = DifficultyConfig[this.cardCount];

      // Time Bonus & Accuracy Bonus
      var timeBonus = Math.max(0, Math.round((cfg.baseTime - elapsedSec) * 12 * cfg.mult));
      var minMoves = cfg.pairs;
      var accuracy = Math.min(100, Math.round((minMoves / this.moves) * 100));
      var accuracyBonus = Math.round(accuracy * 5 * cfg.mult);

      this.score += timeBonus + accuracyBonus;
      this.updateStatsUI();

      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        this.saveSharedProfile();
      }

      // Sync with global Leaderboard
      this.syncScoreToBackend(this.score);

      // Show Win Modal
      document.getElementById('win-final-score').textContent = this.score;
      document.getElementById('win-final-time').textContent = this.formatTime(elapsedSec);
      document.getElementById('win-final-moves').textContent = this.moves;

      if (this.winOverlay) {
        this.winOverlay.classList.add('show');
      }
    },

    updateTimer: function () {
      if (!this.startTime) return;
      var elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      if (this.timerEl) this.timerEl.textContent = this.formatTime(elapsed);
    },

    formatTime: function (sec) {
      var m = Math.floor(sec / 60);
      var s = sec % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    },

    updateStatsUI: function () {
      if (this.movesEl) this.movesEl.textContent = this.moves;
      if (this.scoreEl) this.scoreEl.textContent = this.score;
      if (this.comboEl) {
        this.comboEl.textContent = this.combo > 1 ? 'x' + this.combo : '0';
        if (this.combo > 1) {
          this.comboEl.classList.add('combo-highlight');
        } else {
          this.comboEl.classList.remove('combo-highlight');
        }
      }
    },

    syncScoreToBackend: function (scoreToSync) {
      var payload = {
        game: 'memory',
        username: this.username,
        score: scoreToSync || this.bestScore,
        avatar: this.avatar
      };

      fetch('/api/leaderboard.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.status === 'success') {
          // Score synced successfully
        }
      })
      .catch(function () {});
    },

    openLeaderboard: function () {
      var self = this;
      this.openModal(this.modalLdb);
      var bodyEl = document.getElementById('leaderboard-body-content');
      if (bodyEl) bodyEl.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">Memuat peringkat...</div>';

      fetch('/api/leaderboard.php?game=memory&username=' + encodeURIComponent(this.username))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.status === 'success') {
            self.renderLeaderboardTable(data.leaderboard, data.player);
          } else {
            if (bodyEl) bodyEl.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">Gagal memuat peringkat.</div>';
          }
        })
        .catch(function () {
          if (bodyEl) bodyEl.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">Koneksi gagal.</div>';
        });
    },

    renderLeaderboardTable: function (list, player) {
      var bodyEl = document.getElementById('leaderboard-body-content');
      if (!bodyEl) return;

      var rankHtml = '';
      if (player) {
        rankHtml = '<div style="background:rgba(255,255,255,0.06); padding:10px; border-radius:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">' +
          '<div><span>Pemain: <strong>' + (player.username || '-') + '</strong></span><br>' +
          '<span style="font-size:12px; color:#94a3b8;">Best Skor: <strong>' + (player.best_score || 0) + '</strong></span></div>' +
          '<div style="background:#3b82f6; color:#fff; font-size:12px; font-weight:700; padding:4px 10px; border-radius:20px;">Rank #' + (player.rank || '-') + '</div>' +
          '</div>';
      }

      if (!list || list.length === 0) {
        bodyEl.innerHTML = rankHtml + '<div style="text-align:center; padding:20px; color:#94a3b8;">Belum ada skor tercatat. Jadilah yang pertama!</div>';
        return;
      }

      var tableHtml = rankHtml + '<div class="ldb-table-wrap"><table class="ldb-table">' +
        '<thead><tr><th>Rank</th><th>Pemain</th><th style="text-align:right;">Skor</th></tr></thead><tbody>';

      list.forEach(function (row) {
        var rankClass = row.rank === 1 ? 'ldb-rank-1' : (row.rank === 2 ? 'ldb-rank-2' : (row.rank === 3 ? 'ldb-rank-3' : ''));
        var avHtml = row.avatar ? 
          '<img src="' + row.avatar + '" alt="Avatar">' :
          (row.username ? row.username.charAt(0).toUpperCase() : '👤');

        tableHtml += '<tr>' +
          '<td><span class="ldb-rank-badge ' + rankClass + '">' + row.rank + '</span></td>' +
          '<td><div class="ldb-user-cell"><div class="ldb-user-avatar">' + avHtml + '</div><span>' + row.username + '</span></div></td>' +
          '<td style="text-align:right; color:#38bdf8;">' + row.best_score + '</td>' +
          '</tr>';
      });

      tableHtml += '</tbody></table></div>';
      bodyEl.innerHTML = tableHtml;
    },

    openUsernameModal: function () {
      var input = document.getElementById('input-username');
      if (input) input.value = this.username;
      this.openModal(this.modalUser);
    },

    openModal: function (modal) {
      if (modal) {
        modal.classList.add('is-open');
        modal.style.display = 'flex';
      }
    },

    closeModal: function (modal) {
      if (modal) {
        modal.classList.remove('is-open');
        modal.style.display = 'none';
      }
    },

    toggleFullscreen: function () {
      var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (isFs) {
        var exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
        document.body.classList.remove('is-fullscreen');
      } else {
        var req = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
        if (req) {
          req.call(document.documentElement);
        }
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

  // Launch on DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    MemoryGame.init();
    window.MemoryGame = MemoryGame;
  });

})();
