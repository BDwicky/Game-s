/**
 * DWICKY GAME HUB - Universal Fullscreen State Manager
 * File: js/fullscreen.js
 * Persists and synchronizes fullscreen state between Lobby and Games bidirectionally.
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FullscreenSync = factory();
  }
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var STORAGE_KEY = "game_hub_fullscreen";
  var isNavigating = false;
  var gestureArmed = false;

  function markNavigating() {
    isNavigating = true;
    try {
      if (FullscreenSync.isActive() || FullscreenSync.isWanted()) {
        localStorage.setItem(STORAGE_KEY, "true");
      }
    } catch (e) {}
  }

  if (typeof document !== "undefined") {
    document.addEventListener("click", function (e) {
      var target = e.target;
      while (target && target !== document) {
        if (target.tagName === "A" && target.getAttribute("href")) {
          markNavigating();
          break;
        }
        target = target.parentElement;
      }
    }, true);

    window.addEventListener("beforeunload", markNavigating);
    window.addEventListener("pagehide", markNavigating);
  }

  var FullscreenSync = {
    _lastToggle: 0,
    _onGesture: null,

    isWanted: function () {
      try {
        return localStorage.getItem(STORAGE_KEY) === "true";
      } catch (e) {
        return false;
      }
    },

    setWanted: function (wanted) {
      try {
        localStorage.setItem(STORAGE_KEY, wanted ? "true" : "false");
      } catch (e) {}
    },

    isNativeFs: function () {
      if (typeof document === "undefined") return false;
      return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
    },

    isActive: function () {
      if (this.isNativeFs()) return true;
      if (typeof document !== "undefined") {
        return document.documentElement.classList.contains("is-fullscreen") ||
               (document.body && document.body.classList.contains("is-fullscreen"));
      }
      return false;
    },

    request: function () {
      var docEl = document.documentElement;
      var req = docEl.requestFullscreen ||
                docEl.webkitRequestFullscreen ||
                docEl.mozRequestFullScreen ||
                docEl.msRequestFullscreen;

      if (!req) return Promise.reject(new Error("Fullscreen API not supported"));

      try {
        var res = req.call(docEl);
        if (res && typeof res.then === "function") {
          return res;
        }
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    },

    exit: function () {
      var doc = document;
      var exit = doc.exitFullscreen ||
                 doc.webkitExitFullscreen ||
                 doc.mozCancelFullScreen ||
                 doc.msExitFullscreen;

      if (!exit) return Promise.reject(new Error("Exit Fullscreen not supported"));

      try {
        var res = exit.call(doc);
        if (res && typeof res.then === "function") {
          return res;
        }
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    },

    toggle: function () {
      var now = Date.now();
      if (this._lastToggle && (now - this._lastToggle < 300)) return;
      this._lastToggle = now;

      var willEnable = !this.isActive();
      if (willEnable) {
        this.setWanted(true);
        this.applyClasses(true);
        this.updateUI(true);
        var self = this;
        this.request().then(function () {
          self.disarmGestureTrigger();
        }).catch(function () {
          self.armGestureTrigger();
        });
        this.showToast("⛶ Mode Layar Penuh Aktif");
      } else {
        this.setWanted(false);
        this.disarmGestureTrigger();
        this.applyClasses(false);
        this.updateUI(false);
        if (this.isNativeFs()) {
          this.exit().catch(function () {});
        }
        this.showToast("Mode Layar Penuh Dinonaktifkan");
      }
    },

    applyClasses: function (active) {
      if (typeof document === "undefined") return;
      if (active) {
        document.documentElement.classList.add("is-fullscreen");
        if (document.body) document.body.classList.add("is-fullscreen");
      } else {
        document.documentElement.classList.remove("is-fullscreen");
        if (document.body) document.body.classList.remove("is-fullscreen");
      }
    },

    updateUI: function (isFs) {
      if (typeof document === "undefined") return;
      var btn = document.getElementById("btn-fullscreen");
      if (!btn) return;

      var fsIcon = document.getElementById("fullscreen-icon");
      var btnText = btn.querySelector(".btn-text");

      if (btnText) {
        var iconSpan = btn.querySelector("span:first-child");
        if (iconSpan) iconSpan.textContent = isFs ? "🗗" : "⛶";
        btnText.textContent = isFs ? "Keluar Layar Penuh" : "Layar Penuh";
        btn.title = isFs ? "Keluar Layar Penuh (Esc)" : "Mode Layar Penuh";
      } else if (fsIcon) {
        fsIcon.textContent = isFs ? "🗗" : "⛶";
        btn.title = isFs ? "Keluar Layar Penuh (Esc)" : "Layar Penuh (Fullscreen)";
      } else {
        btn.textContent = isFs ? "🗗" : "⛶";
        btn.title = isFs ? "Keluar Layar Penuh (Esc)" : "Layar Penuh";
      }

      if (isFs) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    },

    showToast: function (msg) {
      if (window.Hub && typeof window.Hub.showToast === "function") {
        window.Hub.showToast(msg);
        return;
      }
      if (window.Game && typeof window.Game.showToast === "function") {
        window.Game.showToast(msg);
        return;
      }
      if (window.Leaderboard && typeof window.Leaderboard.showToast === "function") {
        window.Leaderboard.showToast(msg);
        return;
      }
      var toast = document.getElementById("toast") || document.querySelector(".toast");
      if (toast) {
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(window.__fsToastTimer);
        window.__fsToastTimer = setTimeout(function () {
          toast.classList.remove("show");
        }, 2000);
      }
    },

    armGestureTrigger: function () {
      if (gestureArmed) return;
      gestureArmed = true;
      var self = this;

      function onGesture() {
        if (!self.isWanted()) {
          self.disarmGestureTrigger();
          return;
        }
        self.disarmGestureTrigger();
        if (!self.isNativeFs()) {
          self.request().catch(function () {});
        }
      }

      self._onGesture = onGesture;
      var events = ["pointerdown", "touchstart", "mousedown", "keydown"];
      events.forEach(function (evt) {
        window.addEventListener(evt, onGesture, { capture: true, passive: true });
      });
    },

    disarmGestureTrigger: function () {
      if (!gestureArmed) return;
      gestureArmed = false;
      if (this._onGesture) {
        var events = ["pointerdown", "touchstart", "mousedown", "keydown"];
        var fn = this._onGesture;
        events.forEach(function (evt) {
          window.removeEventListener(evt, fn, { capture: true, passive: true });
        });
        this._onGesture = null;
      }
    },

    init: function () {
      var self = this;
      var wanted = this.isWanted();

      if (wanted) {
        this.applyClasses(true);
        this.request().then(function () {
          self.updateUI(true);
        }).catch(function () {
          self.updateUI(true);
          self.armGestureTrigger();
        });
      } else {
        this.applyClasses(false);
        this.updateUI(false);
      }

      var fsEvents = ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"];
      function onFsChange() {
        if (isNavigating) return;
        var nativeFs = self.isNativeFs();
        if (nativeFs) {
          self.setWanted(true);
          self.applyClasses(true);
          self.updateUI(true);
          self.disarmGestureTrigger();
        } else {
          self.setWanted(false);
          self.applyClasses(false);
          self.updateUI(false);
          self.disarmGestureTrigger();
        }
      }

      fsEvents.forEach(function (evt) {
        document.addEventListener(evt, onFsChange);
      });

      var btn = document.getElementById("btn-fullscreen");
      if (btn && !btn.__fsBound) {
        btn.__fsBound = true;
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          self.toggle();
        });
      }
    }
  };

  if (typeof document !== "undefined") {
    if (FullscreenSync.isWanted()) {
      document.documentElement.classList.add("is-fullscreen");
      if (document.body) document.body.classList.add("is-fullscreen");
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        FullscreenSync.init();
      });
    } else {
      FullscreenSync.init();
    }
  }

  return FullscreenSync;
});
