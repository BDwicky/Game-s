/**
 * DWICKY GAME HUB - Universal Fullscreen State Manager
 * File: js/fullscreen.js
 * Synchronizes and persists fullscreen state seamlessly across Lobby and Games.
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
  var isIframe = (typeof window !== "undefined") && (window.parent && window.parent !== window);

  // If opened directly as a standalone page (e.g. https://game.dwicky.dev/games/snake/)
  // redirect through the portal runner so full PWA frame and seamless fullscreen are guaranteed!
  if (typeof window !== "undefined" && !isIframe) {
    var pathname = window.location.pathname;
    var match = pathname.match(/\/games\/([a-zA-Z0-9_-]+)\/?$/);
    if (match && match[1]) {
      var gameName = match[1];
      var search = window.location.search ? "&" + window.location.search.slice(1) : "";
      window.location.replace("/?game=" + encodeURIComponent(gameName) + search);
      return {};
    }
  }

  function markNavigating() {
    isNavigating = true;
    try {
      if (FullscreenSync.isActive() || FullscreenSync.isWanted()) {
        localStorage.setItem(STORAGE_KEY, "true");
      }
    } catch (e) {}
  }

  if (typeof document !== "undefined" && !isIframe) {
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
    isIframe: isIframe,

    isWanted: function () {
      try {
        if (isIframe && window.parent && window.parent.FullscreenSync) {
          return window.parent.FullscreenSync.isWanted();
        }
        return localStorage.getItem(STORAGE_KEY) === "true";
      } catch (e) {
        return false;
      }
    },

    setWanted: function (wanted) {
      try {
        if (isIframe && window.parent && window.parent.FullscreenSync) {
          window.parent.FullscreenSync.setWanted(wanted);
          return;
        }
        localStorage.setItem(STORAGE_KEY, wanted ? "true" : "false");
      } catch (e) {}
    },

    isNativeFs: function () {
      if (typeof document === "undefined") return false;
      if (isIframe && window.parent && window.parent.FullscreenSync) {
        return window.parent.FullscreenSync.isNativeFs();
      }
      return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
    },

    isActive: function () {
      if (isIframe && window.parent && window.parent.FullscreenSync) {
        return window.parent.FullscreenSync.isActive();
      }
      if (this.isNativeFs()) return true;
      if (typeof document !== "undefined") {
        return document.documentElement.classList.contains("is-fullscreen") ||
               (document.body && document.body.classList.contains("is-fullscreen"));
      }
      return false;
    },

    request: function () {
      if (isIframe && window.parent && window.parent.FullscreenSync) {
        return window.parent.FullscreenSync.request();
      }

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
      if (isIframe && window.parent && window.parent.FullscreenSync) {
        return window.parent.FullscreenSync.exit();
      }

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

      if (isIframe && window.parent && window.parent.FullscreenSync) {
        window.parent.FullscreenSync.toggle();
        return;
      }

      var willEnable = !this.isActive();
      if (willEnable) {
        this.setWanted(true);
        this.applyClasses(true);
        this.updateUI(true);
        var self = this;
        this.request().then(function () {
          self.disarmGestureTrigger();
          self.broadcastToChild(true);
        }).catch(function () {
          self.armGestureTrigger();
        });
        this.showToast("⛶ Mode Layar Penuh Aktif");
      } else {
        this.setWanted(false);
        this.disarmGestureTrigger();
        this.applyClasses(false);
        this.updateUI(false);
        this.broadcastToChild(false);
        if (this.isNativeFs()) {
          this.exit().catch(function () {});
        }
        this.showToast("Mode Layar Penuh Dinonaktifkan");
      }
    },

    broadcastToChild: function (active) {
      if (isIframe) return;
      var frame = document.getElementById("game-runner-frame");
      if (frame && frame.contentWindow) {
        try {
          frame.contentWindow.postMessage({
            type: "fullscreen_change",
            isFullscreen: active
          }, "*");
        } catch (e) {}
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
      var toast = document.getElementById("toast") || document.getElementById("toast-notification") || document.querySelector(".toast");
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
      if (gestureArmed || isIframe) return;
      gestureArmed = true;
      var self = this;

      function onGesture() {
        if (!self.isWanted()) {
          self.disarmGestureTrigger();
          return;
        }
        self.disarmGestureTrigger();
        if (!self.isNativeFs()) {
          self.request().then(function () {
            self.broadcastToChild(true);
          }).catch(function () {});
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

    setupIframeNavigation: function () {
      var self = this;
      // Capture #btn-home click
      var btnHome = document.getElementById("btn-home");
      if (btnHome) {
        btnHome.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopImmediatePropagation();
          try {
            window.parent.postMessage({ type: "close_game" }, "*");
          } catch (err) {}
          return false;
        }, true);
      }

      // Capture Hub Modal links inside games (.game-hub-item)
      document.querySelectorAll(".game-hub-item").forEach(function (link) {
        link.addEventListener("click", function (e) {
          var href = link.getAttribute("href");
          if (!href || href === "#") return;
          e.preventDefault();
          e.stopImmediatePropagation();
          if (href.indexOf("index.html") !== -1 || href === "../../" || href === "/") {
            window.parent.postMessage({ type: "close_game" }, "*");
          } else {
            var cleanGame = href.replace(/\.\.\//g, "").replace(/\//g, "");
            if (cleanGame) {
              window.parent.postMessage({ type: "switch_game", target: "games/" + cleanGame + "/" }, "*");
            }
          }
          return false;
        }, true);
      });

      // Listen to messages from parent
      window.addEventListener("message", function (e) {
        if (!e.data) return;
        if (e.data.type === "fullscreen_change") {
          self.applyClasses(e.data.isFullscreen);
          self.updateUI(e.data.isFullscreen);
        }
      });
    },

    init: function () {
      var self = this;

      if (isIframe) {
        // In iframe mode, query parent state and intercept navigation
        var active = false;
        try {
          if (window.parent && window.parent.FullscreenSync) {
            active = window.parent.FullscreenSync.isActive();
          } else {
            active = this.isWanted();
          }
        } catch (e) {
          active = this.isWanted();
        }
        this.applyClasses(active);
        this.updateUI(active);
        this.setupIframeNavigation();
        return;
      }

      // Top level window
      var wanted = this.isWanted();
      if (wanted) {
        this.applyClasses(true);
        this.request().then(function () {
          self.updateUI(true);
          self.broadcastToChild(true);
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
          self.broadcastToChild(true);
        } else {
          self.setWanted(false);
          self.applyClasses(false);
          self.updateUI(false);
          self.disarmGestureTrigger();
          self.broadcastToChild(false);
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
