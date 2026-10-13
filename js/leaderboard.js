(function () {
  "use strict";

  var USERNAME_KEY = "2048_username";
  var AVATAR_KEY   = "2048_avatar";
  var THEME_KEY    = "2048_theme";

  var Leaderboard = {
    username: "",
    avatar: "",
    pendingAvatar: "",
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
      var storedUser = "";
      try {
        storedUser = localStorage.getItem("user_profile_name") || localStorage.getItem(USERNAME_KEY) || "";
      } catch (e) {}
      this.username = storedUser || "Pemain Baru";
      this.avatar = (window.localStorage ? (window.localStorage.getItem("user_profile_avatar") || window.localStorage.getItem(AVATAR_KEY)) : "") || "";
      this.pendingAvatar = this.avatar;

      this.initTheme();
      this.cacheDom();
      this.bindEvents();
      this.updateUserBadge();

      this.fetchGlobalScore();
    },

    THEMES: [
      {
        id: "classic",
        name: "Classic",
        icon: "☀️",
        isDark: false,
        desc: "Orisinal 2048 warna tanah liat & oranye hangat",
        swatches: ["#faf8ef", "#bbada0", "#eee4da", "#f2b179", "#edc22e"]
      },
      {
        id: "dark",
        name: "Midnight",
        icon: "🌙",
        isDark: true,
        desc: "Mode gelap kontras tinggi & nyaman di mata",
        swatches: ["#141416", "#202024", "#323136", "#bb6b2e", "#eab308"]
      },
      {
        id: "christmas",
        name: "Christmas",
        icon: "🎄",
        isDark: true,
        desc: "Event Natal hijau pinus, merah buah beri & emas",
        swatches: ["#0d2218", "#143526", "#f0fdf4", "#ef4444", "#ffd700"]
      },
      {
        id: "halloween",
        name: "Halloween",
        icon: "🎃",
        isDark: true,
        desc: "Event malam labu mistis ungu kelam & api oranye",
        swatches: ["#0f0a1c", "#1a122e", "#2b1f48", "#ea580c", "#84cc16"]
      },
      {
        id: "easter",
        name: "Easter",
        icon: "🐰",
        isDark: false,
        desc: "Event Paskah pastel cerah dengan warna telur musim semi",
        swatches: ["#fbf7ee", "#f3ebdb", "#fef3c7", "#86efac", "#c084fc"]
      },
      {
        id: "winter",
        name: "Winter",
        icon: "❄️",
        isDark: true,
        desc: "Musim dingin kutub dengan kristal es & biru gletser",
        swatches: ["#091322", "#112038", "#e0f2fe", "#38bdf8", "#2563eb"]
      }
    ],

    initTheme: function () {
      var saved = "classic";
      try {
        saved = window.localStorage ? (window.localStorage.getItem(THEME_KEY) || "classic") : "classic";
      } catch (e) {}

      if (saved === "light") saved = "classic";
      var valid = this.THEMES.some(function (t) { return t.id === saved; });
      if (!valid) saved = "classic";

      this.setTheme(saved, false);
    },

    setTheme: function (themeId, save) {
      if (themeId === "light") themeId = "classic";
      var theme = null;
      for (var i = 0; i < this.THEMES.length; i++) {
        if (this.THEMES[i].id === themeId) {
          theme = this.THEMES[i];
          break;
        }
      }
      if (!theme) theme = this.THEMES[0];

      this.theme = theme.id;

      // Reset all theme classes
      var allThemeClasses = ["theme-classic", "theme-dark", "theme-christmas", "theme-halloween", "theme-easter", "theme-winter"];
      allThemeClasses.forEach(function (cls) {
        document.documentElement.classList.remove(cls);
        document.body.classList.remove(cls);
      });

      // Apply selected theme class
      document.documentElement.classList.add("theme-" + theme.id);
      document.body.classList.add("theme-" + theme.id);

      // Dark elements styling for modals & text contrast
      if (theme.isDark) {
        document.documentElement.classList.add("dark-theme");
        document.body.classList.add("dark-theme");
      } else {
        document.documentElement.classList.remove("dark-theme");
        document.body.classList.remove("dark-theme");
      }

      var iconEl = document.getElementById("theme-icon");
      if (iconEl) {
        iconEl.textContent = theme.icon;
      }

      var btnTheme = document.getElementById("btn-theme");
      if (btnTheme) {
        btnTheme.setAttribute("title", "Pilih Tema (" + theme.name + ")");
      }

      if (save) {
        try {
          if (window.localStorage) {
            window.localStorage.setItem(THEME_KEY, theme.id);
          }
        } catch (e) {}
        this.showToast(theme.icon + " Tema " + theme.name + " Aktif!");
      }

      this.renderThemeCards();
    },

    openThemeModal: function () {
      if (!this.modalTheme) this.cacheDom();
      if (!this.modalTheme) return;
      this.renderThemeCards();
      this.openModal(this.modalTheme);
    },

    renderThemeCards: function () {
      if (!this.themeOptionsGrid) return;
      var self = this;
      var html = "";

      for (var i = 0; i < this.THEMES.length; i++) {
        var t = this.THEMES[i];
        var isActive = (t.id === self.theme);
        var swatchesHtml = "";
        for (var s = 0; s < t.swatches.length; s++) {
          swatchesHtml += '<span class="theme-swatch" style="background:' + t.swatches[s] + '"></span>';
        }

        html += '<div class="theme-card ' + (isActive ? 'is-active' : '') + '" data-theme-id="' + t.id + '">';
        html += '  <div class="theme-card-top">';
        html += '    <div class="theme-card-info">';
        html += '      <span class="theme-card-icon">' + t.icon + '</span>';
        html += '      <strong class="theme-card-title">' + t.name + '</strong>';
        html += '    </div>';
        if (isActive) {
          html += '    <span class="theme-badge-active">✓ Aktif</span>';
        }
        html += '  </div>';
        html += '  <p class="theme-card-desc">' + t.desc + '</p>';
        html += '  <div class="theme-swatches-row">' + swatchesHtml + '</div>';
        html += '</div>';
      }

      this.themeOptionsGrid.innerHTML = html;

      var cards = this.themeOptionsGrid.querySelectorAll(".theme-card");
      for (var j = 0; j < cards.length; j++) {
        cards[j].onclick = function () {
          var chosenId = this.getAttribute("data-theme-id");
          self.setTheme(chosenId, true);
        };
      }
    },

    toggleTheme: function () {
      this.openThemeModal();
    },

    cacheDom: function () {
      this.userBadgeEl           = document.getElementById("user-badge");
      this.userNameDisplay       = document.getElementById("username-display");
      this.userAvatarWrap        = document.getElementById("user-avatar-wrap");
      this.userAvatarImg         = document.getElementById("user-avatar-img");
      this.userAvatarPlaceholder = document.getElementById("user-avatar-placeholder");

      this.btnTheme              = document.getElementById("btn-theme");
      this.btnLeaderboard        = document.getElementById("btn-leaderboard");
      this.btnFullscreen         = document.getElementById("btn-fullscreen");
      this.fullscreenIcon        = document.getElementById("fullscreen-icon");

      // Username Modal
      this.modalUsername         = document.getElementById("modal-username");
      this.formUsername          = document.getElementById("form-username");
      this.inputUsername         = document.getElementById("input-username");
      this.errorUsername         = document.getElementById("error-username");
      this.btnCloseUsername      = document.getElementById("close-username-modal");

      // Avatar Elements in Modal
      this.avatarModalWrap        = document.getElementById("avatar-modal-wrap");
      this.avatarModalImg         = document.getElementById("avatar-modal-img");
      this.avatarModalPlaceholder = document.getElementById("avatar-modal-placeholder");
      this.avatarModalHoverOverlay= document.getElementById("avatar-modal-hover-overlay");
      this.inputAvatarFile        = document.getElementById("input-avatar-file");
      this.btnSelectAvatar        = document.getElementById("btn-select-avatar");
      this.btnRemoveAvatar        = document.getElementById("btn-remove-avatar");

      // Leaderboard Modal
      this.modalLeaderboard      = document.getElementById("modal-leaderboard");
      this.btnCloseLdb           = document.getElementById("close-leaderboard-modal");
      this.btnRefreshLdb         = document.getElementById("btn-refresh-leaderboard");
      this.btnLogout             = document.getElementById("btn-logout-from-ldb");
      this.ldbBody               = document.getElementById("leaderboard-body-content");
      this.playerCard            = document.getElementById("player-rank-summary");

      // Theme Modal
      this.modalTheme            = document.getElementById("modal-theme");
      this.btnCloseTheme         = document.getElementById("close-theme-modal");
      this.themeOptionsGrid      = document.getElementById("theme-options-grid");

      // Toast
      this.toastEl               = document.getElementById("toast-notification");
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

      if (this.btnTheme) {
        this.btnTheme.onclick = function () {
          self.openThemeModal();
        };
      }

      if (this.btnCloseTheme) {
        this.btnCloseTheme.onclick = function () {
          self.closeModal(self.modalTheme);
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

      // Avatar Picker events
      if (this.avatarModalWrap) {
        this.avatarModalWrap.onclick = function () {
          if (self.inputAvatarFile) self.inputAvatarFile.click();
        };
      }

      if (this.btnSelectAvatar) {
        this.btnSelectAvatar.onclick = function () {
          if (self.inputAvatarFile) self.inputAvatarFile.click();
        };
      }

      if (this.btnRemoveAvatar) {
        this.btnRemoveAvatar.onclick = function () {
          self.pendingAvatar = "";
          self.hasUploadedNewFile = false;
          self.explicitlyRemovedAvatar = true;
          self.updateModalAvatarPreview();
          self.showToast("Foto profil dihapus (menggunakan avatar default)");
        };
      }

      if (this.inputAvatarFile) {
        this.inputAvatarFile.onchange = function (e) {
          if (e.target.files && e.target.files[0]) {
            self.handleAvatarFileChange(e.target.files[0]);
          }
        };
      }

      if (this.inputUsername) {
        this.inputUsername.oninput = function () {
          var typedName = (self.inputUsername.value || "").trim();

          // Reset hint/error unless success hint
          if (self.errorUsername && !self.errorUsername.classList.contains("is-success-hint")) {
            self.errorUsername.textContent = "";
            self.errorUsername.style.display = "none";
            self.errorUsername.style.color = "";
          }

          // If user hasn't explicitly uploaded a new file or explicitly clicked remove avatar:
          if (!self.hasUploadedNewFile && !self.explicitlyRemovedAvatar) {
            clearTimeout(self.checkUserTimeout);
            if (typedName.length >= 2) {
              self.checkUserTimeout = setTimeout(function () {
                fetch("/api/leaderboard.php?username=" + encodeURIComponent(typedName))
                  .then(function (res) { return res.json(); })
                  .then(function (data) {
                    var currentVal = (self.inputUsername.value || "").trim();
                    if (currentVal.toLowerCase() !== typedName.toLowerCase()) return;
                    if (self.hasUploadedNewFile || self.explicitlyRemovedAvatar) return;

                    if (data && data.player) {
                      if (data.player.avatar) {
                        self.pendingAvatar = data.player.avatar;
                      } else {
                        self.pendingAvatar = "";
                      }
                      self.updateModalAvatarPreview();

                      if (self.errorUsername) {
                        var scoreText = data.player.best_score ? " (Rekor Pribadi: " + data.player.best_score.toLocaleString() + ")" : "";
                        self.errorUsername.textContent = "✨ Akun ditemukan!" + scoreText + (data.player.avatar ? " Foto profil dimuat." : "");
                        self.errorUsername.style.color = "#10b981";
                        self.errorUsername.style.display = "block";
                        self.errorUsername.classList.add("is-success-hint");
                      }
                    } else {
                      self.pendingAvatar = "";
                      self.updateModalAvatarPreview();
                      if (self.errorUsername && self.errorUsername.classList.contains("is-success-hint")) {
                        self.errorUsername.textContent = "";
                        self.errorUsername.style.display = "none";
                        self.errorUsername.style.color = "";
                        self.errorUsername.classList.remove("is-success-hint");
                      }
                    }
                  })
                  .catch(function () {});
              }, 250);
            } else {
              self.pendingAvatar = "";
              self.updateModalAvatarPreview();
              if (self.errorUsername && self.errorUsername.classList.contains("is-success-hint")) {
                self.errorUsername.textContent = "";
                self.errorUsername.style.display = "none";
                self.errorUsername.style.color = "";
                self.errorUsername.classList.remove("is-success-hint");
              }
            }
          } else {
            if (!self.pendingAvatar) {
              self.updateModalAvatarPreview();
            }
          }
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

      if (this.btnLogout) {
        this.btnLogout.onclick = function () {
          self.logout();
        };
      }

      // Close modal on backdrop click
      [this.modalUsername, this.modalLeaderboard, this.modalTheme].forEach(function (modal) {
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

      // Handle viewport resize and orientation changes for responsive fullscreen scaling
      window.addEventListener("resize", function () {
        self.updateFullscreenScale();
      });
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", function () {
          self.updateFullscreenScale();
        });
      }
      window.addEventListener("orientationchange", function () {
        setTimeout(function () {
          self.updateFullscreenScale();
        }, 100);
      });
    },

    getAvatarGradient: function (name) {
      var palette = [
        "linear-gradient(135deg, #f97316, #ea580c)",
        "linear-gradient(135deg, #8b5cf6, #6d28d9)",
        "linear-gradient(135deg, #06b6d4, #0891b2)",
        "linear-gradient(135deg, #10b981, #059669)",
        "linear-gradient(135deg, #ec4899, #db2777)",
        "linear-gradient(135deg, #eab308, #ca8a04)",
        "linear-gradient(135deg, #3b82f6, #1d4ed8)",
        "linear-gradient(135deg, #f43f5e, #e11d48)"
      ];
      var str = (name || "Player").toLowerCase();
      var hash = 0;
      for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      var idx = Math.abs(hash) % palette.length;
      return palette[idx];
    },

    getInitials: function (name) {
      if (!name) return "👤";
      var clean = String(name).trim();
      return clean.charAt(0).toUpperCase() || "👤";
    },

    handleAvatarFileChange: function (file) {
      if (!file) return;
      if (!file.type || !file.type.match(/^image\//i)) {
        this.showToast("⚠️ Mohon pilih file gambar (JPG, PNG, WebP).");
        return;
      }
      var self = this;
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement("canvas");
          var size = 128;
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext("2d");

          var minDim = Math.min(img.width, img.height);
          var sx = (img.width - minDim) / 2;
          var sy = (img.height - minDim) / 2;

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          var dataUrl = canvas.toDataURL("image/jpeg", 0.85);

          self.pendingAvatar = dataUrl;
          self.hasUploadedNewFile = true;
          self.explicitlyRemovedAvatar = false;
          self.updateModalAvatarPreview();
          self.showToast("📷 Foto profil berhasil dipilih!");
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    },

    updateUserBadge: function () {
      if (this.userNameDisplay) {
        this.userNameDisplay.textContent = this.username || "Pemain Baru";
      }

      var hoverText = document.getElementById("profile-card-hover-text");
      var hoverIcon = document.getElementById("profile-card-hover-icon");
      if (this.avatar) {
        if (hoverText) hoverText.textContent = "Ganti Foto";
        if (hoverIcon) hoverIcon.textContent = "✏️";
      } else {
        if (hoverText) hoverText.textContent = "Import Foto";
        if (hoverIcon) hoverIcon.textContent = "📷";
      }

      if (this.userAvatarImg && this.userAvatarPlaceholder) {
        if (this.avatar) {
          this.userAvatarImg.src = this.avatar;
          this.userAvatarImg.style.display = "block";
          this.userAvatarPlaceholder.style.display = "none";
        } else {
          this.userAvatarImg.style.display = "none";
          this.userAvatarPlaceholder.style.display = "flex";
          this.userAvatarPlaceholder.textContent = this.getInitials(this.username);
          this.userAvatarPlaceholder.style.background = this.getAvatarGradient(this.username);
        }
      }

      if (this.btnLogout) {
        this.btnLogout.style.display = this.username ? "inline-flex" : "none";
      }
    },

    updateModalAvatarPreview: function () {
      var hoverText = this.avatarModalHoverOverlay ? this.avatarModalHoverOverlay.querySelector(".avatar-hover-text") : null;
      if (this.pendingAvatar) {
        if (this.avatarModalImg) {
          this.avatarModalImg.src = this.pendingAvatar;
          this.avatarModalImg.style.display = "block";
        }
        if (this.avatarModalPlaceholder) {
          this.avatarModalPlaceholder.style.display = "none";
        }
        if (this.btnRemoveAvatar) {
          this.btnRemoveAvatar.style.display = "inline-block";
        }
        if (hoverText) {
          hoverText.textContent = "✏️ Ganti Foto";
        }
      } else {
        if (this.avatarModalImg) {
          this.avatarModalImg.style.display = "none";
        }
        if (this.avatarModalPlaceholder) {
          this.avatarModalPlaceholder.style.display = "flex";
          var currentName = (this.inputUsername && this.inputUsername.value) ? this.inputUsername.value : this.username;
          this.avatarModalPlaceholder.textContent = this.getInitials(currentName);
          this.avatarModalPlaceholder.style.background = this.getAvatarGradient(currentName);
        }
        if (this.btnRemoveAvatar) {
          this.btnRemoveAvatar.style.display = "none";
        }
        if (hoverText) {
          hoverText.textContent = "📷 Import Foto";
        }
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

    fetchGlobalScore: function () {
      var self = this;
      var url = "/api/leaderboard.php" + (this.username ? "?username=" + encodeURIComponent(this.username) : "");

      fetch(url)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data || data.status !== "success") return;

          // 1. Store Global Top Score for Leaderboard reference
          self.globalBestScore = parseInt(data.global_best_score, 10) || 0;

          // 2. Sync player's own personal best score if logged in
          if (self.username && data.player && typeof data.player.best_score !== "undefined") {
            var serverUserBest = parseInt(data.player.best_score, 10) || 0;
            var localUserBest = self.getBestScore();
            if (serverUserBest > localUserBest) {
              if (self.storageManager && self.storageManager.setBestScore) {
                self.storageManager.setBestScore(serverUserBest);
              } else if (window.localStorage) {
                window.localStorage.setItem("bestScore", serverUserBest);
              }
              var bestContainer = document.querySelector(".best-container");
              if (bestContainer) {
                bestContainer.textContent = serverUserBest;
              }
            } else if (localUserBest > serverUserBest) {
              self.syncScore(localUserBest, true);
            }

            // Sync avatar from server if server has one and local is empty or differs
            if (data.player.avatar && data.player.avatar !== self.avatar) {
              self.avatar = data.player.avatar;
              self.pendingAvatar = self.avatar;
              if (window.localStorage) {
                window.localStorage.setItem(AVATAR_KEY, self.avatar);
              }
              self.updateUserBadge();
            }
          } else if (!self.username) {
            // Guest / not logged in: display personal local best score
            var curLocalBest = self.getBestScore();
            var bestContainer = document.querySelector(".best-container");
            if (bestContainer) {
              bestContainer.textContent = curLocalBest;
            }
          }
        })
        .catch(function (err) {
          console.warn("Global score fetch failed:", err);
        });
    },

    syncScore: function (score, force, isGameOver, isNewBest) {
      if (!this.username) {
        if (isGameOver) {
          var guestScore = parseInt(score, 10) || 0;
          this.showToast("🎮 Game Over! Skor: " + guestScore.toLocaleString());
        }
        return;
      }
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
            score: numScore,
            avatar: self.avatar || ""
          })
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.status === "success") {
            self.lastSyncedScore = Math.max(self.lastSyncedScore, numScore);

            if (typeof data.global_best_score !== "undefined") {
              self.globalBestScore = parseInt(data.global_best_score, 10) || 0;
            }

            // Notifikasi terupdate di leaderboard HANYA muncul saat setelah game over saja
            if (isGameOver && numScore > 0) {
              if (isNewBest) {
                self.showToast("🎉 Rekor Baru! Skor terupdate di Leaderboard: " + numScore.toLocaleString() + " 🏆");
              } else {
                self.showToast("🏆 Skor terupdate di Leaderboard: " + numScore.toLocaleString());
              }
            }
          }
        })
        .catch(function (err) {
          console.warn("Gagal sync score:", err);
          if (isGameOver && numScore > 0) {
            self.showToast("🎮 Game Over! Skor: " + numScore.toLocaleString());
          }
        });
      }, isGameOver ? 0 : 300);
    },

    // Game Over Handler: Score Sync & Toast Notification
    onGameOver: function (score, isNewBest) {
      var numScore = parseInt(score, 10) || 0;

      // Sync final score immediately dan tampilkan notifikasi terupdate setelah game over
      this.syncScore(numScore, true, true, isNewBest);
    },

    onGameRestart: function () {
      clearTimeout(this.gameOverModalTimer);
    },

    openUsernameModal: function (canClose) {
      if (!this.modalUsername) this.cacheDom();
      if (!this.modalUsername) return;

      var allowClose = (typeof canClose === "boolean") ? canClose : !!this.username;
      this.modalUsername.setAttribute("data-can-close", allowClose ? "true" : "false");

      if (this.btnCloseUsername) {
        this.btnCloseUsername.style.display = allowClose ? "block" : "none";
      }

      if (this.inputUsername) {
        this.inputUsername.value = this.username || "";
      }
      if (this.errorUsername) {
        this.errorUsername.textContent = "";
        this.errorUsername.style.display = "none";
        this.errorUsername.style.color = "";
        this.errorUsername.classList.remove("is-success-hint");
      }

      this.hasUploadedNewFile = false;
      this.explicitlyRemovedAvatar = false;
      this.pendingAvatar = this.avatar || "";
      this.updateModalAvatarPreview();

      this.openModal(this.modalUsername);

      var self = this;
      setTimeout(function () {
        if (self.inputUsername) {
          self.inputUsername.focus();
          if (self.inputUsername.select) self.inputUsername.select();
        }
      }, 100);
    },

    handleUsernameSubmit: function () {
      if (!this.inputUsername) return;
      var raw = this.inputUsername.value || "";
      var name = raw.trim();

      if (name.length < 2 || name.length > 20) {
        if (this.errorUsername) {
          this.errorUsername.classList.remove("is-success-hint");
          this.errorUsername.style.color = "";
          this.errorUsername.textContent = "Username harus antara 2 hingga 20 karakter.";
          this.errorUsername.style.display = "block";
        }
        return;
      }

      var prevUsername = this.username || "";
      // Only retain local score if editing the exact same player profile
      var currentBest = 0;
      if (prevUsername && prevUsername.toLowerCase() === name.toLowerCase()) {
        currentBest = this.getBestScore();
      }
      var pendingAv = this.pendingAvatar || "";
      var self = this;

      var submitBtn = this.formUsername ? this.formUsername.querySelector("button[type='submit']") : null;
      if (submitBtn) submitBtn.disabled = true;

      fetch("/api/leaderboard.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: name,
          old_username: prevUsername,
          score: currentBest,
          avatar: pendingAv,
          remove_avatar: !!self.explicitlyRemovedAvatar
        })
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (submitBtn) submitBtn.disabled = false;

        if (!data || data.status !== "success") {
          var msg = (data && data.message) ? data.message : "Gagal menyimpan profil.";
          if (self.errorUsername) {
            self.errorUsername.classList.remove("is-success-hint");
            self.errorUsername.style.color = "";
            self.errorUsername.textContent = msg;
            self.errorUsername.style.display = "block";
          }
          return;
        }

        // Synchronize with server player data if returned
        if (data && data.player) {
          self.username = data.player.username || name;
          self.avatar = data.player.avatar || "";
          self.pendingAvatar = self.avatar;

          // Strictly use this player's own personal best score from server
          var serverBest = parseInt(data.player.best_score, 10) || 0;
          if (self.storageManager && self.storageManager.setBestScore) {
            self.storageManager.setBestScore(serverBest);
          } else if (window.localStorage) {
            window.localStorage.setItem("bestScore", serverBest);
          }

          var bestContainer = document.querySelector(".best-container");
          if (bestContainer) {
            bestContainer.textContent = serverBest;
          }
        } else {
          self.username = name;
          self.avatar = self.explicitlyRemovedAvatar ? "" : (pendingAv || self.avatar);
          if (self.storageManager && self.storageManager.setBestScore) {
            self.storageManager.setBestScore(0);
          }
          var bestContainer = document.querySelector(".best-container");
          if (bestContainer) {
            bestContainer.textContent = 0;
          }
        }

        self.hasUploadedNewFile = false;
        self.explicitlyRemovedAvatar = false;

        // Save to localStorage
        try {
          if (window.localStorage) {
            window.localStorage.setItem(USERNAME_KEY, self.username);
            window.localStorage.setItem(AVATAR_KEY, self.avatar);
          }
        } catch (e) {}

        self.updateUserBadge();
        self.closeModal(self.modalUsername);
        self.showToast("✅ Berhasil masuk sebagai " + self.username + "!");

        // Refresh Leaderboard if open
        if (self.modalLeaderboard && self.modalLeaderboard.classList.contains("is-open")) {
          self.loadLeaderboardData();
        }
      })
      .catch(function (err) {
        if (submitBtn) submitBtn.disabled = false;
        if (self.errorUsername) {
          self.errorUsername.classList.remove("is-success-hint");
          self.errorUsername.style.color = "";
          self.errorUsername.textContent = "Terjadi kesalahan koneksi ke server.";
          self.errorUsername.style.display = "block";
        }
      });
    },

    logout: function () {
      if (!this.username) {
        this.showToast("Anda belum masuk ke akun.");
        return;
      }

      var prevName = this.username;
      this.username = "";
      this.avatar = "";
      this.pendingAvatar = "";

      // Clear local storage for user credentials and personal scores
      try {
        if (window.localStorage) {
          window.localStorage.removeItem(USERNAME_KEY);
          window.localStorage.removeItem(AVATAR_KEY);
          window.localStorage.removeItem("bestScore");
          window.localStorage.removeItem("gameState");
        }
      } catch (e) {}

      if (this.storageManager) {
        if (this.storageManager.clearBestScore) this.storageManager.clearBestScore();
        if (this.storageManager.clearGameState) this.storageManager.clearGameState();
      }

      // Reset displays to 0
      var bestContainer = document.querySelector(".best-container");
      if (bestContainer) bestContainer.textContent = 0;
      var scoreContainer = document.querySelector(".score-container");
      if (scoreContainer) scoreContainer.textContent = 0;

      // Restart game to clean state
      var btnRestart = document.getElementById("btn-restart");
      if (btnRestart) {
        btnRestart.click();
      }

      this.updateUserBadge();
      this.closeModal(this.modalLeaderboard);
      this.showToast("🚪 Berhasil keluar akun (" + prevName + ")");

      var self = this;
      setTimeout(function () {
        self.openUsernameModal(false);
      }, 350);
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

          if (typeof data.global_best_score !== "undefined") {
            self.globalBestScore = parseInt(data.global_best_score, 10) || 0;
          }

          self.renderLeaderboard(data.leaderboard || [], data.player);
        })
        .catch(function (err) {
          if (self.ldbBody) self.ldbBody.innerHTML = '<div class="leaderboard-empty">Terjadi kesalahan koneksi.</div>';
        });
    },

    renderLeaderboard: function (list, player) {
      if (this.playerCard) {
        var cardAvatarHtml = "";
        var cardName = "";
        var cardScore = 0;
        var cardRankBadge = "";

        if (player) {
          cardName = this.escapeHtml(player.username);
          cardScore = (player.best_score || 0).toLocaleString();
          cardRankBadge = "Peringkat #" + (player.rank || '-');
          var pAv = player.avatar || (this.username && player.username.toLowerCase() === this.username.toLowerCase() ? this.avatar : "");
          if (pAv) {
            cardAvatarHtml = '<img src="' + this.escapeHtml(pAv) + '" class="user-avatar-img" alt="Avatar">';
          } else {
            cardAvatarHtml = '<div class="user-avatar-placeholder" style="background:' + this.getAvatarGradient(player.username) + '">' + this.getInitials(player.username) + '</div>';
          }
        } else {
          cardName = this.escapeHtml(this.username) || "Anonim";
          cardScore = this.getBestScore().toLocaleString();
          cardRankBadge = "Belum Ada Skor";
          if (this.avatar) {
            cardAvatarHtml = '<img src="' + this.escapeHtml(this.avatar) + '" class="user-avatar-img" alt="Avatar">';
          } else {
            cardAvatarHtml = '<div class="user-avatar-placeholder" style="background:' + this.getAvatarGradient(this.username) + '">' + this.getInitials(this.username) + '</div>';
          }
        }

        this.playerCard.style.display = "flex";
        this.playerCard.innerHTML = 
          '<div class="player-card-left">' +
            '<div class="player-card-avatar">' + cardAvatarHtml + '</div>' +
            '<div>' +
              '<span>Pemain: <strong>' + cardName + '</strong></span><br>' +
              '<span style="font-size:13px; font-weight:normal;">Best Score: <strong>' + cardScore + '</strong></span>' +
            '</div>' +
          '</div>' +
          '<div class="player-rank-badge">' + cardRankBadge + '</div>';
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

        var rowAvatar = row.avatar || (isCurrent ? this.avatar : "");
        var rowAvatarHtml = "";
        if (rowAvatar) {
          rowAvatarHtml = '<div class="table-avatar-wrap"><img src="' + this.escapeHtml(rowAvatar) + '" class="table-avatar-img" alt="Avatar"></div>';
        } else {
          rowAvatarHtml = '<div class="table-avatar-wrap"><div class="table-avatar-placeholder" style="background:' + this.getAvatarGradient(row.username) + '">' + this.getInitials(row.username) + '</div></div>';
        }

        html += '<tr class="' + (isCurrent ? 'current-user-row' : '') + '">';
        html += '<td class="col-rank">' + rankBadge + '</td>';
        html += '<td><div class="player-cell-content">' + rowAvatarHtml + '<span class="player-name">' + this.escapeHtml(row.username) + '</span>' + (isCurrent ? ' <small>(Kamu)</small>' : '') + '</div></td>';
        html += '<td class="col-score">' + (row.best_score || 0).toLocaleString() + '</td>';
        html += '</tr>';
      }

      html += '</tbody></table></div>';
      this.ldbBody.innerHTML = html;
    },

    toggleFullscreen: function () {
      if (window.FullscreenSync) { window.FullscreenSync.toggle(); return; }
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
      if (this.fullscreenIcon) this.fullscreenIcon.textContent = active ? "🗗" : "⛶";
      if (this.btnFullscreen) {
        this.btnFullscreen.setAttribute("title", active ? "Keluar Layar Penuh (Exit Fullscreen)" : "Layar Penuh (Fullscreen)");
      }
      this.updateFullscreenScale();
    },

    updateFullscreenScale: function () {
      var isFs = document.body.classList.contains("is-fullscreen");
      if (!isFs) {
        document.documentElement.style.removeProperty("--mobile-fs-scale");
        document.documentElement.style.removeProperty("--desktop-fs-scale");
        return;
      }

      var w = window.innerWidth;
      var h = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;

      if (w <= 520) {
        // Mobile scaling: available space with safe breathing room
        var availW = Math.max(240, w - 20);
        var availH = Math.max(240, h - 24);
        var baseW = 280;
        var baseH = 370; // Header (~82px) + gap (8px) + board (280px)
        var scale = Math.min(availW / baseW, availH / baseH);
        scale = Math.max(0.65, Math.min(1.45, scale));
        document.documentElement.style.setProperty("--mobile-fs-scale", scale.toFixed(3));
        document.documentElement.style.removeProperty("--desktop-fs-scale");
      } else {
        // Desktop / Laptop scaling: ensure board + header fit on shorter heights
        var baseW = 500;
        var baseH = 612; // Header (~100px) + gap (12px) + board (500px)
        var availW = w - 32;
        var availH = h - 24;
        var scale = Math.min(availW / baseW, availH / baseH, 1.0);
        scale = Math.max(0.50, scale);
        document.documentElement.style.setProperty("--desktop-fs-scale", scale.toFixed(3));
        document.documentElement.style.removeProperty("--mobile-fs-scale");
      }
    },

    openHubModal: function () {
      var modal = document.getElementById("modal-games-hub");
      if (modal) this.openModal(modal);
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
