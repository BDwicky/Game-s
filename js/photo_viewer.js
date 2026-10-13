/**
 * DWICKY GAME HUB - Universal Profile Photo Viewer
 * File: js/photo_viewer.js
 * Opens an enlarged, sleek photo preview popup when clicking the avatar image,
 * while preserving edit profile modal behavior when tapping the badge text.
 */
(function (root) {
  "use strict";

  function getAvatarSrc() {
    try {
      return localStorage.getItem("user_profile_avatar") ||
             localStorage.getItem("2048_player_avatar") ||
             "";
    } catch (e) {
      return "";
    }
  }

  function getUsername() {
    try {
      return localStorage.getItem("user_profile_name") ||
             localStorage.getItem("2048_player_username") ||
             "Pemain";
    } catch (e) {
      return "Pemain";
    }
  }

  function ensureModal() {
    var modal = document.getElementById("modal-photo-viewer");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "modal-photo-viewer";
    modal.className = "modal-backdrop photo-viewer-modal-backdrop";
    modal.style.display = "none";
    modal.setAttribute("data-can-close", "true");

    modal.innerHTML = [
      "<div class="modal-card photo-viewer-card" style="max-width: 330px; align-items: center; text-align: center; padding: 22px 18px; border-radius: 20px; background: #0d1527; border: 1px solid rgba(255, 255, 255, 0.16); box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85);">",
      "  <div class="photo-viewer-header" style="width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">",
      "    <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 6px;"><span>🖼️</span> Foto Profil</h3>",
      "    <button type="button" class="modal-close" id="pv-btn-close" style="background:none; border:none; color:#94a3b8; font-size:24px; cursor:pointer; line-height:1; padding:0 4px;" title="Tutup">&times;</button>",
      "  </div>",
      "  <div class="photo-viewer-img-wrap" style="position: relative; width: 190px; height: 190px; border-radius: 50%; overflow: hidden; margin: 10px auto 16px; border: 3px solid rgba(255, 255, 255, 0.25); box-shadow: 0 12px 35px rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #10b981, #06b6d4);">",
      "    <img id="pv-img" src="" alt="Foto Profil" style="width: 100%; height: 100%; object-fit: cover; display: none;">",
      "    <span id="pv-placeholder" style="font-size: 85px; color: #fff; user-select: none;">👤</span>",
      "  </div>",
      "  <div id="pv-username" style="font-size: 17px; font-weight: 800; color: #f8fafc; margin-bottom: 3px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Pemain</div>",
      "  <div style="font-size: 12px; color: #94a3b8; margin-bottom: 20px;">Foto Profil Akun DWICKY GAME HUB</div>",
      "  <div style="display: flex; gap: 10px; width: 100%;">",
      "    <button type="button" class="btn-primary" id="pv-btn-edit" style="flex: 1; padding: 10px 14px; font-size: 13px; font-weight: 800; border-radius: 10px; cursor: pointer; border: none; background: linear-gradient(135deg, #06b6d4, #2563eb); color: #fff;">✏️ Ganti Foto</button>",
      "    <button type="button" class="btn-secondary" id="pv-btn-dismiss" style="padding: 10px 16px; font-size: 13px; font-weight: 700; border-radius: 10px; cursor: pointer; border: 1px solid rgba(255, 255, 255, 0.16); background: rgba(255, 255, 255, 0.08); color: #fff;">Tutup</button>",
      "  </div>",
      "</div>"
    ].join("
");

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
          var editModal = document.getElementById("modal-username") || document.getElementById("modal-profile");
          if (editModal) {
            editModal.classList.add("is-open");
            editModal.style.display = "flex";
          }
        }
      });
    }

    return modal;
  }

  function openPhotoViewer() {
    var modal = ensureModal();
    var avatarSrc = getAvatarSrc();
    var username = getUsername();

    var img = modal.querySelector("#pv-img");
    var placeholder = modal.querySelector("#pv-placeholder");
    var userEl = modal.querySelector("#pv-username");

    if (userEl) userEl.textContent = username;

    if (avatarSrc) {
      if (img) {
        img.src = avatarSrc;
        img.style.display = "block";
      }
      if (placeholder) placeholder.style.display = "none";
    } else {
      if (img) img.style.display = "none";
      if (placeholder) placeholder.style.display = "block";
    }

    modal.classList.add("is-open");
    modal.style.display = "flex";
  }

  root.openPhotoViewer = openPhotoViewer;

  document.addEventListener("click", function (e) {
    var target = e.target;
    // Do not intercept if click is inside an open modal
    if (target.closest(".modal-card, .modal-backdrop")) return;

    var avatarEl = target.closest(".avatar-circle, .profile-avatar-stack, #user-avatar-wrap, #navbar-avatar-btn");
    if (avatarEl) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      openPhotoViewer();
      return false;
    }
  }, true);

})(typeof window !== "undefined" ? window : this);
