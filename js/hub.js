/**
 * DWICKY GAME HUB - Engine & State Manager
 * Platform: game.dwicky.dev
 * Version: 3.0.0 (Server-Verified PIN Auth & Multi-Game Sync)
 */

(function () {
  'use strict';

  var GameHub = {
    username: 'Pemain Baru',
    avatar: '',
    token: '',
    isAuthenticated: false,
    isGuest: false,
    currentLdbTab: 'overall',

    // Auth Step State
    targetUsername: '',
    suggestedAvatar: '',
    loginPin: '',
    tempAvatar: '',

    init: function () {
      this.cacheDom();
      this.bindEvents();
      this.initAuth();
      this.loadPersonalBestScores();
      this.fetchTop3Overall();

      // Auto-launch if game query parameter is set (e.g. /?game=snake)
      try {
        var params = new URLSearchParams(window.location.search);
        var gameParam = params.get("game");
        if (gameParam) {
          var validGames = ["2048", "memory", "pacman", "xox", "flappy", "tetris", "snake"];
          if (validGames.indexOf(gameParam) !== -1) {
            this.launchGame("games/" + gameParam + "/");
          }
        }
      } catch (e) {}
    },

    cacheDom: function () {
      // Navbar Profile Elements (Foto di atas, Username di bawahnya)
      this.navAvatarImg = document.getElementById('profile-nav-img');
      this.navAvatarText = document.getElementById('profile-nav-placeholder');
      this.navUsername = document.getElementById('profile-username-display');
      this.profileStatusHint = document.getElementById('profile-status-hint');
      this.btnProfile = document.getElementById('navbar-profile-btn');

      // Navbar Action Buttons
      this.btnFullscreen = document.getElementById('btn-fullscreen');
      this.btnLeaderboard = document.getElementById('btn-leaderboard');
      this.btnLogout = document.getElementById('btn-logout');
      this.btnLoginOpen = document.getElementById('btn-login-open');
      this.btnTop3ViewAll = document.getElementById('top3-view-all-btn');
      this.btnSoundToggle = document.getElementById('btn-sound-toggle');
      this.navSoundIcon = document.getElementById('nav-sound-icon');
      this.btnPwaInstall = document.getElementById('btn-pwa-install');

      // Modals
      this.modalAuth = document.getElementById('modal-auth');
      this.authModalClose = document.getElementById('auth-modal-close');
      this.modalProfile = document.getElementById('modal-profile');
      this.modalLeaderboard = document.getElementById('modal-leaderboard');
      this.toastEl = document.getElementById('toast-notification');

      // Auth Modal Elements - Step 1
      this.authStepUsername = document.getElementById('auth-step-username');
      this.formAuthUsername = document.getElementById('form-auth-username');
      this.authInputUsername = document.getElementById('auth-input-username');
      this.authUsernameError = document.getElementById('auth-username-error');

      // Auth Modal Elements - Step 2A (Login PIN)
      this.authStepLoginPin = document.getElementById('auth-step-login-pin');
      this.loginDisplayUsername = document.getElementById('login-display-username');
      this.loginAvatarPreview = document.getElementById('login-avatar-preview');
      this.btnSwitchUserLogin = document.getElementById('btn-switch-user-login');
      this.loginPinDisplay = document.getElementById('login-pin-display');
      this.loginPinHidden = document.getElementById('login-pin-hidden');
      this.loginPinError = document.getElementById('login-pin-error');
      this.loginKeypad = document.getElementById('login-keypad');
      this.loginSpinner = document.getElementById('login-spinner');

      // Auth Modal Elements - Step 2B (Register PIN)
      this.authStepRegisterPin = document.getElementById('auth-step-register-pin');
      this.regDisplayUsername = document.getElementById('reg-display-username');
      this.regAvatarPreview = document.getElementById('reg-avatar-preview');
      this.btnSwitchUserReg = document.getElementById('btn-switch-user-reg');
      this.formAuthRegister = document.getElementById('form-auth-register');
      this.regInputPin = document.getElementById('reg-input-pin');
      this.regInputPinConfirm = document.getElementById('reg-input-pin-confirm');
      this.regPinError = document.getElementById('reg-pin-error');
      this.btnAuthGuest = document.getElementById('btn-auth-guest');

      // Profile Modal Form & Inputs
      this.formProfile = document.getElementById('form-profile');
      this.inputUsername = document.getElementById('input-username');
      this.inputAvatarFile = document.getElementById('input-avatar-file');
      this.modalAvatarImg = document.getElementById('modal-avatar-preview-img');
      this.modalAvatarText = document.getElementById('modal-avatar-preview-text');
      this.btnRemoveAvatar = document.getElementById('btn-remove-avatar');
      this.btnModalLogoutAction = document.getElementById('btn-modal-logout-action');
      this.btnTogglePinEdit = document.getElementById('btn-toggle-pin-edit');
      this.pinChangeFields = document.getElementById('pin-change-fields');
      this.inputOldPin = document.getElementById('input-old-pin');
      this.inputNewPin = document.getElementById('input-new-pin');

      // Podium Top 3 elements
      this.podiumCard1 = document.getElementById('podium-card-1');
      this.podiumCard2 = document.getElementById('podium-card-2');
      this.podiumCard3 = document.getElementById('podium-card-3');
    },

    bindEvents: function () {
      var self = this;

      // 1. Profile Click in Navbar
      if (this.btnProfile) {
        this.btnProfile.addEventListener('click', function () {
          if (self.isAuthenticated) {
            self.openProfileModal();
          } else {
            self.openAuthModal();
          }
        });
      }

      // 2. Fullscreen Toggle
      if (this.btnFullscreen) {
        this.btnFullscreen.addEventListener('click', function () {
          self.toggleFullscreen();
        });
      }

      var handleFsChange = function () {
        var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (isFs) {
          document.body.classList.add('is-fullscreen');
          if (self.btnFullscreen) {
            self.btnFullscreen.innerHTML = '<span>🗗</span><span class="btn-text">Keluar Layar Penuh</span>';
          }
        } else {
          document.body.classList.remove('is-fullscreen');
          if (self.btnFullscreen) {
            self.btnFullscreen.innerHTML = '<span>⛶</span><span class="btn-text">Layar Penuh</span>';
          }
        }
        var frame = document.getElementById('game-runner-frame');
        if (frame && frame.contentWindow) {
          try {
            frame.contentWindow.postMessage({
              type: 'fullscreen_change',
              isFullscreen: isFs
            }, '*');
          } catch (err) {}
        }
      };

      // 2B. Seamless In-App Game Runner & Persistence
      document.querySelectorAll('.game-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
          var href = card.getAttribute('href');
          if (href && !href.startsWith('http') && !href.startsWith('#')) {
            e.preventDefault();
            self.launchGame(href);
          }
        });
      });

      // PostMessage listener from in-game iframes
      window.addEventListener('message', function (e) {
        if (!e.data) return;
        if (e.data.type === 'close_game' || e.data === 'close_game') {
          self.closeGame();
        } else if (e.data.type === 'switch_game' && e.data.target) {
          self.launchGame(e.data.target);
        }
      });

      // Runner frame click focus transfer
      var runnerContainer = document.getElementById('game-runner-container');
      var runnerFrame = document.getElementById('game-runner-frame');
      if (runnerContainer) {
        runnerContainer.addEventListener('click', function () {
          try {
            if (runnerFrame && runnerFrame.contentWindow) {
              runnerFrame.focus();
              runnerFrame.contentWindow.focus();
            }
          } catch (err) {}
        });
      }

      // Seamless keyboard forwarding from parent window to runner iframe
      window.addEventListener('keydown', function (e) {
        var rContainer = document.getElementById('game-runner-container');
        var rFrame = document.getElementById('game-runner-frame');
        if (!rContainer || !rContainer.classList.contains('is-active')) return;
        if (!rFrame || !rFrame.contentWindow) return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

        var k = (e.key || '').toLowerCase();
        var c = e.code || '';
        var gameKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'p', 'r', 'z', 'x', 'c', 'q'];
        if (gameKeys.indexOf(k) !== -1 || ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space','KeyP','KeyR'].indexOf(c) !== -1) {
          try {
            rFrame.focus();
            rFrame.contentWindow.focus();
            var forwarded = new rFrame.contentWindow.KeyboardEvent('keydown', {
              key: e.key,
              code: e.code,
              keyCode: e.keyCode,
              which: e.which,
              bubbles: true,
              cancelable: true
            });
            rFrame.contentWindow.dispatchEvent(forwarded);
          } catch (err) {}
        }
      });

      // Popstate (Back button) handling
      window.addEventListener('popstate', function (e) {
        var container = document.getElementById('game-runner-container');
        if (container && container.classList.contains('is-active')) {
          self.closeGame(true);
        }
      });

      document.addEventListener('fullscreenchange', handleFsChange);
      document.addEventListener('webkitfullscreenchange', handleFsChange);

      // 3. Leaderboard Modal Triggers
      if (this.btnLeaderboard) {
        this.btnLeaderboard.addEventListener('click', function () {
          self.openLeaderboardModal('overall');
        });
      }
      if (this.btnTop3ViewAll) {
        this.btnTop3ViewAll.addEventListener('click', function () {
          self.openLeaderboardModal('overall');
        });
      }

      // 4. Navbar Auth & Logout Buttons
      if (this.btnLogout) {
        this.btnLogout.addEventListener('click', function () {
          self.logout();
        });
      }
      if (this.btnLoginOpen) {
        this.btnLoginOpen.addEventListener('click', function () {
          self.openAuthModal();
        });
      }
      if (this.btnModalLogoutAction) {
        this.btnModalLogoutAction.addEventListener('click', function () {
          self.logout();
        });
      }

      // 4B. Sound Toggle Button
      if (this.btnSoundToggle) {
        this.btnSoundToggle.addEventListener('click', function () {
          if (window.RetroAudio) {
            var isAudioOn = window.RetroAudio.toggle();
            if (self.navSoundIcon) self.navSoundIcon.textContent = isAudioOn ? '🔊' : '🔇';
            self.showToast(isAudioOn ? 'Suara Diaktifkan 🔊' : 'Suara Dimatikan 🔇');
            if (isAudioOn) window.RetroAudio.play('click');
          }
        });
      }

      // 4C. PWA Install Prompt Handling
      window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        self.deferredInstallPrompt = e;
        if (self.btnPwaInstall) self.btnPwaInstall.style.display = 'inline-flex';
      });

      if (this.btnPwaInstall) {
        this.btnPwaInstall.addEventListener('click', function () {
          if (self.deferredInstallPrompt) {
            self.deferredInstallPrompt.prompt();
            self.deferredInstallPrompt.userChoice.then(function (choice) {
              if (choice.outcome === 'accepted') {
                self.showToast('Terima kasih telah menginstal Game Hub! 📲');
              }
              self.deferredInstallPrompt = null;
              self.btnPwaInstall.style.display = 'none';
            });
          }
        });
      }

      window.addEventListener('appinstalled', function () {
        self.deferredInstallPrompt = null;
        if (self.btnPwaInstall) self.btnPwaInstall.style.display = 'none';
        self.showToast('Game Hub berhasil dipasang di perangkat! 🎉');
      });

      // 5. Modal Close Handlers
      document.querySelectorAll('.modal-backdrop').forEach(function (mb) {
        mb.addEventListener('click', function (e) {
          // Do not close auth modal if mandatory (not authenticated and not guest)
          if (e.target === mb) {
            if (mb === self.modalAuth && !self.isAuthenticated && !self.isGuest) {
              return;
            }
            self.closeModal(mb);
          }
        });
      });

      document.querySelectorAll('.modal-close').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var backdrop = btn.closest('.modal-backdrop');
          if (backdrop === self.modalAuth && !self.isAuthenticated && !self.isGuest) {
            return;
          }
          self.closeModal(backdrop);
        });
      });

      // 6. Auth Step 1: Username Form Submit
      if (this.formAuthUsername) {
        this.formAuthUsername.addEventListener('submit', function (e) {
          e.preventDefault();
          var rawName = (self.authInputUsername.value || '').trim();
          self.handleCheckUser(rawName);
        });
      }

      // 7. Auth Step 2A: PIN Keypad Clicks
      if (this.loginKeypad) {
        this.loginKeypad.addEventListener('click', function (e) {
          var btn = e.target.closest('.pin-key-btn');
          if (!btn) return;
          var key = btn.getAttribute('data-key');
          if (key === 'clear') {
            self.handlePinClear();
          } else if (key === 'backspace') {
            self.handlePinBackspace();
          } else if (/^[0-9]$/.test(key)) {
            self.handlePinDigit(key);
          }
        });
      }

      // PIN hidden input listener for physical keyboard entry
      if (this.loginPinHidden) {
        this.loginPinHidden.addEventListener('input', function (e) {
          var val = (e.target.value || '').replace(/\D/g, '');
          self.loginPin = val.slice(0, 6);
          self.updatePinBoxes();
          if (self.loginPin.length === 6) {
            self.submitLoginPin();
          }
        });
      }

      if (this.loginPinDisplay) {
        this.loginPinDisplay.addEventListener('click', function () {
          if (self.loginPinHidden) self.loginPinHidden.focus();
        });
      }

      // Global keyboard handler when Step 2A is active
      window.addEventListener('keydown', function (e) {
        if (!self.modalAuth || !self.modalAuth.classList.contains('is-open')) return;
        if (self.authStepLoginPin && self.authStepLoginPin.style.display !== 'none') {
          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            self.handlePinDigit(e.key);
          } else if (e.key === 'Backspace') {
            e.preventDefault();
            self.handlePinBackspace();
          } else if (e.key === 'Escape') {
            self.handlePinClear();
          }
        }
      });

      // 8. Auth Step 2B: Register Form Submit
      if (this.formAuthRegister) {
        this.formAuthRegister.addEventListener('submit', function (e) {
          e.preventDefault();
          var pin = (self.regInputPin.value || '').trim();
          var pinConfirm = (self.regInputPinConfirm.value || '').trim();
          self.submitRegister(pin, pinConfirm);
        });
      }

      // 9. Switch user buttons (back to Step 1)
      if (this.btnSwitchUserLogin) {
        this.btnSwitchUserLogin.addEventListener('click', function () {
          self.showAuthStep('username');
        });
      }
      if (this.btnSwitchUserReg) {
        this.btnSwitchUserReg.addEventListener('click', function () {
          self.showAuthStep('username');
        });
      }

      // 10. Guest mode button
      var btnForgotPin = document.getElementById('btn-forgot-pin');
      if (btnForgotPin) {
        btnForgotPin.addEventListener('click', function () {
          var msg = 'Bantuan PIN:\n\nPIN akun Anda di sistem saat ini adalah 123123.\n\nSilakan masukkan 123123 untuk login. Setelah masuk, Anda dapat langsung mengganti PIN ke angka baru di menu Profil!';
          alert(msg);
        });
      }

            if (this.btnAuthGuest) {
        this.btnAuthGuest.addEventListener('click', function () {
          self.handleGuestMode();
        });
      }

      // 11. Profile Modal: Toggle PIN change
      if (this.btnTogglePinEdit) {
        this.btnTogglePinEdit.addEventListener('click', function () {
          if (!self.pinChangeFields) return;
          var isHidden = self.pinChangeFields.style.display === 'none';
          self.pinChangeFields.style.display = isHidden ? 'block' : 'none';
          self.btnTogglePinEdit.textContent = isHidden ? 'Batal Ubah PIN' : 'Ubah PIN';
        });
      }

      // 12. Profile Form Submit (Save changes)
      if (this.formProfile) {
        this.formProfile.addEventListener('submit', function (e) {
          e.preventDefault();
          self.saveProfileFromModal();
        });
      }

      // 13. Avatar File Upload
      if (this.inputAvatarFile) {
        this.inputAvatarFile.addEventListener('change', function (e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;

          if (!file.type.match(/^image\//)) {
            self.showToast('File harus berupa gambar (JPG/PNG/WEBP)');
            return;
          }

          var reader = new FileReader();
          reader.onload = function (evt) {
            self.resizeAvatarImage(evt.target.result, function (compressedDataUrl) {
              self.tempAvatar = compressedDataUrl;
              self.updateModalAvatarPreview(compressedDataUrl, self.username);
              self.showToast('Foto berhasil dimuat. Klik Simpan Profil!');
            });
          };
          reader.readAsDataURL(file);
        });
      }

      // 14. Remove Avatar
      if (this.btnRemoveAvatar) {
        this.btnRemoveAvatar.addEventListener('click', function () {
          self.tempAvatar = '';
          self.updateModalAvatarPreview('', self.username);
          self.showToast('Foto profil akan dihapus saat disimpan');
        });
      }

      // 15. Leaderboard Tab Clicks
      document.querySelectorAll('.ldb-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          document.querySelectorAll('.ldb-tab').forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          var gameKey = tab.getAttribute('data-tab');
          self.loadLeaderboardTable(gameKey);
        });
      });
    },

    /* ========================================================
       AUTH & SESSION ENGINE
       ======================================================== */
    initAuth: function () {
      var self = this;
      var savedToken = '';
      try {
        savedToken = localStorage.getItem('game_hub_token') || '';
      } catch (e) {}

      if (savedToken) {
        // Verify token with backend
        fetch('/api/auth.php?action=verify', {
          headers: {
            'Authorization': 'Bearer ' + savedToken
          }
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.status === 'success' && data.authenticated) {
            self.token = savedToken;
            self.username = data.user.username;
            self.avatar = data.user.avatar || '';
            self.isAuthenticated = true;
            self.isGuest = false;
            self.saveProfileLocal(self.username, self.avatar);
            self.updateProfileUI();
            self.closeModal(self.modalAuth);
          } else {
            self.onSessionInvalid();
          }
        })
        .catch(function () {
          // If network error, still check local storage fallback
          self.loadProfileFallback();
        });
      } else {
        this.onSessionInvalid();
      }
    },

    onSessionInvalid: function () {
      this.token = '';
      this.isAuthenticated = false;
      this.loadProfileFallback();
      this.updateProfileUI();
      // Show login dialog at start as requested by user
      this.openAuthModal();
    },

    loadProfileFallback: function () {
      try {
        var u = localStorage.getItem('user_profile_name') || localStorage.getItem('2048_username');
        if (u) {
          this.username = u;
          if (this.authInputUsername) this.authInputUsername.value = u;
        }
        var av = localStorage.getItem('user_profile_avatar') || localStorage.getItem('2048_avatar');
        if (av) this.avatar = av;
      } catch (e) {}
    },

    saveProfileLocal: function (newName, newAvatar) {
      if (newName) this.username = newName;
      if (typeof newAvatar !== 'undefined') this.avatar = newAvatar;
      try {
        if (this.token) localStorage.setItem('game_hub_token', this.token);
        localStorage.setItem('user_profile_name', this.username);
        localStorage.setItem('2048_username', this.username);
        localStorage.setItem('user_profile_avatar', this.avatar);
        localStorage.setItem('2048_avatar', this.avatar);
      } catch (e) {}
    },

    updateProfileUI: function () {
      // 1. Username label
      if (this.navUsername) {
        this.navUsername.textContent = this.username;
      }

      // 2. Status hint
      if (this.profileStatusHint) {
        if (this.isAuthenticated) {
          this.profileStatusHint.textContent = 'Akun Terverifikasi';
          this.profileStatusHint.style.color = '#38bdf8';
        } else if (this.isGuest) {
          this.profileStatusHint.textContent = 'Mode Tamu';
          this.profileStatusHint.style.color = '#facc15';
        } else {
          this.profileStatusHint.textContent = 'Belum Masuk';
          this.profileStatusHint.style.color = '#94a3b8';
        }
      }

      // 3. Avatar Photo
      if (this.avatar) {
        if (this.navAvatarImg) {
          this.navAvatarImg.src = this.avatar;
          this.navAvatarImg.style.display = 'block';
        }
        if (this.navAvatarText) {
          this.navAvatarText.style.display = 'none';
        }
      } else {
        if (this.navAvatarImg) {
          this.navAvatarImg.src = '';
          this.navAvatarImg.removeAttribute('src');
          this.navAvatarImg.style.display = 'none';
        }
        if (this.navAvatarText) {
          this.navAvatarText.textContent = (this.username && this.username !== 'Pemain Baru') ? this.username.charAt(0).toUpperCase() : '👤';
          this.navAvatarText.style.display = 'flex';
        }
      }

      // 4. Action Buttons (Logout vs Login)
      if (this.btnLogout) {
        this.btnLogout.style.display = this.isAuthenticated ? 'inline-flex' : 'none';
      }
      if (this.btnLoginOpen) {
        this.btnLoginOpen.style.display = this.isAuthenticated ? 'none' : 'inline-flex';
      }

      // 5. Sound Button State
      if (this.navSoundIcon && window.RetroAudio) {
        this.navSoundIcon.textContent = window.RetroAudio.isEnabled() ? '🔊' : '🔇';
      }
    },

    /* ========================================================
       AUTH MODAL FLOW (STEP 1, 2A, 2B)
       ======================================================== */
    openAuthModal: function () {
      this.showAuthStep('username');
      if (this.authUsernameError) this.authUsernameError.style.display = 'none';
      if (this.loginPinError) this.loginPinError.style.display = 'none';
      if (this.regPinError) this.regPinError.style.display = 'none';

      // If user is already authenticated or guest, allow closing modal
      if (this.authModalClose) {
        this.authModalClose.style.display = (this.isAuthenticated || this.isGuest) ? 'block' : 'none';
      }

      this.openModal(this.modalAuth);
      if (this.authInputUsername) {
        var self = this;
        setTimeout(function () {
          self.authInputUsername.focus();
        }, 150);
      }
    },

    showAuthStep: function (step) {
      if (this.authStepUsername) this.authStepUsername.style.display = (step === 'username') ? 'block' : 'none';
      if (this.authStepLoginPin) this.authStepLoginPin.style.display = (step === 'login_pin') ? 'block' : 'none';
      if (this.authStepRegisterPin) this.authStepRegisterPin.style.display = (step === 'register_pin') ? 'block' : 'none';
    },

    handleCheckUser: function (rawName) {
      var self = this;
      if (!rawName || rawName.length < 2 || rawName.length > 20) {
        this.showAuthError(this.authUsernameError, 'Username harus terdiri dari 2 - 20 karakter.');
        return;
      }

      var btnCheck = document.getElementById('btn-auth-check');
      if (btnCheck) {
        btnCheck.disabled = true;
        btnCheck.innerHTML = '<span>Memeriksa...</span>';
      }

      fetch('/api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_user', username: rawName })
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (btnCheck) {
          btnCheck.disabled = false;
          btnCheck.innerHTML = '<span>Lanjutkan</span><span>➔</span>';
        }

        if (data && data.status === 'success') {
          self.targetUsername = data.username;
          if (data.exists) {
            // STEP 2A: Pemain sudah terdaftar -> Minta PIN 6 Digit
            self.prepareLoginPinStep(data.username, data.avatar);
          } else {
            // STEP 2B: Pemain baru -> Minta buat PIN 6 Digit
            self.prepareRegisterPinStep(data.username, data.suggested_avatar);
          }
        } else {
          self.showAuthError(self.authUsernameError, (data && data.message) || 'Gagal memeriksa username.');
        }
      })
      .catch(function () {
        if (btnCheck) {
          btnCheck.disabled = false;
          btnCheck.innerHTML = '<span>Lanjutkan</span><span>➔</span>';
        }
        self.showAuthError(self.authUsernameError, 'Koneksi ke server gagal. Coba lagi.');
      });
    },

    prepareLoginPinStep: function (username, avatar) {
      this.loginPin = '';
      if (this.loginDisplayUsername) this.loginDisplayUsername.textContent = username;
      if (this.loginAvatarPreview) {
        if (avatar) {
          this.loginAvatarPreview.innerHTML = '<img src="' + avatar + '" alt="' + username + '">';
        } else {
          this.loginAvatarPreview.textContent = username.charAt(0).toUpperCase() || '👤';
        }
      }
      this.updatePinBoxes();
      if (this.loginPinError) this.loginPinError.style.display = 'none';
      if (this.loginSpinner) this.loginSpinner.style.display = 'none';
      if (this.loginKeypad) this.loginKeypad.style.display = 'grid';
      this.showAuthStep('login_pin');
      if (this.loginPinHidden) {
        this.loginPinHidden.value = '';
        var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 768);
        if (!isTouchDevice) {
          try { this.loginPinHidden.focus(); } catch (e) {}
        }
      }
    },

    prepareRegisterPinStep: function (username, suggestedAvatar) {
      this.suggestedAvatar = suggestedAvatar || '';
      if (this.regDisplayUsername) this.regDisplayUsername.textContent = username;
      if (this.regAvatarPreview) {
        if (suggestedAvatar) {
          this.regAvatarPreview.innerHTML = '<img src="' + suggestedAvatar + '" alt="' + username + '">';
        } else {
          this.regAvatarPreview.textContent = '✨';
        }
      }
      if (this.regInputPin) this.regInputPin.value = '';
      if (this.regInputPinConfirm) this.regInputPinConfirm.value = '';
      if (this.regPinError) this.regPinError.style.display = 'none';
      this.showAuthStep('register_pin');
      if (this.regInputPin) {
        var self = this;
        setTimeout(function () { self.regInputPin.focus(); }, 150);
      }
    },

    handlePinDigit: function (digit) {
      if (this.loginPin.length >= 6) return;
      this.loginPin += digit;
      this.updatePinBoxes();
      if (this.loginPin.length === 6) {
        this.submitLoginPin();
      }
    },

    handlePinBackspace: function () {
      if (this.loginPin.length > 0) {
        this.loginPin = this.loginPin.slice(0, -1);
        this.updatePinBoxes();
      }
    },

    handlePinClear: function () {
      this.loginPin = '';
      this.updatePinBoxes();
    },

    updatePinBoxes: function () {
      var self = this;
      var boxes = document.querySelectorAll('#login-pin-display .pin-dot-box');
      boxes.forEach(function (box, idx) {
        if (idx < self.loginPin.length) {
          box.textContent = '●';
          box.classList.add('filled');
          box.classList.remove('active');
        } else if (idx === self.loginPin.length) {
          box.textContent = '';
          box.classList.remove('filled');
          box.classList.add('active');
        } else {
          box.textContent = '';
          box.classList.remove('filled');
          box.classList.remove('active');
        }
      });
      if (this.loginPinHidden) {
        this.loginPinHidden.value = this.loginPin;
      }
    },

    submitLoginPin: function () {
      var self = this;
      if (this.loginSpinner) this.loginSpinner.style.display = 'flex';
      if (this.loginKeypad) this.loginKeypad.style.display = 'none';
      if (this.loginPinError) this.loginPinError.style.display = 'none';

      fetch('/api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username: this.targetUsername,
          pin: this.loginPin
        })
      })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        }).catch(function () {
          return { ok: false, data: null, status: res.status };
        });
      })
      .then(function (result) {
        var data = result.data;
        if (result.ok && data && data.status === 'success') {
          self.token = data.token;
          self.username = data.user.username;
          self.avatar = data.user.avatar || '';
          self.isAuthenticated = true;
          self.isGuest = false;
          self.saveProfileLocal(self.username, self.avatar);
          self.updateProfileUI();
          self.closeModal(self.modalAuth);
          self.showToast('Selamat datang kembali, ' + self.username + '! 🎮');
          self.loadPersonalBestScores();
          self.fetchTop3Overall();
        } else {
          var msg = (data && data.message) ? data.message : 'PIN keamanan salah. Silakan coba lagi.';
          self.onPinFailed(msg);
        }
      })
      .catch(function (err) {
        self.onPinFailed('Koneksi gagal saat memverifikasi PIN.');
      });
    },

    onPinFailed: function (msg) {
      var self = this;
      if (this.loginSpinner) this.loginSpinner.style.display = 'none';
      if (this.loginKeypad) this.loginKeypad.style.display = 'grid';
      this.showAuthError(this.loginPinError, msg);

      // Shake animation
      var boxes = document.querySelectorAll('#login-pin-display .pin-dot-box');
      boxes.forEach(function (b) { b.classList.add('shake'); });

      setTimeout(function () {
        boxes.forEach(function (b) { b.classList.remove('shake'); });
        self.handlePinClear();
      }, 500);
    },

    submitRegister: function (pin, pinConfirm) {
      var self = this;
      if (!/^[0-9]{6}$/.test(pin)) {
        this.showAuthError(this.regPinError, 'PIN harus tepat 6 digit angka.');
        return;
      }
      if (pin !== pinConfirm) {
        this.showAuthError(this.regPinError, 'Konfirmasi PIN tidak cocok dengan PIN yang dibuat.');
        return;
      }

      var btnSubmit = document.getElementById('btn-auth-register-submit');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>Mendaftarkan Akun...</span>';
      }

      fetch('/api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          username: this.targetUsername,
          pin: pin,
          avatar: this.suggestedAvatar || ''
        })
      })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        }).catch(function () {
          return { ok: false, data: null, status: res.status };
        });
      })
      .then(function (result) {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>Daftar & Mulai Bermain</span><span>🚀</span>';
        }

        var data = result.data;
        if (result.ok && data && data.status === 'success') {
          self.token = data.token;
          self.username = data.user.username;
          self.avatar = data.user.avatar || '';
          self.isAuthenticated = true;
          self.isGuest = false;
          self.saveProfileLocal(self.username, self.avatar);
          self.updateProfileUI();
          self.closeModal(self.modalAuth);
          self.showToast('Akun & PIN berhasil dibuat! Selamat bermain, ' + self.username + ' 🎉');
          self.loadPersonalBestScores();
          self.fetchTop3Overall();
        } else {
          var msg = (data && data.message) ? data.message : 'Gagal mendaftarkan akun.';
          self.showAuthError(self.regPinError, msg);
        }
      })
      .catch(function () {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>Daftar & Mulai Bermain</span><span>🚀</span>';
        }
        self.showAuthError(self.regPinError, 'Koneksi ke server gagal.');
      });
    },

    handleGuestMode: function () {
      this.isGuest = true;
      this.isAuthenticated = false;
      this.token = '';
      if (!this.username || this.username === 'Pemain Baru') {
        this.username = 'Tamu_' + Math.floor(1000 + Math.random() * 9000);
      }
      this.saveProfileLocal(this.username, this.avatar);
      this.updateProfileUI();
      this.closeModal(this.modalAuth);
      this.showToast('Masuk sebagai Tamu: ' + this.username);
    },

    logout: function () {
      var self = this;
      if (this.token) {
        fetch('/api/auth.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'logout', token: this.token })
        }).catch(function () {});
      }

      try {
        localStorage.removeItem('game_hub_token');
        localStorage.removeItem('user_profile_name');
        localStorage.removeItem('2048_username');
        localStorage.removeItem('user_profile_avatar');
        localStorage.removeItem('2048_avatar');
        localStorage.removeItem('2048_player_avatar');
        localStorage.removeItem('2048_player_username');
      } catch (e) {}

      this.token = '';
      this.username = 'Pemain Baru';
      this.avatar = '';
      this.tempAvatar = '';
      this.suggestedAvatar = '';
      this.isAuthenticated = false;
      this.isGuest = false;

      // Clear DOM image sources immediately
      if (this.navAvatarImg) {
        this.navAvatarImg.src = '';
        this.navAvatarImg.removeAttribute('src');
        this.navAvatarImg.style.display = 'none';
      }
      if (this.modalAvatarImg) {
        this.modalAvatarImg.src = '';
        this.modalAvatarImg.removeAttribute('src');
        this.modalAvatarImg.style.display = 'none';
      }
      var pvImg = document.getElementById('pv-img');
      if (pvImg) {
        pvImg.src = '';
        pvImg.removeAttribute('src');
        pvImg.style.display = 'none';
      }

      this.closeModal(this.modalProfile);
      this.updateProfileUI();
      this.showToast('Anda telah logout dari akun.');
      this.openAuthModal();
    },

    showAuthError: function (el, msg) {
      if (!el) return;
      el.textContent = msg;
      el.style.display = 'block';
    },

    /* ========================================================
       MODAL PROFIL & EDIT
       ======================================================== */
    openProfileModal: function () {
      this.tempAvatar = this.avatar;
      if (this.inputUsername) this.inputUsername.value = this.username;
      this.updateModalAvatarPreview(this.avatar, this.username);
      if (this.pinChangeFields) {
        this.pinChangeFields.style.display = 'none';
        if (this.btnTogglePinEdit) this.btnTogglePinEdit.textContent = 'Ubah PIN';
      }
      if (this.inputOldPin) this.inputOldPin.value = '';
      if (this.inputNewPin) this.inputNewPin.value = '';
      this.openModal(this.modalProfile);
    },

    updateModalAvatarPreview: function (avatarSrc, username) {
      if (avatarSrc) {
        if (this.modalAvatarImg) {
          this.modalAvatarImg.src = avatarSrc;
          this.modalAvatarImg.style.display = 'block';
        }
        if (this.modalAvatarText) this.modalAvatarText.style.display = 'none';
        if (this.btnRemoveAvatar) this.btnRemoveAvatar.style.display = 'inline-block';
      } else {
        if (this.modalAvatarImg) {
          this.modalAvatarImg.src = '';
          this.modalAvatarImg.removeAttribute('src');
          this.modalAvatarImg.style.display = 'none';
        }
        if (this.modalAvatarText) {
          this.modalAvatarText.textContent = (username && username !== 'Pemain Baru') ? username.charAt(0).toUpperCase() : '👤';
          this.modalAvatarText.style.display = 'flex';
        }
        if (this.btnRemoveAvatar) this.btnRemoveAvatar.style.display = 'none';
      }
    },

    saveProfileFromModal: function () {
      var self = this;
      var newName = (this.inputUsername.value || '').trim();
      if (newName.length < 2 || newName.length > 20) {
        this.showToast('Username harus 2 - 20 karakter');
        return;
      }

      var newAvatar = (typeof this.tempAvatar !== 'undefined') ? this.tempAvatar : this.avatar;
      var oldPin = this.inputOldPin ? (this.inputOldPin.value || '').trim() : '';
      var newPin = this.inputNewPin ? (this.inputNewPin.value || '').trim() : '';

      if (newPin && !/^[0-9]{6}$/.test(newPin)) {
        this.showToast('PIN baru harus 6 digit angka');
        return;
      }

      // If user is authenticated, sync to auth backend
      if (this.isAuthenticated && this.token) {
        var payload = {
          action: 'update_profile',
          token: this.token,
          username: newName,
          avatar: newAvatar
        };
        if (newPin) {
          payload.old_pin = oldPin;
          payload.new_pin = newPin;
        }

        fetch('/api/auth.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.status === 'success') {
            self.saveProfileLocal(newName, newAvatar);
            self.updateProfileUI();
            self.closeModal(self.modalProfile);
            self.showToast('Profil pemain berhasil diperbarui!');
            self.fetchTop3Overall();
          } else {
            self.showToast((data && data.message) || 'Gagal memperbarui profil');
          }
        })
        .catch(function () {
          self.showToast('Gagal terhubung ke server');
        });
      } else {
        // Guest mode fallback
        this.saveProfileLocal(newName, newAvatar);
        this.updateProfileUI();
        this.closeModal(this.modalProfile);
        this.showToast('Profil tersimpan di perangkat!');
        this.syncProfileToLeaderboardBackend();
      }
    },

    syncProfileToLeaderboardBackend: function () {
      var self = this;
      fetch('/api/leaderboard.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: '2048',
          username: this.username,
          avatar: this.avatar,
          score: 0
        })
      }).then(function () {
        self.fetchTop3Overall();
      }).catch(function () {});
    },

    resizeAvatarImage: function (dataUrl, callback) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var maxDim = 180;
        var w = img.width;
        var h = img.height;
        var minSide = Math.min(w, h);
        var sx = (w - minSide) / 2;
        var sy = (h - minSide) / 2;

        canvas.width = maxDim;
        canvas.height = maxDim;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxDim, maxDim);

        var compressed = canvas.toDataURL('image/jpeg', 0.82);
        callback(compressed);
      };
      img.src = dataUrl;
    },

    /* ========================================================
       GAME HIGH SCORES & TOP 3 PODIUM
       ======================================================== */
    loadPersonalBestScores: function () {
      var self = this;
      var games = ['2048', 'memory', 'pacman', 'xox', 'flappy', 'tetris', 'snake'];
      games.forEach(function (gKey) {
        // Read local storage first
        var localScore = 0;
        try {
          if (gKey === '2048') localScore = parseInt(localStorage.getItem('bestScore') || '0', 10);
          else if (gKey === 'memory') localScore = parseInt(localStorage.getItem('memory_best_score') || '0', 10);
          else if (gKey === 'pacman') localScore = parseInt(localStorage.getItem('pacman_high_score') || '0', 10);
          else if (gKey === 'xox') localScore = parseInt(localStorage.getItem('xox_wins_total') || '0', 10);
          else if (gKey === 'flappy') localScore = parseInt(localStorage.getItem('flappy_best_score') || '0', 10);
          else if (gKey === 'tetris') localScore = parseInt(localStorage.getItem('tetris_best_score') || '0', 10);
          else if (gKey === 'snake') localScore = parseInt(localStorage.getItem('snake_best_score') || '0', 10);
        } catch (e) {}

        var el = document.getElementById('card-score-' + gKey);
        if (el) el.textContent = isNaN(localScore) ? '0' : localScore.toLocaleString();

        // Query server score if username is set
        if (self.username && self.username !== 'Pemain Baru') {
          fetch('/api/leaderboard.php?game=' + encodeURIComponent(gKey) + '&username=' + encodeURIComponent(self.username))
            .then(function (res) { return res.json(); })
            .then(function (data) {
              if (data && data.player && typeof data.player.best_score !== 'undefined') {
                var s = Math.max(data.player.best_score, localScore || 0);
                var target = document.getElementById('card-score-' + gKey);
                if (target) target.textContent = s.toLocaleString();
              }
            }).catch(function () {});
        }
      });
    },

    fetchTop3Overall: function () {
      var self = this;
      fetch('/api/leaderboard.php?action=overall_top')
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.status === 'success' && Array.isArray(data.overall_top)) {
            self.renderTop3Podium(data.overall_top);
          }
        })
        .catch(function () {});
    },

    renderTop3Podium: function (topList) {
      var p1 = topList[0] || null;
      var p2 = topList[1] || null;
      var p3 = topList[2] || null;

      this.updatePodiumCard(this.podiumCard1, p1, '🥇', 'Juara 1 Global');
      this.updatePodiumCard(this.podiumCard2, p2, '🥈', 'Peringkat 2');
      this.updatePodiumCard(this.podiumCard3, p3, '🥉', 'Peringkat 3');
    },

    updatePodiumCard: function (cardEl, p, medal, label) {
      if (!cardEl) return;
      var nameEl = cardEl.querySelector('.podium-name');
      var scoreEl = cardEl.querySelector('.podium-score');
      var countEl = cardEl.querySelector('.podium-games-count');
      var avWrap = cardEl.querySelector('.podium-avatar-wrap');

      if (!p) {
        cardEl.removeAttribute('data-player-username');
        cardEl.removeAttribute('data-player-avatar');
        if (nameEl) nameEl.textContent = 'Belum Ada';
        if (scoreEl) scoreEl.textContent = '0 Poin';
        if (countEl) countEl.textContent = '- Game';
        if (avWrap) avWrap.innerHTML = '<div class="podium-avatar-placeholder">' + medal + '</div><span class="podium-rank-badge">' + medal + '</span>';
        return;
      }
      cardEl.setAttribute('data-player-username', p.username || '');
      cardEl.setAttribute('data-player-avatar', p.avatar || '');

      if (nameEl) nameEl.textContent = p.username || 'Pemain';
      if (scoreEl) scoreEl.textContent = Number(p.total_score || 0).toLocaleString() + ' Poin';
      if (countEl) countEl.textContent = (p.games_played || 1) + ' Game Dimainkan';

      if (avWrap) {
        var avHtml = '';
        if (p.avatar) {
          avHtml = '<img src="' + p.avatar + '" class="podium-avatar" alt="' + p.username + '">';
        } else {
          var initial = (p.username || '?').charAt(0).toUpperCase();
          avHtml = '<div class="podium-avatar-placeholder">' + initial + '</div>';
        }
        avWrap.innerHTML = avHtml + '<span class="podium-rank-badge">' + medal + '</span>';
      }
    },

    /* ========================================================
       GLOBAL LEADERBOARD MODAL
       ======================================================== */
    openLeaderboardModal: function (gameKey) {
      this.openModal(this.modalLeaderboard);
      var targetTab = gameKey || 'overall';
      document.querySelectorAll('.ldb-tab').forEach(function (t) {
        if (t.getAttribute('data-tab') === targetTab) t.classList.add('active');
        else t.classList.remove('active');
      });
      this.loadLeaderboardTable(targetTab);
    },

    loadLeaderboardTable: function (tab) {
      var self = this;
      var body = document.getElementById('leaderboard-body-content');
      if (!body) return;
      body.innerHTML = '<div style="text-align:center; padding:24px; color:#94a3b8;">Memuat data peringkat...</div>';

      if (tab === 'overall') {
        fetch('/api/leaderboard.php?action=overall_top')
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data && data.status === 'success') {
              self.renderOverallTable(data.overall_top || []);
            }
          });
      } else {
        fetch('/api/leaderboard.php?game=' + encodeURIComponent(tab) + '&username=' + encodeURIComponent(this.username))
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data && data.status === 'success') {
              self.renderGameTable(data.leaderboard || [], data.player, tab);
            }
          });
      }
    },

    renderOverallTable: function (list) {
      var body = document.getElementById('leaderboard-body-content');
      if (!body) return;

      if (!list || list.length === 0) {
        body.innerHTML = '<div style="text-align:center; padding:24px; color:#94a3b8;">Belum ada skor tercatat. Mulai mainkan game untuk menjadi juara!</div>';
        return;
      }

      var html = '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
      html += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#94a3b8; text-align:left;">' +
              '<th style="padding:8px 6px;">Rank</th>' +
              '<th style="padding:8px 6px;">Pemain</th>' +
              '<th style="padding:8px 6px; text-align:center;">Game</th>' +
              '<th style="padding:8px 6px; text-align:right;">Total Poin</th>' +
              '</tr></thead><tbody>';

      list.forEach(function (row) {
        var medal = row.rank === 1 ? '🥇' : (row.rank === 2 ? '🥈' : (row.rank === 3 ? '🥉' : '#' + row.rank));
        var av = row.avatar ? '<img src="' + row.avatar + '" style="width:26px; height:26px; border-radius:50%; object-fit:cover;">' :
                 '<div style="width:26px; height:26px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">' + (row.username ? row.username.charAt(0).toUpperCase() : '?') + '</div>';

        html += '<tr class="leaderboard-player-row" data-player-username="' + (row.username || '') + '" data-player-avatar="' + (row.avatar || '') + '" style="cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);">' +
                '<td style="padding:10px 6px; font-weight:800; font-size:14px;">' + medal + '</td>' +
                '<td style="padding:10px 6px;"><div style="display:flex; align-items:center; gap:8px;">' + av + '<span style="font-weight:700;">' + row.username + '</span></div></td>' +
                '<td style="padding:10px 6px; text-align:center; color:#94a3b8; font-size:12px;">' + row.games_played + '</td>' +
                '<td style="padding:10px 6px; text-align:right; font-weight:800; color:#38bdf8;">' + Number(row.total_score).toLocaleString() + '</td>' +
                '</tr>';
      });

      html += '</tbody></table>';
      body.innerHTML = html;
    },

    renderGameTable: function (list, player, gameKey) {
      var body = document.getElementById('leaderboard-body-content');
      if (!body) return;

      var html = '';
      if (player) {
        html += '<div style="background:rgba(255,255,255,0.06); padding:10px 14px; border-radius:10px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">' +
                '<div><span style="font-size:11px; color:#94a3b8;">Pemain Kamu:</span><br><strong>' + (player.username || '-') + '</strong></div>' +
                '<div style="text-align:right;"><span style="font-size:11px; color:#94a3b8;">Rekor:</span><br><strong style="color:#facc15;">' + (player.best_score || 0) + '</strong> (Rank #' + (player.rank || '-') + ')</div>' +
                '</div>';
      }

      if (!list || list.length === 0) {
        body.innerHTML = html + '<div style="text-align:center; padding:24px; color:#94a3b8;">Belum ada rekor di game ini. Jadilah yang pertama!</div>';
        return;
      }

      html += '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
      html += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#94a3b8; text-align:left;">' +
              '<th style="padding:8px 6px;">Rank</th>' +
              '<th style="padding:8px 6px;">Pemain</th>' +
              '<th style="padding:8px 6px; text-align:right;">Skor Rekor</th>' +
              '</tr></thead><tbody>';

      list.forEach(function (row) {
        var medal = row.rank === 1 ? '🥇' : (row.rank === 2 ? '🥈' : (row.rank === 3 ? '🥉' : '#' + row.rank));
        var av = row.avatar ? '<img src="' + row.avatar + '" style="width:26px; height:26px; border-radius:50%; object-fit:cover;">' :
                 '<div style="width:26px; height:26px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">' + (row.username ? row.username.charAt(0).toUpperCase() : '?') + '</div>';

        html += '<tr class="leaderboard-player-row" data-player-username="' + (row.username || '') + '" data-player-avatar="' + (row.avatar || '') + '" style="cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);">' +
                '<td style="padding:10px 6px; font-weight:800; font-size:14px;">' + medal + '</td>' +
                '<td style="padding:10px 6px;"><div style="display:flex; align-items:center; gap:8px;">' + av + '<span style="font-weight:700;">' + row.username + '</span></div></td>' +
                '<td style="padding:10px 6px; text-align:right; font-weight:800; color:#38bdf8;">' + Number(row.best_score).toLocaleString() + '</td>' +
                '</tr>';
      });

      html += '</tbody></table>';
      body.innerHTML = html;
    },

    /* ========================================================
       UTILITIES & MODAL CONTROLS
       ======================================================== */
    toggleFullscreen: function () {
      if (window.FullscreenSync) { window.FullscreenSync.toggle(); return; }
      var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (isFs) {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) ex.call(document);
        document.body.classList.remove('is-fullscreen');
      } else {
        var req = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
        if (req) {
          req.call(document.documentElement);
          document.body.classList.add('is-fullscreen');
          this.showToast('⛶ Mode Layar Penuh Aktif');
        }
      }
    },

    launchGame: function (gamePath) {
      var container = document.getElementById('game-runner-container');
      var frame = document.getElementById('game-runner-frame');
      if (!container || !frame) {
        window.location.href = gamePath;
        return;
      }

      if (window.RetroAudio) {
        try { window.RetroAudio.play('click'); } catch (e) {}
      }

      if (gamePath && !gamePath.endsWith('/') && !gamePath.endsWith('.html')) {
        gamePath += '/';
      }

      container.style.display = 'flex';
      container.classList.add('is-active');
      container.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      frame.src = gamePath;

      try {
        history.pushState({ inGame: true, gamePath: gamePath }, '', gamePath);
      } catch (e) {}

      var focusFrame = function () {
        try {
          if (frame && frame.contentWindow) {
            frame.focus();
            frame.contentWindow.focus();
          }
        } catch (e) {}
      };

      frame.onload = function () {
        focusFrame();
      };

      setTimeout(focusFrame, 100);
      setTimeout(focusFrame, 300);
      setTimeout(focusFrame, 600);
    },

    closeGame: function (fromPopState) {
      var container = document.getElementById('game-runner-container');
      var frame = document.getElementById('game-runner-frame');
      if (!container || !frame) return;

      if (window.RetroAudio) {
        try { window.RetroAudio.play('click'); } catch (e) {}
      }

      container.classList.remove('is-active');
      container.style.display = 'none';
      container.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      frame.src = 'about:blank';
      window.focus();

      if (!fromPopState) {
        try {
          history.pushState(null, '', '/');
        } catch (e) {}
      }

      if (typeof this.fetchTop3Overall === 'function') {
        this.fetchTop3Overall();
      }
    },

    openModal: function (m) {
      if (m) {
        m.classList.add('is-open');
        m.style.display = 'flex';
        if (window.RetroAudio) window.RetroAudio.play('click');
      }
    },

    closeModal: function (m) {
      if (m) {
        m.classList.remove('is-open');
        m.style.display = 'none';
        if (window.RetroAudio) window.RetroAudio.play('click');
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
      }, 2400);
    }
  };

  // Service Worker Registration for PWA & Offline Support
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    GameHub.init();
    window.GameHub = GameHub;
  });

})();
