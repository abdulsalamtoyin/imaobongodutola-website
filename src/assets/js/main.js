/* ==========================================================================
   Dr. Imaobong Odutola — site behaviour
   No dependencies. Every block exits quietly if its markup isn't on the page,
   so the same file can be loaded by all seven pages.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- navigation ------------------------------------------------------- */
  function initNav() {
    var nav = document.querySelector(".nav");
    var toggle = document.querySelector(".nav__toggle");
    var drawer = document.querySelector(".drawer");
    if (!nav) return;

    // The home page has a dark full-bleed hero, so the nav starts transparent
    // and only turns solid once you scroll past it. Interior pages have a
    // light header, so the nav must be solid from the very first paint.
    var overHero = document.body.hasAttribute("data-transparent-nav");

    function onScroll() {
      var solid = !overHero || window.scrollY > window.innerHeight * 0.75;
      nav.classList.toggle("nav--solid", solid);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (!toggle || !drawer) return;

    function setDrawer(open) {
      drawer.setAttribute("data-open", open ? "true" : "false");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
      // While the drawer is open the bars sit on the light drawer background,
      // so force the solid (dark-bar) treatment regardless of scroll position.
      if (open) nav.classList.add("nav--solid");
      else onScroll();
    }

    toggle.addEventListener("click", function () {
      setDrawer(drawer.getAttribute("data-open") !== "true");
    });

    drawer.addEventListener("click", function (e) {
      if (e.target.tagName === "A") setDrawer(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.getAttribute("data-open") === "true") {
        setDrawer(false);
        toggle.focus();
      }
    });
  }

  /* --- hero video wall -------------------------------------------------- */
  function initHero() {
    var media = document.querySelector(".hero__media");
    if (!media) return;

    var clips = Array.prototype.slice.call(media.querySelectorAll(".hero__clip"));
    var dots = Array.prototype.slice.call(document.querySelectorAll(".hero__dot"));
    if (!clips.length) return;

    // Posters are baked into the markup, so if we bail here the hero still
    // shows a still frame rather than an empty navy box.
    if (reduceMotion) {
      clips[0].classList.add("is-active");
      return;
    }

    // On phones, loading ten clips would cost several megabytes of someone's
    // mobile data for a decorative background. Four is enough to read as a
    // rotation without the bill.
    var budget = window.matchMedia("(max-width: 700px)").matches ? 4 : clips.length;
    var active = clips.slice(0, budget);

    // Hide the dots we won't be rotating through, so the indicator never
    // promises more clips than will actually play.
    dots.forEach(function (dot, i) {
      if (i >= budget) dot.style.display = "none";
    });

    var index = 0;
    var timer = null;
    var HOLD = 7000;

    function load(i) {
      var clip = active[i];
      if (!clip || clip.dataset.loaded) return;
      clip.src = clip.dataset.src;
      clip.dataset.loaded = "1";
      clip.load();
    }

    function show(i) {
      index = i;
      active.forEach(function (clip, n) {
        clip.classList.toggle("is-active", n === i);
        if (n !== i) clip.pause();
      });
      dots.forEach(function (dot, n) {
        dot.classList.toggle("is-active", n === i);
        dot.setAttribute("aria-selected", n === i ? "true" : "false");
      });

      var current = active[i];
      if (current) {
        current.currentTime = 0;
        // Autoplay can still be refused (low-power mode, strict settings).
        // The poster remains visible in that case, so nothing breaks.
        var p = current.play();
        if (p && p.catch) p.catch(function () {});
      }
      load((i + 1) % active.length); // stay one clip ahead
    }

    function advance() { show((index + 1) % active.length); }

    function start() {
      stop();
      timer = window.setInterval(advance, HOLD);
    }
    function stop() {
      if (timer) window.clearInterval(timer);
      timer = null;
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () {
        if (i >= budget) return;
        load(i);
        show(i);
        start(); // restart the clock so a manual pick gets a full turn
      });
    });

    // Don't burn battery or data animating a hero nobody is looking at.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { stop(); active.forEach(function (c) { c.pause(); }); }
      else { show(index); start(); }
    });

    load(0);
    show(0);
    start();
  }

  /* --- scroll reveal ---------------------------------------------------- */
  function initReveal() {
    var targets = document.querySelectorAll("[data-reveal]");
    if (!targets.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.05 });

    targets.forEach(function (el) { io.observe(el); });
  }

  /* --- YouTube facade --------------------------------------------------- */
  /* Swaps a poster for the real iframe on click. Four live embeds on the
     messages page would pull roughly 2MB of Google script before anyone
     pressed play. */
  function initYouTube() {
    document.querySelectorAll("[data-yt]").forEach(function (el) {
      el.addEventListener("click", function () {
        var id = el.dataset.yt;
        if (!id || el.dataset.loaded) return;
        el.dataset.loaded = "1";

        var iframe = document.createElement("iframe");
        iframe.src = "https://www.youtube-nocookie.com/embed/" + id +
                     "?autoplay=1&rel=0&modestbranding=1";
        iframe.title = el.dataset.ytTitle || "Message video";
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; " +
                       "gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;
        el.innerHTML = "";
        el.appendChild(iframe);
      });
    });
  }

  /* --- gallery filter + lightbox ---------------------------------------- */
  function initGallery() {
    var grid = document.querySelector(".gallery");
    if (!grid) return;

    var items = Array.prototype.slice.call(grid.querySelectorAll(".gallery__item"));
    var filters = Array.prototype.slice.call(document.querySelectorAll(".filter"));

    filters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.dataset.filter;
        filters.forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        items.forEach(function (item) {
          item.hidden = !(cat === "all" || item.dataset.cat === cat);
        });
      });
    });

    /* Lightbox */
    var box = document.querySelector(".lightbox");
    if (!box) return;
    var img = box.querySelector("img");
    var lastFocus = null;
    var current = 0;

    function visibleItems() {
      return items.filter(function (i) { return !i.hidden; });
    }

    function open(item) {
      var list = visibleItems();
      current = list.indexOf(item);
      lastFocus = item;
      render(list);
      box.setAttribute("data-open", "true");
      document.body.style.overflow = "hidden";
      box.querySelector(".lightbox__close").focus();
    }

    function render(list) {
      var item = list[current];
      if (!item) return;
      img.src = item.dataset.full;
      img.alt = item.querySelector("img").alt;
    }

    function step(delta) {
      var list = visibleItems();
      current = (current + delta + list.length) % list.length;
      render(list);
    }

    function close() {
      box.setAttribute("data-open", "false");
      document.body.style.overflow = "";
      img.src = "";
      if (lastFocus) lastFocus.focus();
    }

    items.forEach(function (item) {
      item.addEventListener("click", function () { open(item); });
    });

    box.querySelector(".lightbox__close").addEventListener("click", close);
    box.querySelector(".lightbox__nav--prev").addEventListener("click", function () { step(-1); });
    box.querySelector(".lightbox__nav--next").addEventListener("click", function () { step(1); });
    box.addEventListener("click", function (e) { if (e.target === box) close(); });

    document.addEventListener("keydown", function (e) {
      if (box.getAttribute("data-open") !== "true") return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });
  }

  /* --- current page in nav ---------------------------------------------- */
  function initCurrent() {
    var here = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav__links a, .drawer a").forEach(function (a) {
      var target = a.getAttribute("href");
      if (target === here) a.setAttribute("aria-current", "page");
    });
  }

  /* --- boot ------------------------------------------------------------- */
  function boot() {
    initNav();
    initHero();
    initReveal();
    initYouTube();
    initGallery();
    initCurrent();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
