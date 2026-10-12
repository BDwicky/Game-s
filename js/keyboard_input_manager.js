function KeyboardInputManager() {
  this.events = {};
  this.listen();
}

KeyboardInputManager.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

KeyboardInputManager.prototype.emit = function (event, data) {
  var callbacks = this.events[event];
  if (callbacks) {
    callbacks.forEach(function (callback) {
      callback(data);
    });
  }
};

KeyboardInputManager.prototype.listen = function () {
  var self = this;

  var map = {
    38: 0, // Up
    39: 1, // Right
    40: 2, // Down
    37: 3, // Left
    75: 0, // Vim up
    76: 1, // Vim right
    74: 2, // Vim down
    72: 3, // Vim left
    87: 0, // W
    68: 1, // D
    83: 2, // S
    65: 3  // A
  };

  // Respond to direction keys
  document.addEventListener("keydown", function (event) {
    var target = event.target || event.srcElement;
    var isInput = target && (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable
    );
    var isModalOpen = !!document.querySelector(".modal-backdrop.is-open");

    // Allow Escape key to close modal if permitted
    if (event.which === 27) {
      var openModal = document.querySelector(".modal-backdrop.is-open");
      if (openModal && window.Leaderboard && window.Leaderboard.closeModal) {
        if (openModal.getAttribute("data-can-close") !== "false") {
          window.Leaderboard.closeModal(openModal);
          return;
        }
      }
    }

    // Do not capture game controls if user is typing or modal is open
    if (isInput || isModalOpen) {
      return;
    }

    var modifiers = event.altKey || event.ctrlKey || event.metaKey ||
                    event.shiftKey;
    var mapped    = map[event.which];

    if (!modifiers) {
      if (mapped !== undefined) {
        event.preventDefault();
        self.emit("move", mapped);
      }
    }

    // R key restarts the game
    if (!modifiers && event.which === 82) {
      self.restart.call(self, event);
    }
  });

  // Respond to button presses
  this.bindButtonPress(".retry-button", this.restart);
  this.bindButtonPress(".restart-button", this.restart);
  this.bindButtonPress(".keep-playing-button", this.keepPlaying);

  // Helper to check if touch is on an interactive element
  function isInteractiveElement(target) {
    if (!target) return false;
    var el = target;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.classList) {
        if (el.classList.contains("modal-backdrop") ||
            el.classList.contains("modal-card") ||
            el.classList.contains("btn-action") ||
            el.classList.contains("user-badge") ||
            el.classList.contains("restart-button") ||
            el.classList.contains("retry-button") ||
            el.classList.contains("keep-playing-button") ||
            el.classList.contains("modal-close")) {
          return true;
        }
      }
      if (el.tagName === "BUTTON" || el.tagName === "INPUT" || el.tagName === "A" || el.tagName === "LABEL") {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  // Respond to swipe events anywhere on the screen
  var touchStartClientX, touchStartClientY;
  var isSwiping = false;

  document.addEventListener("touchstart", function (event) {
    // If a modal is open, ignore
    if (document.querySelector(".modal-backdrop.is-open")) return;
    if (isInteractiveElement(event.target)) return;
    if (event.touches.length > 1) return;

    touchStartClientX = event.touches[0].clientX;
    touchStartClientY = event.touches[0].clientY;
    isSwiping = true;

    // Prevent default scroll/pull-to-refresh while playing
    if (event.cancelable) {
      event.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("touchmove", function (event) {
    if (!isSwiping) return;
    if (event.cancelable) {
      event.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("touchend", function (event) {
    if (!isSwiping) return;
    isSwiping = false;

    if (!event.changedTouches || event.changedTouches.length === 0) return;

    var touchEndClientX = event.changedTouches[0].clientX;
    var touchEndClientY = event.changedTouches[0].clientY;

    var dx = touchEndClientX - touchStartClientX;
    var absDx = Math.abs(dx);

    var dy = touchEndClientY - touchStartClientY;
    var absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 15) {
      // (right : left) : (down : up)
      self.emit("move", absDx > absDy ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    }
  }, { passive: false });
};

KeyboardInputManager.prototype.restart = function (event) {
  if (event && event.preventDefault) event.preventDefault();
  this.emit("restart");
};

KeyboardInputManager.prototype.keepPlaying = function (event) {
  if (event && event.preventDefault) event.preventDefault();
  this.emit("keepPlaying");
};

KeyboardInputManager.prototype.bindButtonPress = function (selector, fn) {
  var button = document.querySelector(selector);
  if (!button) return;
  button.addEventListener("click", fn.bind(this));
  button.addEventListener("touchend", function (e) {
    e.stopPropagation();
    fn.call(this, e);
  }.bind(this));
};
