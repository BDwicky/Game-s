/**
 * DWICKY GAME HUB - Engine & State Manager
 * Platform: game.dwicky.dev
 */

(function () {
  'use strict';

  var GameHub = {
    username: 'Pemain Baru',
    avatar: '',
    currentLdbTab: 'overall',

    init: function () {
      this.loadProfile();
      this.cacheDom();
      this.bindEvents();
      this.updateProfileUI();
      this.loadPersonalBestScores();
      this.fetchTop3Overall();
    },

    loadProfile: function () {
      try {
        var u = localStorage.getItem('user_profile_name') || localStorage.getItem('2048_username');
        if (u) this.username = u;
        var av = localStorage.getItem('user_profile_avatar') || localStorage.getItem('2048_avatar');
        if (av) this.avatar = av;
      } catch (e) {}
    },

    saveProfile: function (newName, newAvatar) {
      if (newName) this.username = newName;
      if (typeof newAvatar !== 'undefined') this.avatar = newAvatar;
      try {
        localStorage.setItem('user_profile_name', this.username);
        localStorage.setItem('2048_username', this.username);
        localStorage.setItem('user_profile_avatar', this.avatar);
        localStorage.setItem('2048_avatar', this.avatar);
      } catch (e) {}

      // Sync to backend API
      this.syncProfileToBackend();
    },

    syncProfileToBackend: function () {
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

    cacheDom: function () {
      // Navbar Profile Elements (Foto di atas, Username di bawahnya)
      this.navAvatarImg = document.getElementById('profile-nav-img');
      this.navAvatarText = document.getElementById('profile-nav-placeholder');
      this.navUsername = document.getElementById('profile-username-display');
      this.btnProfile = document.getElementById('navbar-profile-btn');

      // Buttons
      this.btnFullscreen = document.getElementById('btn-fullscreen');
      this.btnLeaderboard = document.getElementById('btn-leaderboard');
      this.btnTop3ViewAll = document.getElementById('top3-view-all-btn');

      // Modals
      this.modalProfile = document.getElementById('modal-profile');
      this.modalLeaderboard = document.getElementById('modal-leaderboard');
      this.toastEl = document.getElementById('toast-notification');

      // Form Profile
      this.formProfile = document.getElementById('form-profile');
      this.inputUsername = document.getElementById('input-username');
      this.inputAvatarFile = document.getElementById('input-avatar-file');
      this.modalAvatarImg = document.getElementById('modal-avatar-preview-img');
      this.modalAvatarText = document.getElementById('modal-avatar-preview-text');
      this.btnRemoveAvatar = document.getElementById('btn-remove-avatar');

      // Podium Top 3 elements
      this.podiumCard1 = document.getElementById('podium-card-1');
      this.podiumCard2 = document.getElementById('podium-card-2');
      this.podiumCard3 = document.getElementById('podium-card-3');
    },

    bindEvents: function () {
      var self = this;

      // Profile click in navbar
      if (this.btnProfile) {
        this.btnProfile.addEventListener('click', function () {
          self.openProfileModal();
        });
      }

      // Fullscreen
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
            self.btnFullscreen.innerHTML = '<span>⛶</span><span class="btn-text">Keluar Layar Penuh</span>';
          }
        } else {
          document.body.classList.remove('is-fullscreen');
          if (self.btnFullscreen) {
            self.btnFullscreen.innerHTML = '<span>⛶</span><span class="btn-text">Layar Penuh</span>';
          }
        }
      };

      document.addEventListener('fullscreenchange', handleFsChange);
      document.addEventListener('webkitfullscreenchange', handleFsChange);

      // Leaderboard Modal Triggers
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

      // Modal Close Handlers
      document.querySelectorAll('.modal-backdrop').forEach(function (mb) {
        mb.addEventListener('click', function (e) {
          if (e.target === mb) self.closeModal(mb);
        });
      });
      document.querySelectorAll('.modal-close').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.closeModal(btn.closest('.modal-backdrop'));
        });
      });

      // Profile Form Submit
      if (this.formProfile) {
        this.formProfile.addEventListener('submit', function (e) {
          e.preventDefault();
          var newName = (self.inputUsername.value || '').trim();
          if (newName.length < 2 || newName.length > 20) {
            self.showToast('Username harus 2-20 karakter');
            return;
          }
          self.saveProfile(newName, self.tempAvatar || self.avatar);
          self.updateProfileUI();
          self.closeModal(self.modalProfile);
          self.showToast('Profil pemain berhasil disimpan!');
        });
      }

      // Avatar File Upload
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
              self.showToast('Foto berhasil dimuat. Klik Simpan!');
            });
          };
          reader.readAsDataURL(file);
        });
      }

      // Remove Avatar
      if (this.btnRemoveAvatar) {
        this.btnRemoveAvatar.addEventListener('click', function () {
          self.tempAvatar = '';
          self.updateModalAvatarPreview('', self.username);
          self.showToast('Foto profil dihapus');
        });
      }

      // Leaderboard Tab Clicks
      document.querySelectorAll('.ldb-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          document.querySelectorAll('.ldb-tab').forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          var gameKey = tab.getAttribute('data-tab');
          self.loadLeaderboardTable(gameKey);
        });
      });
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

    updateProfileUI: function () {
      // 1. Username label
      if (this.navUsername) {
        this.navUsername.textContent = this.username;
      }

      // 2. Avatar Photo
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
          this.navAvatarImg.style.display = 'none';
        }
        if (this.navAvatarText) {
          this.navAvatarText.textContent = this.username.charAt(0).toUpperCase() || '👤';
          this.navAvatarText.style.display = 'flex';
        }
      }
    },

    openProfileModal: function () {
      this.tempAvatar = this.avatar;
      if (this.inputUsername) this.inputUsername.value = this.username;
      this.updateModalAvatarPreview(this.avatar, this.username);
      this.openModal(this.modalProfile);
    },

    updateModalAvatarPreview: function (avatarUrl, name) {
      if (avatarUrl) {
        if (this.modalAvatarImg) {
          this.modalAvatarImg.src = avatarUrl;
          this.modalAvatarImg.style.display = 'block';
        }
        if (this.modalAvatarText) this.modalAvatarText.style.display = 'none';
        if (this.btnRemoveAvatar) this.btnRemoveAvatar.style.display = 'inline-flex';
      } else {
        if (this.modalAvatarImg) this.modalAvatarImg.style.display = 'none';
        if (this.modalAvatarText) {
          this.modalAvatarText.textContent = (name || this.username).charAt(0).toUpperCase() || '👤';
          this.modalAvatarText.style.display = 'flex';
        }
        if (this.btnRemoveAvatar) this.btnRemoveAvatar.style.display = 'none';
      }
    },

    loadPersonalBestScores: function () {
      var scores = {
        '2048': localStorage.getItem('bestScore') || 0,
        'memory': localStorage.getItem('memory_high_score') || 0,
        'pacman': localStorage.getItem('pacman_high_score') || 0,
        'xox': localStorage.getItem('xox_high_score') || 0,
        'flappy': localStorage.getItem('flappy_high_score') || 0
      };

      for (var key in scores) {
        var el = document.getElementById('card-score-' + key);
        if (el) el.textContent = Number(scores[key]).toLocaleString();
      }
    },

    fetchTop3Overall: function () {
      var self = this;
      fetch('/api/leaderboard.php?action=overall_top')
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.status === 'success' && data.overall_top) {
            self.renderTop3Podium(data.overall_top);
          }
        })
        .catch(function () {});
    },

    renderTop3Podium: function (topList) {
      var defaultEmpty = function (rank) {
        return {
          rank: rank,
          username: 'Belum Ada',
          total_score: 0,
          games_played: 0,
          avatar: ''
        };
      };

      var p1 = topList[0] || defaultEmpty(1);
      var p2 = topList[1] || defaultEmpty(2);
      var p3 = topList[2] || defaultEmpty(3);

      this.fillPodiumCard(this.podiumCard1, p1, 1);
      this.fillPodiumCard(this.podiumCard2, p2, 2);
      this.fillPodiumCard(this.podiumCard3, p3, 3);
    },

    fillPodiumCard: function (cardEl, p, rank) {
      if (!cardEl) return;
      var avWrap = cardEl.querySelector('.podium-avatar-wrap');
      var nameEl = cardEl.querySelector('.podium-name');
      var scoreEl = cardEl.querySelector('.podium-score');
      var gamesEl = cardEl.querySelector('.podium-games-count');

      if (nameEl) nameEl.textContent = p.username || 'Pemain';
      if (scoreEl) scoreEl.textContent = Number(p.total_score || 0).toLocaleString() + ' Poin';
      if (gamesEl) gamesEl.textContent = (p.games_played || 0) + ' Game Dimainkan';

      if (avWrap) {
        var medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : '🥉');
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

        html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">' +
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

        html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">' +
                '<td style="padding:10px 6px; font-weight:800; font-size:14px;">' + medal + '</td>' +
                '<td style="padding:10px 6px;"><div style="display:flex; align-items:center; gap:8px;">' + av + '<span style="font-weight:700;">' + row.username + '</span></div></td>' +
                '<td style="padding:10px 6px; text-align:right; font-weight:800; color:#38bdf8;">' + Number(row.best_score).toLocaleString() + '</td>' +
                '</tr>';
      });

      html += '</tbody></table>';
      body.innerHTML = html;
    },

    toggleFullscreen: function () {
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

    openModal: function (m) {
      if (m) { m.classList.add('is-open'); m.style.display = 'flex'; }
    },

    closeModal: function (m) {
      if (m) { m.classList.remove('is-open'); m.style.display = 'none'; }
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

  document.addEventListener('DOMContentLoaded', function () {
    GameHub.init();
    window.GameHub = GameHub;
  });

})();
