/**
 * DWICKY GAME HUB - Universal Profile Photo Viewer
 * File: js/photo_viewer.js
 * Platform: game.dwicky.dev
 * Opens an enlarged, sleek photo preview lightbox when clicking the avatar image,
 * while preserving edit profile modal behavior when clicking username / badge.
 */
(function (root) {
  "use strict";

  function getAvatarSrc() {
    try {
      var av = localStorage.getItem("user_profile_avatar") ||
               localStorage.getItem("2048_avatar") ||
               localStorage.getItem("2048_player_avatar") ||
               "";
      if (av && av.trim() && av !== "null" && av !== "undefined") return av.trim();
    } catch (e) {}

    // Fallback: ONLY check DOM elements that are currently VISIBLE and actively displayed!
    var domImgs = [
      document.getElementById("profile-nav-img"),
      document.getElementById("user-avatar-img"),
      document.getElementById("modal-avatar-preview-img"),
      document.querySelector(".user-avatar-img"),
      document.querySelector(".avatar-circle img"),
      document.querySelector(".profile-avatar-stack img")
    ];
    for (var i = 0; i < domImgs.length; i++) {
      var el = domImgs[i];
      if (!el) continue;
      // If element is hidden (display:none) or has hidden attribute, ignore it!
      if (el.style.display === "none" || el.hidden) continue;
      if (window.getComputedStyle && window.getComputedStyle(el).display === "none") continue;
      if (el.src && el.src.trim() && el.src !== window.location.href && el.src.indexOf("/null") === -1) {
        return el.src.trim();
      }
    }
    return "";
  }

  function getUsername() {
    try {
      var name = localStorage.getItem("user_profile_name") ||
                 localStorage.getItem("2048_username") ||
                 localStorage.getItem("2048_player_username") ||
                 "";
      if (name && name.trim()) return name.trim();
    } catch (e) {}

    var domNames = [
      document.getElementById("profile-username-display"),
      document.getElementById("username-display"),
      document.getElementById("input-username")
    ];
    for (var i = 0; i < domNames.length; i++) {
      var el = domNames[i];
      if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
      if (el && el.value && el.value.trim()) return el.value.trim();
    }
    return "Pemain Baru";
  }

  function ensureModal() {
    var modal = document.getElementById("modal-photo-viewer");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "modal-photo-viewer";
    modal.className = "modal-backdrop photo-viewer-modal-backdrop";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:10000000; background:rgba(0,0,0,0.85); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); display:none; align-items:center; justify-content:center; padding:16px; box-sizing:border-box;";

    modal.innerHTML = 
      '<div class="modal-card photo-viewer-card" style="position:relative; width:100%; max-width:320px; align-items:center; text-align:center; padding:22px 18px; border-radius:22px; background:#0d1527; border:1px solid rgba(255,255,255,0.18); box-shadow:0 25px 60px rgba(0,0,0,0.9); box-sizing:border-box;">' +
      '  <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.08);">' +
      '    <h3 style="margin:0; font-size:15px; font-weight:800; color:#f8fafc; display:flex; align-items:center; gap:6px;"><span>🖼️</span> Foto Profil</h3>' +
      '    <button type="button" class="modal-close" id="pv-btn-close" style="background:none; border:none; color:#94a3b8; font-size:24px; cursor:pointer; line-height:1; padding:0 4px;" title="Tutup">&times;</button>' +
      '  </div>' +
      '  <div class="photo-viewer-img-wrap" style="position:relative; width:190px; height:190px; border-radius:50%; overflow:hidden; margin:8px auto 14px; border:3px solid rgba(255,255,255,0.25); box-shadow:0 12px 35px rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #10b981, #06b6d4);">' +
      '    <img id="pv-img" src="" alt="Foto Profil" style="width:100%; height:100%; object-fit:cover; display:none;">' +
      '    <span id="pv-placeholder" style="font-size:85px; color:#fff; user-select:none; line-height:1;">👤</span>' +
      '  </div>' +
      '  <div id="pv-username" style="font-size:17px; font-weight:800; color:#f8fafc; margin-bottom:4px; max-width:270px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Pemain Baru</div>' +
      '  <div id="pv-subtitle" style="font-size:12px; color:#94a3b8; margin-bottom:18px;">Foto Profil Akun DWICKY GAME HUB</div>' +
      '  <div style="display:flex; gap:10px; width:100%;">' +
      '    <button type="button" class="btn-primary" id="pv-btn-edit" style="flex:1; padding:10px 14px; font-size:13px; font-weight:800; border-radius:10px; cursor:pointer; border:none; background:linear-gradient(135deg, #06b6d4, #2563eb); color:#fff;">✏️ Ganti Foto</button>' +
      '    <button type="button" class="btn-secondary" id="pv-btn-dismiss" style="padding:10px 16px; font-size:13px; font-weight:700; border-radius:10px; cursor:pointer; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.08); color:#fff;">Tutup</button>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(modal);

    function closePv() {
      modal.classList.remove("is-open");
      modal.style.display = "none";
    }

    modal.addEventListener("click", function (e) {
      if (e.target === modal) closePv();
    });

    var btnClose = modal.querySelector("#pv-btn-close");
    if (btnClose) btnClose.addEventListener("click", closePv);

    var btnDismiss = modal.querySelector("#pv-btn-dismiss");
    if (btnDismiss) btnDismiss.addEventListener("click", closePv);

    var btnEdit = modal.querySelector("#pv-btn-edit");
    if (btnEdit) {
      btnEdit.addEventListener("click", function () {
        closePv();
        if (window.Hub && typeof window.Hub.openProfileModal === "function") {
          window.Hub.openProfileModal();
        } else if (window.Leaderboard && typeof window.Leaderboard.openUsernameModal === "function") {
          window.Leaderboard.openUsernameModal(true);
        } else {
          var editModal = document.getElementById("modal-profile") || 
                          document.getElementById("modal-username");
          if (editModal) {
            editModal.classList.add("is-open");
            editModal.style.display = "flex";
          }
        }
      });
    }

    return modal;
  }

  function openPhotoViewer(customSrc, customName) {
    var modal = ensureModal();
    var avatarSrc = customSrc || getAvatarSrc();
    var username = customName || getUsername();

    var img = modal.querySelector("#pv-img");
    var placeholder = modal.querySelector("#pv-placeholder");
    var userEl = modal.querySelector("#pv-username");
    var subtitleEl = modal.querySelector("#pv-subtitle");
    var btnEdit = modal.querySelector("#pv-btn-edit");

    if (userEl) userEl.textContent = username;

    if (avatarSrc && avatarSrc.trim() && avatarSrc !== "null" && avatarSrc !== "undefined") {
      if (img) {
        img.src = avatarSrc;
        img.style.display = "block";
      }
      if (placeholder) placeholder.style.display = "none";
      if (subtitleEl) subtitleEl.textContent = "Foto Profil Akun DWICKY GAME HUB";
      if (btnEdit) btnEdit.textContent = "✏️ Ganti Foto";
    } else {
      if (img) {
        img.src = "";
        img.removeAttribute("src");
        img.style.display = "none";
      }
      if (placeholder) {
        placeholder.textContent = (username && username !== "Pemain" && username !== "Pemain Baru") ? username.charAt(0).toUpperCase() : "👤";
        placeholder.style.display = "block";
      }
      if (subtitleEl) subtitleEl.textContent = "Belum ada foto profil";
      if (btnEdit) btnEdit.textContent = "📷 Unggah Foto Profil";
    }

    modal.classList.add("is-open");
    modal.style.display = "flex";
  }

  root.openPhotoViewer = openPhotoViewer;

  // Global event delegation for avatar taps/clicks
  document.addEventListener("click", function (e) {
    var target = e.target;
    if (!target) return;

    // If user clicked inside the photo viewer lightbox itself, don't re-trigger
    if (target.closest("#modal-photo-viewer")) return;

    // If clicking the edit pencil badge, let default profile edit modal open
    if (target.closest(".profile-edit-badge")) return;

    // Check if target is an avatar element
    var isAvatar = target.closest(
      ".profile-avatar-stack, " +
      ".avatar-circle, " +
      "#user-avatar-wrap, " +
      "#profile-nav-img, " +
      "#profile-nav-placeholder, " +
      "#user-avatar-img, " +
      "#user-avatar-placeholder, " +
      ".modal-avatar-preview-wrap, " +
      "#modal-avatar-preview-img, " +
      "#modal-avatar-preview-text, " +
      ".podium-avatar-wrap"
    );

    if (isAvatar) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      openPhotoViewer();
      return false;
    }
  }, true);

  // Directly attach click listeners once DOM is ready
  function attachDirectListeners() {
    var selectors = [
      "#profile-nav-img",
      "#profile-nav-placeholder",
      ".profile-avatar-stack",
      "#user-avatar-wrap",
      ".avatar-circle",
      "#modal-avatar-preview-wrap",
      "#modal-avatar-preview-img",
      "#user-avatar-img",
      "#user-avatar-text"
    ];

    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (!el || el.dataset.pvBound) return;
        el.dataset.pvBound = "true";
        el.style.cursor = "pointer";
        el.addEventListener("click", function (ev) {
          if (ev.target.closest && ev.target.closest(".profile-edit-badge")) return;
          ev.preventDefault();
          ev.stopPropagation();
          openPhotoViewer();
        });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachDirectListeners);
  } else {
    attachDirectListeners();
  }

  // Also re-check when modals open or dynamic updates happen
  window.addEventListener("load", attachDirectListeners);

})(typeof window !== "undefined" ? window : this);
