(function () {
  "use strict";

  var USERNAME_KEY = "2048_username";
  var THEME_KEY    = "2048_theme";

  var Leaderboard = {
    username: "",
    theme: "light",
    storageManager: null,
    lastSyncedScore: 0,
    syncTimeout: null,
    toastTimer: null,
    gameOverModalTimer: null,
    initialized: false,
    isFallbackFs: false,

    init: function (storageManager) {
      if (this.initialized) {
        if (storageManager) this.storageManager = storageManager;
        return;
      }
      this.initialized = true;

      this.storageManager = storageManager || (typeof LocalStorageManager !== "undefined" ? new LocalStorageManager() : null);
      this.username = (window.localStorage ? window.localStorage.getItem(USERNAME_KEY) : "") || "";

      this.initTheme();
      this.cacheDom();
      this.bindEvents();
      this.updateUserBadge();

      var self = this;
      if (!this.username) {
        // Show username prompt immediately
        setTimeout(function () {
          self.openUsernameModal(false);
        }, 150);
      } else {
        this.performInitialSync();
      }
    },

    initTheme: function () {
      var saved = null;
      try {
        saved = window.localStorage ? window.localStorage.getItem(THEME_KEY) : null;
      } catch (e) {}

      var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      var isDark = saved ? (saved === "dark") : prefersDark;

      this.setTheme(isDark ? "dark" : "light", false);
    },

    setTheme: function (theme, save) {
      this.theme = theme;
      var isDark = theme === "dark";

      if (isDark) {
        document.documentElement.classList.add("dark-theme");
        document.body.classList.add("dark-theme");
      } else {
        document.documentElement.classList.remove("dark-theme");
        document.body.classList.remove("dark-theme");
      }

      var iconEl = document.getElementById("theme-icon");
      if (iconEl) {
        iconEl.textContent = isDark ? "☀️" : "🌙";
      }

      var btnTheme = document.getElementById("btn-theme");
      if (btnTheme) {
        btnTheme.setAttribute("title", isDark ? "Ganti ke Mode Terang (Light)" : "Ganti ke Mode Gelap (Dark)");
      }

      if (save) {
        try {
          if (window.localStorage) {
            window.localStorage.setItem(THEME_KEY, theme);
          }
        } catch (e) {}
      }
    },

    toggleTheme: function () {
      var next = this.theme === "dark" ? "light" : "dark";
      this.setTheme(next, true);
      this.showToast(next === "dark" ? "🌙 Mode Gelap Aktif" : "☀️ Mode Terang Aktif");
    },

    cacheDom: function () {
      this.userBadgeEl      = document.getElementById("user-badge");
      this.userNameDisplay  = document.getElementById("username-display");
      this.btnTheme         = document.getElementById("btn-theme");
      this.btnLeaderboard   = document.getElementById("btn-leaderboard");
      this.btnFullscreen    = document.getElementById("btn-fullscreen");
      this.fullscreenText   = document.getElementById("fullscreen-text");
      this.fullscreenIcon   = document.getElementById("fullscreen-icon");

      // Username Modal
      this.modalUsername    = document.getElementById("modal-username");
      this.formUsername     = document.getElementById("form-username");
      this.inputUsername    = document.getElementById("input-username");
      this.errorUsername    = document.getElementById("error-username");
      this.btnCloseUsername = document.getElementById("close-username-modal");

      // Leaderboard Modal
      this.modalLeaderboard = document.getElementById("modal-leaderboard");
      this.btnCloseLdb      = document.getElementById("close-leaderboard-modal");
      this.btnRefreshLdb    = document.getElementById("btn-refresh-leaderboard");
      this.btnChangeUserLdb = document.getElementById("btn-change-user-from-ldb");
      this.ldbBody          = document.getElementById("leaderboard-body-content");
      this.playerCard       = document.getElementById("player-rank-summary");

      // Toast
      this.toastEl          = document.getElementById("toast-notification");
    },

    bindEvents: function () {
      var self = this;

      if (this.btnTheme) {
        this.btnTheme.onclick = function () {
          self.toggleTheme();
        };
      }

      if (this.userBadgeEl) {
        this.userBadgeEl.onclick = function () {
          self.openUsernameModal(true);
        };
      }

      if (this.btnLeaderboard) {
        this.btnLeaderboard.onclick = function () {
          self.openLeaderboard();
        };
      }

      if (this.btnFullscreen) {
        this.btnFullscreen.onclick = function () {
          self.toggleFullscreen();
        };
      }

      if (this.formUsername) {
        this.formUsername.onsubmit = function (e) {
          e.preventDefault();
          self.handleUsernameSubmit();
        };
      }

      if (this.btnCloseUsername) {
        this.btnCloseUsername.onclick = function () {
          self.closeModal(self.modalUsername);
        };
      }

      if (this.btnCloseLdb) {
        this.btnCloseLdb.onclick = function () {
          self.closeModal(self.modalLeaderboard);
        };
      }

      if (this.btnRefreshLdb) {
        this.btnRefreshLdb.onclick = function () {
          self.loadLeaderboardData();
        };
      }

      if (this.btnChangeUserLdb) {
        this.btnChangeUserLdb.onclick = function () {
          self.closeModal(self.modalLeaderboard);
          self.openUsernameModal(true);
        };
      }

      // Close modal on backdrop click
      [this.modalUsername, this.modalLeaderboard].forEach(function (modal) {
        if (!modal) return;
        modal.onclick = function (e) {
          if (e.target === modal && modal.getAttribute("data-can-close") !== "false") {
            self.closeModal(modal);
          }
        };
      });

      // Native Fullscreen change events
      var fsEvents = ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"];
      fsEvents.forEach(function (ev) {
        document.addEventListener(ev, function () {
          self.handleNativeFullscreenChange();
        });
      });
    },

    updateUserBadge: function () {
      if (this.userNameDisplay) {
        this.userNameDisplay.textContent = this.username || "Pemain Baru";
      }
    },

    openUsernameModal: function (canClose) {
      if (!this.modalUsername) this.cacheDom();
      if (!this.modalUsername) return;

      this.modalUsername.setAttribute("data-can-close", canClose ? "true" : "false");
      if (this.btnCloseUsername) {
        this.btnCloseUsername.style.display = canClose ? "inline-block" : "none";
      }
      if (this.inputUsername) {
        this.inputUsername.value = this.username || "";
      }
      if (this.errorUsername) {
        this.errorUsername.style.display = "none";
        this.errorUsername.textContent = "";
      }

      this.openModal(this.modalUsername);

      var inp = this.inputUsername;
      if (inp) {
        setTimeout(function () {
          inp.focus();
        }, 150);
      }
    },

    handleUsernameSubmit: function () {
      var raw = this.inputUsername ? this.inputUsername.value.trim() : "";
      if (raw.length < 2 || raw.length > 20) {
        this.showUsernameError("Panjang username harus antara 2 hingga 20 karakter.");
        return;
      }
      if (!/^[a-zA-Z0-9_\-\. ]+$/.test(raw)) {
        this.showUsernameError("Username hanya boleh huruf, angka, spasi, _, -, .");
        return;
      }

      this.username = raw;
      if (window.localStorage) {
        window.localStorage.setItem(USERNAME_KEY, this.username);
      }
      this.updateUserBadge();
      this.closeModal(this.modalUsername);

      this.showToast("👤 Username disimpan: " + this.username);

      // Trigger score sync
      var bestScore = this.getBestScore();
      this.syncScore(bestScore, true);
    },

    showUsernameError: function (msg) {
      if (this.errorUsername) {
        this.errorUsername.textContent = msg;
        this.errorUsername.style.display = "block";
      }
    },

    getBestScore: function () {
      if (this.storageManager && this.storageManager.getBestScore) {
        return parseInt(this.storageManager.getBestScore(), 10) || 0;
      }
      if (window.localStorage) {
        return parseInt(window.localStorage.getItem("bestScore"), 10) || 0;
      }
      return 0;
    },

    performInitialSync: function () {
      if (!this.username) return;
      var self = this;
      var localBest = this.getBestScore();

      fetch("/api/leaderboard.php?username=" + encodeURIComponent(this.username))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.status === "success" && data.player) {
            var serverBest = parseInt(data.player.best_score, 10) || 0;
            if (serverBest > localBest) {
              if (self.storageManager && self.storageManager.setBestScore) {
                self.storageManager.setBestScore(serverBest);
              } else if (window.localStorage) {
                window.localStorage.setItem("bestScore", serverBest);
              }
              var bestContainer = document.querySelector(".best-container");
              if (bestContainer) bestContainer.textContent = serverBest;
              self.showToast("⚡ Best score disinkronkan dari server: " + serverBest.toLocaleString());
            } else if (localBest > serverBest) {
              self.syncScore(localBest, true);
            }
          } else if (localBest > 0) {
            self.syncScore(localBest, true);
          }
        })
        .catch(function (err) {
          console.warn("Sync error:", err);
        });
    },

    syncScore: function (score, force) {
      if (!this.username) return;
      var numScore = parseInt(score, 10) || 0;
      var self = this;

      if (!force && numScore <= this.lastSyncedScore) {
        return;
      }

      clearTimeout(this.syncTimeout);
      this.syncTimeout = setTimeout(function () {
        fetch("/api/leaderboard.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: self.username,
            score: numScore
          })
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.status === "success") {
            self.lastSyncedScore = Math.max(self.lastSyncedScore, numScore);
            if (data.updated && numScore > 0) {
              self.showToast("🏆 Best score tersinkron ke Leaderboard: " + numScore.toLocaleString());
            }
          }
        })
        .catch(function (err) {
          console.warn("Gagal sync score:", err);
        });
      }, 300);
    },

    // Game Over Handler: Notification + Auto-popup Leaderboard
    onGameOver: function (score, isNewBest) {
      var self = this;
      var numScore = parseInt(score, 10) || 0;

      // Sync final score immediately
      this.syncScore(numScore, true);

      // Show high score or game over notification
      if (isNewBest && numScore > 0) {
        this.showToast("🎉 NEW HIGH SCORE! Skor: " + numScore.toLocaleString() + " 🏆");
      } else {
        this.showToast("🎮 Game Over! Skor Akhir: " + numScore.toLocaleString());
      }

      // Automatically show Leaderboard popup after 900ms
      clearTimeout(this.gameOverModalTimer);
      this.gameOverModalTimer = setTimeout(function () {
        self.openLeaderboard();
      }, 900);
    },

    onGameRestart: function () {
      clearTimeout(this.gameOverModalTimer);
    },

    openLeaderboard: function () {
      if (!this.modalLeaderboard) this.cacheDom();
      this.openModal(this.modalLeaderboard);
      this.loadLeaderboardData();
    },

    loadLeaderboardData: function () {
      var self = this;
      if (this.ldbBody) {
        this.ldbBody.innerHTML = '<div class="leaderboard-empty">Memuat papan peringkat...</div>';
      }

      var url = "/api/leaderboard.php" + (this.username ? "?username=" + encodeURIComponent(this.username) : "");

      fetch(url)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data || data.status !== "success") {
            if (self.ldbBody) self.ldbBody.innerHTML = '<div class="leaderboard-empty">Gagal memuat data leaderboard.</div>';
            return;
          }
          self.renderLeaderboard(data.leaderboard || [], data.player);
        })
        .catch(function (err) {
          if (self.ldbBody) self.ldbBody.innerHTML = '<div class="leaderboard-empty">Terjadi kesalahan koneksi.</div>';
        });
    },

    renderLeaderboard: function (list, player) {
      if (this.playerCard) {
        if (player) {
          this.playerCard.style.display = "flex";
          this.playerCard.innerHTML = 
            '<div>' +
              '<span>Pemain: <strong>' + this.escapeHtml(player.username) + '</strong></span><br>' +
              '<span style="font-size:13px; font-weight:normal;">Best Score: <strong>' + (player.best_score || 0).toLocaleString() + '</strong></span>' +
            '</div>' +
            '<div class="player-rank-badge">Peringkat #' + (player.rank || '-') + '</div>';
        } else {
          this.playerCard.style.display = "flex";
          var localBest = this.getBestScore();
          this.playerCard.innerHTML = 
            '<div>' +
              '<span>Pemain: <strong>' + (this.escapeHtml(this.username) || "Anonim") + '</strong></span><br>' +
              '<span style="font-size:13px; font-weight:normal;">Best Score: <strong>' + localBest.toLocaleString() + '</strong></span>' +
            '</div>' +
            '<div class="player-rank-badge">Belum Ada Skor</div>';
        }
      }

      if (!this.ldbBody) return;

      if (!list || list.length === 0) {
        this.ldbBody.innerHTML = '<div class="leaderboard-empty">Belum ada skor yang tercatat di papan peringkat. Mulai main sekarang!</div>';
        return;
      }

      var html = '<div class="leaderboard-table-wrap"><table class="leaderboard-table">';
      html += '<thead><tr><th class="col-rank">#</th><th>Pemain</th><th class="col-score">Best Score</th></tr></thead><tbody>';

      for (var i = 0; i < list.length; i++) {
        var row = list[i];
        var isCurrent = this.username && (row.username.toLowerCase() === this.username.toLowerCase());
        var rankBadge = row.rank;
        if (row.rank === 1) rankBadge = "🥇 1";
        else if (row.rank === 2) rankBadge = "🥈 2";
        else if (row.rank === 3) rankBadge = "🥉 3";

        html += '<tr class="' + (isCurrent ? 'current-user-row' : '') + '">';
        html += '<td class="col-rank">' + rankBadge + '</td>';
        html += '<td>' + this.escapeHtml(row.username) + (isCurrent ? ' <small>(Kamu)</small>' : '') + '</td>';
        html += '<td class="col-score">' + (row.best_score || 0).toLocaleString() + '</td>';
        html += '</tr>';
      }

      html += '</tbody></table></div>';
      this.ldbBody.innerHTML = html;
    },

    toggleFullscreen: function () {
      var isNativeFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

      if (isNativeFs || this.isFallbackFs) {
        // Exit fullscreen
        this.exitAllFullscreen();
      } else {
        // Enter fullscreen
        var self = this;
        var root = document.documentElement;
        var req = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen || root.msRequestFullscreen;

        if (req) {
          try {
            var promise = req.call(root);
            if (promise && promise.catch) {
              promise.catch(function () {
                self.enterFallbackFullscreen();
              });
            }
          } catch (e) {
            self.enterFallbackFullscreen();
          }
        } else {
          // iOS Safari fallback
          this.enterFallbackFullscreen();
        }
      }
    },

    enterFallbackFullscreen: function () {
      this.isFallbackFs = true;
      document.documentElement.classList.add("is-fullscreen");
      document.body.classList.add("is-fullscreen");
      this.updateFullscreenUI(true);
      this.showToast("⛶ Mode Fullscreen Aktif");
    },

    exitAllFullscreen: function () {
      this.isFallbackFs = false;
      var exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
        try { exit.call(document); } catch (e) {}
      }
      document.documentElement.classList.remove("is-fullscreen");
      document.body.classList.remove("is-fullscreen");
      this.updateFullscreenUI(false);
    },

    handleNativeFullscreenChange: function () {
      var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      if (isFs) {
        document.documentElement.classList.add("is-fullscreen");
        document.body.classList.add("is-fullscreen");
        this.updateFullscreenUI(true);
        this.showToast("⛶ Mode Fullscreen Aktif");
      } else {
        if (!this.isFallbackFs) {
          document.documentElement.classList.remove("is-fullscreen");
          document.body.classList.remove("is-fullscreen");
          this.updateFullscreenUI(false);
        }
      }
    },

    updateFullscreenUI: function (active) {
      if (this.fullscreenText) this.fullscreenText.textContent = active ? "Keluar" : "Fullscreen";
      if (this.fullscreenIcon) this.fullscreenIcon.textContent = active ? "✕" : "⛶";
    },

    openModal: function (modal) {
      if (modal) {
        modal.classList.add("is-open");
        modal.style.display = "flex";
      }
    },

    closeModal: function (modal) {
      if (modal) {
        modal.classList.remove("is-open");
        modal.style.display = "none";
      }
    },

    showToast: function (msg) {
      if (!this.toastEl) this.cacheDom();
      if (!this.toastEl) return;
      this.toastEl.textContent = msg;
      this.toastEl.classList.add("show");
      clearTimeout(this.toastTimer);
      var self = this;
      this.toastTimer = setTimeout(function () {
        if (self.toastEl) self.toastEl.classList.remove("show");
      }, 3000);
    },

    escapeHtml: function (str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  };

  window.Leaderboard = Leaderboard;

  // Auto initialize on DOM ready
  function autoInit() {
    Leaderboard.init();
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(autoInit, 1);
  } else {
    document.addEventListener("DOMContentLoaded", autoInit);
  }
})();
