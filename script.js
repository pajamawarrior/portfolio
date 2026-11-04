/* ==========================================================================
   Portfolio behaviour
   Contents:
     1. Theme (runs straight away to avoid a flash of the wrong theme)
     2. Helpers
     3. Navigation and scroll effects
     4. Hero: name effect, typing, network graph and risk matrix
     5. Terminal
     6. Tabs
     7. Game 1: Find the Vulnerability
     8. Game 2: Phishing Spotter
     9. Game 3: Password Puzzle
    10. Threat model
    11. Risk matrix game

   Security rule for this file: text only ever reaches the page through
   textContent or the h() helper below, which uses it too. Nothing in here
   parses a string as HTML, and the page's Content Security Policy enforces
   that in browsers that support Trusted Types.
   ========================================================================== */
'use strict';

(function () {
  const root = document.documentElement;

  // Lets the CSS know JavaScript is running, so content is never hidden without it.
  root.classList.add('js');

  /* 1. Theme
     ======================================================================== */
  const THEME_KEY = 'portfolio-theme';
  const THEME_COLORS = { dark: '#070a08', light: '#f1efe4' };

  // localStorage can throw in private modes, so failures fall back to dark.
  function loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Not being able to remember the choice is harmless.
    }
  }

  root.dataset.theme = loadTheme();

  function applyTheme(theme) {
    root.dataset.theme = theme;
    saveTheme(theme);

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', THEME_COLORS[theme]);

    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  function toggleTheme() {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return next;
  }

  /* 2. Helpers
     ======================================================================== */
  const byId = (id) => document.getElementById(id);

  // Small element builder. Text always goes through textContent.
  function h(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text !== undefined) node.textContent = options.text;
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([name, value]) => node.setAttribute(name, value));
    }
    node.append(...children);
    return node;
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function scrollBehavior() {
    return prefersReducedMotion() ? 'auto' : 'smooth';
  }

  // Returns a shuffled copy of a list (Fisher-Yates).
  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Adds a tick to a game's tab once it has been finished.
  function markTabComplete(tabId) {
    const tab = byId(tabId);
    if (!tab || tab.classList.contains('is-complete')) return;
    tab.classList.add('is-complete');
    tab.append(h('span', { className: 'sr-only', text: ' (completed)' }));
  }

  /* 3. Navigation and scroll effects
     ======================================================================== */
  function initThemeToggle() {
    applyTheme(root.dataset.theme);
    byId('theme-toggle').addEventListener('click', toggleTheme);
  }

  function initMobileMenu() {
    const toggle = byId('nav-toggle');
    const links = byId('nav-links');

    function setOpen(open) {
      links.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }

    toggle.addEventListener('click', () => setOpen(!links.classList.contains('is-open')));

    // Close the menu after choosing a link.
    links.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && links.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // Fades sections in the first time they scroll into view.
  function initScrollReveal() {
    const items = document.querySelectorAll('.reveal');

    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach((item) => observer.observe(item));
  }

  // Highlights the nav link for the section in the middle of the screen.
  function initActiveNavLink() {
    if (!('IntersectionObserver' in window)) return;

    const links = [...document.querySelectorAll('#nav-links a')];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const link = links.find((item) => item.getAttribute('href') === `#${entry.target.id}`);
        if (!link) return;
        if (entry.isIntersecting) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    links.forEach((link) => {
      const section = document.querySelector(link.getAttribute('href'));
      if (section) observer.observe(section);
    });
  }

  function initScrollProgress() {
    const bar = byId('scroll-progress');
    let ticking = false;

    function update() {
      const scrollable = root.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      bar.style.transform = `scaleX(${Math.min(progress, 1)})`;
      ticking = false;
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    update();
  }

  /* 4. Hero: name effect, typing, network graph and risk matrix
     ======================================================================== */

  // Tells a hero animation whether it's worth running: the hero has to be on
  // screen and the tab has to be in the foreground.
  function watchHeroVisibility(onChange) {
    const hero = document.querySelector('.hero');
    let onScreen = true;
    const notify = () => onChange(onScreen && !document.hidden);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        notify();
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', notify);
  }

  // Types and deletes the focus words in the headline. With reduced motion, the
  // full sentence simply stays on screen.
  function initHeadlineTyping() {
    const headline = document.querySelector('.hero-headline');
    const typed = byId('hero-typed');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const WORDS = ['risk', 'access', 'security operations'];
    const TYPE_MS = 75;
    const DELETE_MS = 40;
    const HOLD_MS = 1700;
    const GAP_MS = 350;

    let wordIndex = 0;
    let length = 0;
    let deleting = false;
    let visible = true;
    let timer = null;

    function step() {
      const word = WORDS[wordIndex];
      length += deleting ? -1 : 1;
      typed.textContent = word.slice(0, length);

      let delay = deleting ? DELETE_MS : TYPE_MS;
      if (!deleting && length === word.length) {
        deleting = true;
        delay = HOLD_MS;
      } else if (deleting && length === 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % WORDS.length;
        delay = GAP_MS;
      }
      timer = setTimeout(step, delay);
    }

    function sync() {
      clearTimeout(timer);
      timer = null;
      headline.classList.toggle('is-typing', !motion.matches);
      if (visible && !motion.matches) timer = setTimeout(step, TYPE_MS);
    }

    motion.addEventListener('change', sync);
    watchHeroVisibility((isVisible) => {
      visible = isVisible;
      sync();
    });
    sync();
  }

  // Draws a subtle network graph behind the hero that leans away from the mouse.
  // It stops whenever the hero isn't visible, stays off on phones and low-power
  // devices, and turns itself off if it can't keep up. Math.random is fine here
  // because this is only decoration.
  function initHeroNetwork() {
    const canvas = byId('hero-network');
    const hero = canvas.closest('.hero');
    const context = canvas.getContext('2d');
    if (!context) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const smallOrTouch = window.matchMedia('(max-width: 767px), (pointer: coarse)');

    const MAX_NODES = 56;
    const MIN_NODES = 18;
    const AREA_PER_NODE = 24000;
    const LINK_DISTANCE = 130;
    const POINTER_RADIUS = 150;
    const POINTER_PUSH = 18;
    const MAX_SPEED = 0.25;
    const FRAME_MS = 33; // About 30 frames a second is plenty for slow drift.
    const SAMPLE_FRAMES = 45;
    const SLOW_FRAME_MS = 60;

    let nodes = [];
    let width = 0;
    let height = 0;
    let color = '';
    let pointer = null;
    let density = 1;
    let gaveUp = false;
    let visible = true;
    let frameId = null;
    let lastFrame = 0;
    let sampleCount = 0;
    let sampleTotal = 0;

    function isLowPower() {
      const { connection, deviceMemory, hardwareConcurrency } = navigator;
      return smallOrTouch.matches
        || Boolean(connection && connection.saveData)
        || (hardwareConcurrency > 0 && hardwareConcurrency <= 2)
        || (deviceMemory > 0 && deviceMemory <= 2);
    }

    function seed() {
      const wanted = Math.round((width * height) / AREA_PER_NODE);
      const count = Math.round(Math.max(MIN_NODES, Math.min(MAX_NODES, wanted)) * density);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 2 * MAX_SPEED,
        vy: (Math.random() - 0.5) * 2 * MAX_SPEED,
        offsetX: 0,
        offsetY: 0,
      }));
    }

    function update() {
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        // Ease towards a small push away from the mouse, and back again after.
        let targetX = 0;
        let targetY = 0;
        if (pointer) {
          const dx = node.x - pointer.x;
          const dy = node.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < POINTER_RADIUS) {
            const push = (1 - distance / POINTER_RADIUS) * POINTER_PUSH;
            targetX = (dx / distance) * push;
            targetY = (dy / distance) * push;
          }
        }
        node.offsetX += (targetX - node.offsetX) * 0.08;
        node.offsetY += (targetY - node.offsetY) * 0.08;
      });
    }

    function drawLine(fromX, fromY, toX, toY, alpha) {
      context.globalAlpha = alpha;
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
      context.stroke();
    }

    function draw() {
      context.clearRect(0, 0, width, height);
      context.fillStyle = color;
      context.strokeStyle = color;
      context.lineWidth = 1;

      const points = nodes.map((node) => ({ x: node.x + node.offsetX, y: node.y + node.offsetY }));

      points.forEach((point, index) => {
        for (let other = index + 1; other < points.length; other += 1) {
          const target = points[other];
          const distance = Math.hypot(point.x - target.x, point.y - target.y);
          if (distance < LINK_DISTANCE) {
            drawLine(point.x, point.y, target.x, target.y, (1 - distance / LINK_DISTANCE) * 0.18);
          }
        }
        if (pointer) {
          const distance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
          if (distance < POINTER_RADIUS) {
            drawLine(point.x, point.y, pointer.x, pointer.y, (1 - distance / POINTER_RADIUS) * 0.28);
          }
        }
        context.globalAlpha = 0.5;
        context.beginPath();
        context.arc(point.x, point.y, 1.6, 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
    }

    // If the device can't keep up, halve the graph. If that doesn't help, stop.
    function checkPerformance(gap) {
      sampleCount += 1;
      sampleTotal += gap;
      if (sampleCount < SAMPLE_FRAMES) return;

      const average = sampleTotal / sampleCount;
      sampleCount = 0;
      sampleTotal = 0;
      if (average <= SLOW_FRAME_MS) return;

      if (density === 1) {
        density = 0.5;
        seed();
      } else {
        gaveUp = true;
        sync();
      }
    }

    function loop(time) {
      frameId = window.requestAnimationFrame(loop);
      const gap = time - lastFrame;
      if (gap < FRAME_MS) return;
      lastFrame = time;
      update();
      draw();
      checkPerformance(gap);
    }

    function stop() {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
    }

    function start() {
      if (frameId !== null) return;
      lastFrame = window.performance.now();
      sampleCount = 0;
      sampleTotal = 0;
      frameId = window.requestAnimationFrame(loop);
    }

    function sync() {
      const allowed = !gaveUp && !isLowPower();
      canvas.hidden = !allowed;
      if (!allowed) {
        stop();
        return;
      }
      if (motion.matches) {
        // One still frame, with no movement or mouse reaction.
        stop();
        pointer = null;
        draw();
      } else if (visible) {
        start();
      } else {
        stop();
      }
    }

    function resize() {
      const bounds = hero.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      seed();
      sync();
    }

    function readColor() {
      color = window.getComputedStyle(root).getPropertyValue('--accent').trim();
      sync();
    }

    hero.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' || motion.matches) return;
      const bounds = hero.getBoundingClientRect();
      pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
      pointer = null;
    });

    new ResizeObserver(resize).observe(hero);
    new MutationObserver(readColor).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    motion.addEventListener('change', sync);
    smallOrTouch.addEventListener('change', sync);
    watchHeroVisibility((isVisible) => {
      visible = isVisible;
      sync();
    });

    readColor();
    resize();
  }

  // Decrypts each line of the name, one character at a time. Math.random is fine
  // here because this is only decoration. The name itself never changes, and
  // screen readers get a fixed copy of it in the heading.
  function initNameEffect() {
    if (prefersReducedMotion()) return;

    const GLYPHS = 'ABCDEFGHKLMNPRSTUVXYZ0123456789#/%$';
    const FRAME_MS = 40;
    const FRAMES_PER_CHARACTER = 2;

    document.querySelectorAll('[data-scramble]').forEach((line, lineIndex) => {
      const finalText = line.textContent;
      const characters = [...finalText];
      let frame = -lineIndex * 6;

      function draw() {
        frame += 1;
        const revealed = Math.max(0, Math.floor(frame / FRAMES_PER_CHARACTER));
        if (revealed >= characters.length) {
          line.textContent = finalText;
          return false;
        }
        line.textContent = characters
          .map((character, index) => (index < revealed
            ? character
            : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join('');
        return true;
      }

      draw();
      const timer = setInterval(() => {
        if (!draw()) clearInterval(timer);
      }, FRAME_MS);
    });
  }

  // The rating bands used across the site, for a likelihood x impact score.
  function riskRating(score) {
    if (score >= 15) return 'High';
    if (score >= 6) return 'Medium';
    return 'Low';
  }

  // Builds the 5 x 5 likelihood and impact heat map behind the terminal, shaded
  // by score (likelihood multiplied by impact), as in a real risk matrix.
  function initRiskMatrix() {
    const matrix = byId('risk-matrix');
    const SIZE = 5;

    for (let likelihood = SIZE; likelihood >= 1; likelihood -= 1) {
      for (let impact = 1; impact <= SIZE; impact += 1) {
        const level = { Low: '', Medium: 'is-mid', High: 'is-high' }[riskRating(likelihood * impact)];
        matrix.append(h('span', { className: `matrix-cell ${level}`.trim() }));
      }
    }
  }

  /* 5. Terminal
     ======================================================================== */
  function initTerminal() {
    const output = byId('terminal-output');
    const form = byId('terminal-form');
    const input = byId('terminal-input');
    const terminal = form.closest('.terminal');

    const PROMPT = 'guest@aniketh:~$';
    const MAX_LINES = 200;
    const MAX_HISTORY = 50;
    const TYPE_SPEED_MS = 14;

    const BOOT_LINES = [
      { text: 'Starting session...', className: 'term-muted' },
      { text: 'Cookies: 0   Trackers: 0   Third-party scripts: 0', className: 'term-muted' },
      { text: 'Hi, I\'m Aniketh. Type "help" to look around.', className: 'term-accent' },
    ];

    const history = [];
    let historyIndex = 0;

    /* Output. Every line is added as text, so typed input can't become markup. */
    function addLine(line) {
      output.append(line);
      while (output.childElementCount > MAX_LINES) output.firstElementChild.remove();
      output.scrollTop = output.scrollHeight;
      return line;
    }

    function print(text, className = '') {
      return addLine(h('p', { className: `term-line ${className}`, text }));
    }

    // A label and value in two columns that stay aligned when the value wraps.
    // The value can be plain text or a link built with h().
    function printRow(label, value, className = '') {
      return addLine(h('p', { className: `term-row ${className}` }, [
        h('span', { text: label }),
        h('span', {}, [value]),
      ]));
    }

    function printJump(sectionId) {
      const link = h('a', {
        className: 'term-link',
        text: `Go to the ${sectionId} section`,
        attrs: { href: `#${sectionId}` },
      });
      addLine(h('p', { className: 'term-line' }, [link]));
    }

    /* The terminal reads its answers from the page, so each personal detail
       only needs to be edited once, in index.html. */
    function pageText(node) {
      return node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    function printAbout() {
      document.querySelectorAll('.about-text p').forEach((paragraph) => {
        print(pageText(paragraph));
        print('');
      });
      byId('about-facts').querySelectorAll('div').forEach((fact) => {
        printRow(pageText(fact.querySelector('dt')), pageText(fact.querySelector('dd')));
      });
      printJump('about');
    }

    function printCurrently() {
      document.querySelectorAll('[data-now-item]').forEach((item) => {
        print(pageText(item.querySelector('h3')), 'term-heading');
        print(pageText(item.querySelector('p')));
      });
      printJump('currently');
    }

    function printSkills() {
      document.querySelectorAll('[data-skill-group]').forEach((group) => {
        print(pageText(group.querySelector('h3')), 'term-heading');
        group.querySelectorAll('li').forEach((skill) => print(`  ${pageText(skill)}`));
      });
      print('Certifications', 'term-heading');
      document.querySelectorAll('.cert-card').forEach((card) => {
        print(`  ${pageText(card.querySelector('.cert-name'))}: ${pageText(card.querySelector('.cert-meta'))}`);
      });
      printJump('skills');
    }

    // Prints a title, its details and any bullet points from a block on the page.
    function printEntry(block, dateSelector) {
      print(pageText(block.querySelector('h3')), 'term-heading');
      const organisation = block.querySelector('.timeline-org');
      if (organisation) print(pageText(organisation));
      print(pageText(block.querySelector(dateSelector)), 'term-muted');
      block.querySelectorAll('li').forEach((point) => print(`- ${pageText(point)}`, 'term-bullet'));
    }

    function printExperience() {
      byId('experience-list').querySelectorAll('.timeline-item').forEach((item) => printEntry(item, '.timeline-date'));
      print('Type "education" for my degrees and diploma.', 'term-muted');
      printJump('experience');
    }

    function printEducation() {
      byId('education-list').querySelectorAll('.timeline-item').forEach((item) => {
        printEntry(item, '.timeline-date');
        const coursework = item.querySelector('.timeline-body > p:last-child:not(.timeline-org)');
        if (coursework) print(pageText(coursework));
      });
      printJump('experience');
    }

    function printProjects() {
      document.querySelectorAll('[data-project]').forEach((project) => printEntry(project, '.project-dates'));
      printJump('projects');
    }

    function printRoute() {
      print('traceroute to aniketh, 3 hops', 'term-muted');
      byId('route-hops').querySelectorAll('.route-hop').forEach((hop) => {
        const place = `${pageText(hop.querySelector('.hop-number'))}  ${pageText(hop.querySelector('.hop-place'))}`;
        printRow(place, `${pageText(hop.querySelector('.hop-dates'))}. ${pageText(hop.querySelector('.hop-detail'))}`);
      });
    }

    function printThreats() {
      print('Threat model of this site (worst risk after controls)', 'term-heading');
      Object.values(THREAT_MODEL).forEach((component) => {
        print(`${riskRating(componentScore(component)).padEnd(7)}${component.name}`);
      });
      printJump('threat-model');
    }

    function printContact() {
      print(pageText(document.querySelector('#contact .section-intro')));
      document.querySelectorAll('[data-contact-link]').forEach((source) => {
        // Only copies links written into index.html, never anything typed here.
        const link = h('a', {
          className: 'term-link',
          text: source.getAttribute('href'),
          attrs: { href: source.getAttribute('href'), target: '_blank', rel: 'noopener noreferrer' },
        });
        printRow(source.dataset.label, link);
      });
    }

    /* A Map rather than a plain object, so that typing "constructor" or
       "__proto__" can't match something inherited from Object. */
    const COMMANDS = new Map([
      ['help', { description: 'list what you can type here', run: printHelp }],
      ['about', { description: 'who I am', run: printAbout }],
      ['currently', { description: 'what I\'m up to right now', run: printCurrently }],
      ['skills', { description: 'my skills and certifications', run: printSkills }],
      ['experience', { description: 'where I\'ve worked', run: printExperience }],
      ['education', { description: 'what I\'ve studied', run: printEducation }],
      ['projects', { description: 'my risk analysis projects', run: printProjects }],
      ['threats', { description: 'how I threat-modelled this site', run: printThreats }],
      ['contact', { description: 'LinkedIn and GitHub', run: printContact }],
      ['traceroute', { description: 'how I got to Dublin', run: printRoute }],
      ['challenge', { description: 'jump to the security games', run: goToChallenge }],
      ['theme', { description: 'switch between dark and light', run: () => print(`Theme set to ${toggleTheme()}.`) }],
      ['clear', { description: 'clear the screen', run: () => output.replaceChildren() }],
    ]);

    const EASTER_EGGS = new Map([
      ['sudo', 'guest is not in the sudoers file. This incident will be raised at the next audit.'],
      ['whoami', 'guest: read-only access. Least privilege, as it should be.'],
      ['ls', 'about  currently  skills  experience  education  projects  challenge  threats  contact'],
      ['rm', 'Access denied. That would need an approved request and an audit trail.'],
      ['fair', 'Estimated loss from typing that command: EUR 0. Confidence: high.'],
    ]);

    function printHelp() {
      print('Available commands', 'term-heading');
      COMMANDS.forEach((command, name) => printRow(name, command.description));
      print('Up and down arrows recall commands. Tab completes them.', 'term-muted');
    }

    function goToChallenge() {
      print('Opening the security challenge...', 'term-muted');
      byId('challenge').scrollIntoView({ behavior: scrollBehavior() });
    }

    // Hidden on purpose: left out of "help" and of Tab completion.
    function printHireReply() {
      const linkedIn = document.querySelector('[data-contact-link][data-label="LinkedIn"]');
      print('[sudo] access request received.', 'term-muted');
      print('Requester: guest. Request: hire one cybersecurity professional.');
      print('Least privilege check: passed. You only asked for one.');
      print('Final approval needs a human, so this one can\'t be automated.', 'term-accent');
      addLine(h('p', { className: 'term-line' }, [
        'Complete the request here: ',
        h('a', {
          className: 'term-link',
          text: linkedIn.getAttribute('href'),
          attrs: { href: linkedIn.getAttribute('href'), target: '_blank', rel: 'noopener noreferrer' },
        }),
      ]));
    }

    function runCommand(rawInput) {
      finishBoot();
      const raw = rawInput.trim();
      print(`${PROMPT} ${raw}`, 'term-echo');
      if (!raw) return;

      history.push(raw);
      if (history.length > MAX_HISTORY) history.shift();
      historyIndex = history.length;

      const words = raw.toLowerCase().split(/\s+/);
      if (words.join(' ') === 'sudo hire aniketh') {
        printHireReply();
        return;
      }

      const name = words[0];
      const command = COMMANDS.get(name);

      if (command) {
        command.run();
      } else if (EASTER_EGGS.has(name)) {
        print(EASTER_EGGS.get(name));
      } else {
        // Safe to echo: print() uses textContent, so this stays plain text.
        print(`command not found: ${raw}`, 'term-error');
        print(/[<>]/.test(raw)
          ? 'Nice try. That went through textContent, so it stayed as plain text.'
          : 'Type "help" to see what you can do here.', 'term-muted');
      }
    }

    /* Boot animation. It stops and fills in the remaining text as soon as the
       visitor does anything. */
    let booting = true;
    let bootTimer = null;
    let bootLineIndex = 0;
    let bootCharIndex = 0;
    let bootLineNode = null;

    function typeNextCharacter() {
      const current = BOOT_LINES[bootLineIndex];
      if (!current) {
        finishBoot();
        return;
      }
      if (!bootLineNode) bootLineNode = print('', current.className);

      bootCharIndex += 1;
      bootLineNode.textContent = current.text.slice(0, bootCharIndex);

      if (bootCharIndex >= current.text.length) {
        bootLineIndex += 1;
        bootCharIndex = 0;
        bootLineNode = null;
        bootTimer = setTimeout(typeNextCharacter, 180);
      } else {
        bootTimer = setTimeout(typeNextCharacter, TYPE_SPEED_MS);
      }
    }

    function finishBoot() {
      if (!booting) return;
      booting = false;
      clearTimeout(bootTimer);

      if (bootLineNode) {
        bootLineNode.textContent = BOOT_LINES[bootLineIndex].text;
        bootLineIndex += 1;
      }
      BOOT_LINES.slice(bootLineIndex).forEach((line) => print(line.text, line.className));

      // Screen readers only start announcing once the typing effect is over.
      output.setAttribute('aria-live', 'polite');
    }

    /* Input handling */
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value;
      input.value = '';
      runCommand(value);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp' && history.length) {
        event.preventDefault();
        historyIndex = Math.max(0, historyIndex - 1);
        input.value = history[historyIndex];
      } else if (event.key === 'ArrowDown' && history.length) {
        event.preventDefault();
        historyIndex = Math.min(history.length, historyIndex + 1);
        input.value = history[historyIndex] ?? '';
      } else if (event.key === 'Tab' && input.value.trim()) {
        // With an empty prompt, Tab moves on as usual so keyboard users aren't trapped.
        const prefix = input.value.trim().toLowerCase();
        const matches = [...COMMANDS.keys()].filter((name) => name.startsWith(prefix));
        if (matches.length === 1) {
          event.preventDefault();
          input.value = matches[0];
        }
      }
    });

    input.addEventListener('focus', finishBoot, { once: true });

    // Clicking the terminal focuses the prompt, unless the visitor is selecting
    // text or following a link. It never takes focus on page load, which would
    // scroll the page and open the keyboard on phones.
    terminal.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      if (String(window.getSelection())) return;
      input.focus();
    });

    document.querySelectorAll('.chip[data-command]').forEach((chip) => {
      chip.addEventListener('click', () => runCommand(chip.dataset.command));
    });

    /* Start up */
    if (prefersReducedMotion()) {
      finishBoot();
    } else {
      typeNextCharacter();
    }
  }

  /* 6. Tabs
     ======================================================================== */
  function initTabs() {
    const tabs = [...document.querySelectorAll('[role="tab"]')];

    function selectTab(tab, moveFocus) {
      tabs.forEach((item) => {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.setAttribute('tabindex', selected ? '0' : '-1');
        byId(item.getAttribute('aria-controls')).hidden = !selected;
      });
      if (moveFocus) tab.focus();
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTab(tab, false));

      // Standard keyboard pattern for tabs: arrows, Home and End.
      tab.addEventListener('keydown', (event) => {
        const last = tabs.length - 1;
        const targets = {
          ArrowRight: index === last ? 0 : index + 1,
          ArrowLeft: index === 0 ? last : index - 1,
          Home: 0,
          End: last,
        };
        if (Object.hasOwn(targets, event.key)) {
          event.preventDefault();
          selectTab(tabs[targets[event.key]], true);
        }
      });
    });
  }

  /* 7. Game 1: Find the Vulnerability
     ======================================================================== */
  const FINDINGS = {
    http: {
      severity: 'High',
      title: 'Login page served over plain HTTP',
      risk: 'Anyone on the network path can read or change the traffic, including the password.',
      fix: 'Serve the whole site over HTTPS, redirect HTTP to it and enable HSTS.',
    },
    'url-creds': {
      severity: 'High',
      title: 'Password in the URL',
      risk: 'URLs are kept in browser history and server logs, and can leak to other sites through the Referer header.',
      fix: 'Send credentials only in the body of a POST request over HTTPS.',
    },
    enumeration: {
      severity: 'Medium',
      title: 'Error message confirms the username exists',
      risk: 'Attackers can work out which accounts are real, then focus their password guessing on them.',
      fix: 'Use one generic message for every failure, such as "Incorrect username or password".',
    },
    lockout: {
      severity: 'High',
      title: 'No limit on login attempts',
      risk: 'Unlimited retries make brute force and credential stuffing easy.',
      fix: 'Add rate limiting, alert on repeated failures and offer multi-factor authentication.',
    },
    recovery: {
      severity: 'High',
      title: 'Password reset emails the existing password',
      risk: 'If a site can send you your password, it is stored in a recoverable form instead of being hashed, and a copy now sits in an inbox.',
      fix: 'Store passwords with a slow, salted hash such as Argon2id or bcrypt, and send a short-lived, single-use reset link.',
    },
    debug: {
      severity: 'Critical',
      title: 'Test credentials left in the page',
      risk: 'A leftover developer note hands attackers a working login, and this one looks like an admin account.',
      fix: 'Remove test accounts from production, review pages before release and scan code for secrets automatically.',
    },
  };

  const DECOYS = {
    domain: 'The domain name alone isn\'t a problem here. Look at what comes before and after it.',
    logo: 'That\'s just branding. Not a finding.',
    username: 'A username field is expected on a login page. Not a finding.',
    password: 'The password is masked, which is what it should be. Not a finding.',
    signin: 'A sign-in button isn\'t a risk in itself. Not a finding.',
    privacy: 'A link to a privacy policy is a good sign. Not a finding.',
  };

  function initVulnerabilityGame() {
    const stage = byId('vuln-stage');
    const score = byId('vuln-score');
    const message = byId('vuln-message');
    const report = byId('vuln-report');
    const revealButton = byId('vuln-reveal');
    const total = Object.keys(FINDINGS).length;

    let found = 0;
    let falsePositives = 0;

    function updateScore() {
      const label = falsePositives === 1 ? 'false positive' : 'false positives';
      score.textContent = `Found ${found} of ${total} / ${falsePositives} ${label}`;
    }

    function showMessage(text, tone = '') {
      message.textContent = text;
      message.className = `game-message ${tone}`.trim();
    }

    // Newest first, so the latest finding is always next to the fake page.
    function addToReport(finding) {
      report.prepend(h('li', { className: 'report-item' }, [
        h('p', { className: 'report-title' }, [
          h('span', { className: 'report-severity', text: finding.severity }),
          finding.title,
        ]),
        h('p', { text: finding.risk }),
        h('p', { className: 'report-fix', text: `Fix: ${finding.fix}` }),
      ]));
    }

    stage.addEventListener('click', (event) => {
      const spot = event.target.closest('.spot');
      if (!spot || spot.getAttribute('aria-disabled') === 'true') return;
      spot.setAttribute('aria-disabled', 'true');

      if (spot.dataset.finding) {
        const finding = FINDINGS[spot.dataset.finding];
        spot.classList.add('is-found');
        found += 1;
        addToReport(finding);

        if (found === total) {
          showMessage(`All ${total} found. Report complete, with ${falsePositives} false ${falsePositives === 1 ? 'positive' : 'positives'}.`, 'is-good');
          revealButton.disabled = true;
          markTabComplete('tab-vuln');
        } else {
          showMessage(`Finding logged: ${finding.title}.`, 'is-good');
        }
      } else {
        spot.classList.add('is-cleared');
        falsePositives += 1;
        showMessage(DECOYS[spot.dataset.decoy], 'is-bad');
      }
      updateScore();
    });

    revealButton.addEventListener('click', () => {
      stage.querySelectorAll('.spot[data-finding]:not(.is-found)').forEach((spot) => {
        spot.classList.add('is-missed');
        spot.setAttribute('aria-disabled', 'true');
        addToReport(FINDINGS[spot.dataset.finding]);
      });
      // Everything is decided now, so the decoys can't be clicked either.
      stage.querySelectorAll('.spot').forEach((spot) => spot.setAttribute('aria-disabled', 'true'));
      showMessage(`You found ${found} of ${total}. The rest are marked on the page and listed below.`);
      revealButton.disabled = true;
    });

    byId('vuln-reset').addEventListener('click', () => {
      found = 0;
      falsePositives = 0;
      stage.querySelectorAll('.spot').forEach((spot) => {
        spot.classList.remove('is-found', 'is-missed', 'is-cleared');
        spot.removeAttribute('aria-disabled');
      });
      report.replaceChildren();
      revealButton.disabled = false;
      showMessage('No findings yet. Pick something on the page to inspect it.');
      updateScore();
    });
  }

  /* 8. Game 2: Phishing Spotter
     All names and domains are fictional, and .example is reserved so it can
     never belong to a real organisation. Links are shown as text only.
     ======================================================================== */
  const EMAILS = [
    {
      isPhish: true,
      fromName: 'IT Helpdesk',
      fromAddress: 'helpdesk@acme-corp-support.example',
      subject: 'URGENT: your mailbox is 98% full',
      body: [
        'Your mailbox will stop receiving messages today unless you confirm your account.',
        'Sign in below within 2 hours to keep your email working.',
      ],
      link: { label: 'Confirm my account', target: 'http://acme-corp-support.example/mailbox/login' },
      tells: [
        'The sender uses acme-corp-support.example, not the company\'s real domain, acme-corp.example.',
        'A two-hour deadline is there to rush you.',
        'The link asks you to sign in on a lookalike site over plain HTTP.',
      ],
    },
    {
      isPhish: true,
      fromName: 'Dana Whitfield (CEO)',
      fromAddress: 'dana.whitfield.ceo@freemail.example',
      subject: 'Quick favour, are you at your desk?',
      body: [
        'I\'m stuck in meetings all day and need you to buy five gift cards for a client today. I\'ll pay you back.',
        'Send me the codes by reply, and please keep this between us for now.',
      ],
      tells: [
        'A CEO writing from a free personal email address, not a company one.',
        'Gift card codes work like cash and are rarely recoverable.',
        'Asking for secrecy stops you from checking with anyone else.',
      ],
    },
    {
      isPhish: true,
      fromName: 'Acme Supplies Accounts',
      fromAddress: 'accounts@acrne-supplies.example',
      subject: 'Our bank details have changed',
      body: [
        'Please note that our bank account has changed. Pay invoice INV-20418 to the new account in the attached form before Friday.',
        'Our finance line is down this week, so please reply to this email with any questions.',
      ],
      attachment: 'New_bank_details.pdf.exe',
      tells: [
        'Look closely: "acrne" uses r and n to look like "acme".',
        'The attachment ends in .exe, so it is a program pretending to be a PDF.',
        'Always confirm changed bank details by calling a number you already have, not one from the email.',
      ],
    },
    {
      isPhish: true,
      fromName: 'Acme Bank Security',
      fromAddress: 'alerts@acme-bank.secure-verify.example',
      replyTo: 'support@secure-verify.example',
      subject: 'Unusual sign-in: verify within 24 hours',
      body: [
        'We detected an unusual sign-in on your account. To avoid suspension, verify your identity and card details within 24 hours.',
      ],
      link: { label: 'Verify my account', target: 'https://acme-bank.secure-verify.example/login' },
      tells: [
        'The real domain is secure-verify.example. "acme-bank" is only a subdomain of it.',
        'HTTPS only means the connection is encrypted. It doesn\'t mean the site is honest.',
        'Banks don\'t ask for card details through an emailed link, and the threat of suspension is pressure.',
      ],
    },
    {
      isPhish: true,
      fromName: 'Docs Share',
      fromAddress: 'no-reply@docs-share.example',
      subject: 'Priya shared "Q3 salary review.xlsx" with you',
      body: [
        'Priya has shared a document with you. Sign in with your work email and password to view it.',
      ],
      link: { label: 'Open document', target: 'https://docs-share.example/view?id=88213' },
      tells: [
        'A salary file is bait: it is hard not to look.',
        'The service isn\'t your company\'s, yet it asks for your work password.',
        'If in doubt, check with Priya through another channel before opening anything.',
      ],
    },
    {
      isPhish: false,
      fromName: 'IT Notices',
      fromAddress: 'it-notices@acme-corp.example',
      subject: 'Planned VPN maintenance on Saturday, 22:00 to 23:00',
      body: [
        'The VPN will be unavailable for up to an hour during planned maintenance on Saturday evening. You don\'t need to do anything.',
        'If you have questions, contact the service desk in the usual way.',
      ],
      tells: [
        'It comes from the company\'s real domain, acme-corp.example.',
        'There is no link, no attachment and nothing asked of you.',
        'There is no pressure, and it points you to a contact route you already know.',
      ],
    },
    {
      isPhish: false,
      fromName: 'Acme Finance',
      fromAddress: 'notifications@finance.acme-corp.example',
      subject: 'Expense report 4471 was approved',
      body: [
        'Your expense report 4471 was approved and will be included in your next payment. No action is needed.',
      ],
      link: { label: 'View report', target: 'https://finance.acme-corp.example/expenses/4471' },
      tells: [
        'The sender and link both sit under the real domain, acme-corp.example.',
        'It asks for nothing and creates no urgency.',
        'It refers to something specific you can check. If unsure, open the finance system yourself instead of using the link.',
      ],
    },
    {
      isPhish: false,
      fromName: 'Acme Learning',
      fromAddress: 'learning@acme-corp.example',
      subject: 'Reminder: annual security training is due this month',
      body: [
        'Our records show you haven\'t completed this year\'s security awareness course. Please finish it by the end of the month.',
      ],
      link: { label: 'Go to course', target: 'https://learning.acme-corp.example/courses/security-awareness' },
      tells: [
        'A deadline alone doesn\'t make an email fake. This one is reasonable and comes with no threat.',
        'The sender and link both use the real domain, acme-corp.example.',
        'It doesn\'t ask for a password in the email. The safest route is still to open the training site yourself.',
      ],
    },
  ];

  function initPhishingGame() {
    const PHISH_PER_ROUND = 4;
    const SAFE_PER_ROUND = 2;

    const roundView = byId('phish-round');
    const resultView = byId('phish-result');
    const email = byId('phish-email');
    const subject = byId('phish-subject');
    const replyRow = byId('phish-reply-row');
    const body = byId('phish-body');
    const attachment = byId('phish-attachment');
    const linkLine = byId('phish-link');
    const actions = byId('phish-actions');
    const feedback = byId('phish-feedback');
    const nextButton = byId('phish-next');

    let round = [];
    let position = 0;
    let score = 0;

    function buildRound() {
      const phish = shuffle(EMAILS.filter((item) => item.isPhish)).slice(0, PHISH_PER_ROUND);
      const safe = shuffle(EMAILS.filter((item) => !item.isPhish)).slice(0, SAFE_PER_ROUND);
      return shuffle([...phish, ...safe]);
    }

    function showEmail() {
      const current = round[position];

      byId('phish-progress').textContent = `Email ${position + 1} of ${round.length}`;
      byId('phish-score').textContent = `Score ${score}`;

      subject.textContent = current.subject;
      byId('phish-from').textContent = `${current.fromName} <${current.fromAddress}>`;

      replyRow.hidden = !current.replyTo;
      byId('phish-reply').textContent = current.replyTo || '';

      body.replaceChildren(...current.body.map((text) => h('p', { text })));

      attachment.hidden = !current.attachment;
      attachment.textContent = current.attachment ? `Attachment: ${current.attachment}` : '';

      linkLine.hidden = !current.link;
      linkLine.textContent = current.link
        ? `Button "${current.link.label}" goes to: ${current.link.target}`
        : '';

      actions.hidden = false;
      feedback.replaceChildren();
      nextButton.hidden = true;
    }

    function answer(saidPhish) {
      const current = round[position];
      const correct = saidPhish === current.isPhish;
      if (correct) score += 1;
      byId('phish-score').textContent = `Score ${score}`;

      const verdict = `${correct ? 'Correct' : 'Not quite'}: this one ${current.isPhish ? 'is phishing' : 'is safe'}.`;
      const panel = h('div', { className: `phish-feedback ${correct ? '' : 'is-wrong'}`.trim() }, [
        h('p', { className: 'phish-verdict', text: verdict }),
        h('ul', {}, current.tells.map((tell) => h('li', { text: tell }))),
      ]);
      feedback.replaceChildren(panel);

      actions.hidden = true;
      nextButton.hidden = false;
      nextButton.textContent = position === round.length - 1 ? 'See my score' : 'Next email';
      nextButton.focus({ preventScroll: true });
      nextButton.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
    }

    function resultMessage() {
      if (score === round.length) return 'Perfect score. You checked the details, not just the look of each email.';
      if (score >= round.length - 2) return 'Solid instincts. When in doubt, check the sender\'s domain and where any link really goes.';
      return 'Phishing is built to fool people, so this is good practice. Start with the sender\'s domain, then ask what the email wants you to do.';
    }

    function showResult() {
      roundView.hidden = true;
      resultView.hidden = false;
      byId('phish-progress').textContent = 'Round complete';
      byId('phish-result-title').textContent = `You scored ${score} out of ${round.length}`;
      byId('phish-result-text').textContent = resultMessage();
      byId('phish-result-title').focus({ preventScroll: true });
      markTabComplete('tab-phish');
    }

    function startRound() {
      round = buildRound();
      position = 0;
      score = 0;
      roundView.hidden = false;
      resultView.hidden = true;
      showEmail();
    }

    byId('phish-safe').addEventListener('click', () => answer(false));
    byId('phish-fake').addEventListener('click', () => answer(true));

    nextButton.addEventListener('click', () => {
      position += 1;
      if (position >= round.length) {
        showResult();
        return;
      }
      showEmail();
      // Focus moves to the new subject, and the top of the email comes back into view.
      subject.focus({ preventScroll: true });
      email.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
    });

    byId('phish-again').addEventListener('click', () => {
      startRound();
      subject.focus({ preventScroll: true });
    });

    startRound();
  }

  /* 9. Game 3: Password Puzzle
     Visitors crack someone else's bad password instead of testing their own,
     so this game never encourages typing a real password into a website.
     ======================================================================== */
  const PASSWORDS = [
    { word: 'qwerty', clue: 'Look down at your keyboard.', note: 'It\'s just the top row of a keyboard, so it is one of the first patterns any cracking tool tries.' },
    { word: 'dragon', clue: 'A fire-breathing fantasy favourite.', note: 'A single dictionary word like this appears on published lists of common passwords, so attackers try it early.' },
    { word: 'monkey', clue: 'A curious, tree-climbing primate.', note: 'Common words are the first thing a dictionary attack tries, and this one has been on common password lists for years.' },
    { word: 'shadow', clue: 'It follows you around on a sunny day.', note: 'A single everyday word falls quickly to a dictionary attack, whatever it means to you.' },
    { word: 'master', clue: 'The opposite of an apprentice.', note: 'Everyday words like this are on the common password lists attackers start from.' },
    { word: 'soccer', clue: 'A sport played with a round ball and two goals.', note: 'Hobbies and teams are easy to guess, and sometimes easy to find on social media too.' },
    { word: 'abc123', clue: 'The start of the alphabet, then the start of counting.', note: 'Mixing letters and digits doesn\'t help when the pattern is this predictable.' },
    { word: 'summer', clue: 'The hottest season of the year.', note: 'Seasons are a classic choice, often with a year added to pass a complexity rule. Attackers know that habit.' },
    { word: 'secret', clue: 'What a password is supposed to be.', note: 'The irony doesn\'t help: it\'s another common word that cracking lists include.' },
  ];

  // Wordle-style scoring that handles repeated characters correctly.
  function scoreGuess(guess, target) {
    const result = Array(guess.length).fill('absent');
    const remaining = {};

    [...target].forEach((character, index) => {
      if (guess[index] === character) {
        result[index] = 'correct';
      } else {
        remaining[character] = (remaining[character] || 0) + 1;
      }
    });

    [...guess].forEach((character, index) => {
      if (result[index] !== 'correct' && remaining[character] > 0) {
        result[index] = 'present';
        remaining[character] -= 1;
      }
    });

    return result;
  }

  function initPasswordPuzzle() {
    const MAX_GUESSES = 6;
    const LENGTH = 6;
    const TILE_LABELS = { correct: 'right place', present: 'wrong place', absent: 'not in it' };
    const TILE_MARKS = { correct: '✓', present: '~', absent: '×' };

    const grid = byId('puzzle-grid');
    const form = byId('puzzle-form');
    const input = byId('puzzle-input');
    const submit = byId('puzzle-submit');
    const message = byId('puzzle-message');
    const lesson = byId('puzzle-lesson');

    let target = null;
    let guessCount = 0;

    function showMessage(text, tone = '') {
      message.textContent = text;
      message.className = `game-message ${tone}`.trim();
    }

    function buildGrid() {
      const rows = Array.from({ length: MAX_GUESSES }, () => {
        const tiles = Array.from({ length: LENGTH }, () => h('div', { className: 'tile' }));
        return h('div', { className: 'puzzle-row' }, tiles);
      });
      grid.replaceChildren(...rows);
    }

    function showGuess(guess, states) {
      const row = grid.children[guessCount];
      [...row.children].forEach((tile, index) => {
        const state = states[index];
        tile.textContent = guess[index];
        tile.classList.add(`is-${state}`);
        tile.append(h('span', { className: 'tile-mark', text: TILE_MARKS[state], attrs: { 'aria-hidden': 'true' } }));
      });

      // Spells out the result for screen readers, which can't see the colours.
      const description = [...guess].map((character, index) => `${character} ${TILE_LABELS[states[index]]}`).join(', ');
      row.setAttribute('role', 'img');
      row.setAttribute('aria-label', `Guess ${guessCount + 1}: ${description}`);
      return description;
    }

    function finishRound(text, tone) {
      showMessage(text, tone);
      input.disabled = true;
      submit.disabled = true;
      byId('puzzle-note').textContent = target.note;
      lesson.hidden = false;
      markTabComplete('tab-puzzle');
    }

    function startRound() {
      // Never serve the same password twice in a row.
      const options = PASSWORDS.filter((item) => item !== target);
      target = options[Math.floor(Math.random() * options.length)];
      guessCount = 0;

      byId('puzzle-clue').textContent = target.clue;
      buildGrid();
      input.value = '';
      input.disabled = false;
      submit.disabled = false;
      lesson.hidden = true;
      showMessage('Letters and numbers only.');
    }

    // Allow-list the input: lowercase letters and digits, and nothing else.
    input.addEventListener('input', () => {
      input.value = input.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, LENGTH);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const guess = input.value;

      if (guess.length !== LENGTH) {
        showMessage(`Your guess needs ${LENGTH} characters.`, 'is-bad');
        return;
      }

      const description = showGuess(guess, scoreGuess(guess, target.word));
      guessCount += 1;
      input.value = '';

      if (guess === target.word) {
        const tries = guessCount === 1 ? '1 guess' : `${guessCount} guesses`;
        finishRound(`Cracked in ${tries}. The password was "${target.word}".`, 'is-good');
      } else if (guessCount === MAX_GUESSES) {
        finishRound(`Out of guesses. The password was "${target.word}".`, 'is-bad');
      } else {
        const left = MAX_GUESSES - guessCount;
        showMessage(`${description}. ${left} ${left === 1 ? 'guess' : 'guesses'} left.`);
      }
    });

    byId('puzzle-again').addEventListener('click', () => {
      startRound();
      input.focus();
    });

    startRound();
  }

  /* 10. Threat model
     Every control listed here exists in this repository, and "where" says which
     file it is in. Ratings are likelihood x impact after the controls.
     ======================================================================== */
  const STRIDE = {
    S: 'Spoofing',
    T: 'Tampering',
    R: 'Repudiation',
    I: 'Information disclosure',
    D: 'Denial of service',
    E: 'Elevation of privilege',
  };

  const CONTROLS = {
    csp: { name: 'Content Security Policy allowing only this site\'s own files', where: 'index.html' },
    trustedTypes: { name: 'Trusted Types, so string-to-HTML writes throw an error', where: 'index.html' },
    selfHosted: { name: 'Self-hosted fonts and no third-party scripts', where: 'index.html, style.css' },
    htmlLint: { name: 'Lint that fails if the policy is weakened', where: 'scripts/check-html-security.mjs' },
    noopener: { name: 'rel="noopener" on links that open a new tab, enforced by lint', where: 'index.html, scripts/check-html-security.mjs' },
    referrer: { name: 'No referrer sent to other sites', where: 'index.html' },
    noTracking: { name: 'No cookies, analytics or backend calls', where: 'script.js' },
    noOutbound: { name: 'Outbound connections blocked by default-src \'none\'', where: 'index.html' },
    noSubmit: { name: 'Forms can\'t submit anywhere, through form-action \'none\'', where: 'index.html' },
    themeOnly: { name: 'Only the theme choice is stored, in the visitor\'s browser', where: 'script.js' },
    textContent: { name: 'Text is written with textContent, never innerHTML', where: 'script.js' },
    eslint: { name: 'ESLint security rules, including no-unsanitized', where: 'eslint.config.mjs' },
    commandMap: { name: 'Commands looked up in a Map, not a plain object', where: 'script.js' },
    outputCap: { name: 'Limits on input length, output lines and history', where: 'index.html, script.js' },
    staticLinks: { name: 'Terminal links copied only from the page, never from input', where: 'script.js' },
    inputAllowList: { name: 'Guesses limited to lowercase letters and digits', where: 'script.js' },
    noRealFields: { name: 'The fake login has no real inputs or forms', where: 'index.html' },
    passwordWarning: { name: 'On-screen warning not to type a real password', where: 'index.html' },
    fictionalContent: { name: 'Reserved .example domains, with email links shown as text only', where: 'script.js' },
    localScores: { name: 'Scores stay in the browser and are never sent or saved', where: 'script.js' },
    codeql: { name: 'CodeQL security-extended scan, where any finding blocks deployment', where: '.github/workflows/pipeline.yml' },
    gitleaks: { name: 'Gitleaks secret scan on every run', where: '.github/workflows/pipeline.yml' },
    noSecrets: { name: 'No secrets or API keys in the code', where: 'whole repository, checked by Gitleaks' },
    noReport: { name: 'Gitleaks report upload turned off', where: '.github/workflows/pipeline.yml' },
    pinned: { name: 'Actions pinned to full commit SHAs', where: '.github/workflows/pipeline.yml' },
    dependabot: { name: 'Dependabot updates for Actions, after a 7-day wait', where: '.github/dependabot.yml' },
    lockfile: { name: 'Exact versions from the lockfile, with install scripts off', where: 'package-lock.json, pipeline.yml' },
    leastPrivilege: { name: 'No workflow permissions by default, granted per job', where: '.github/workflows/pipeline.yml' },
    noPersist: { name: 'Checkout doesn\'t keep credentials on disk', where: '.github/workflows/pipeline.yml' },
    gatedDeploy: { name: 'Deployment needs CodeQL, Gitleaks and lint to pass', where: '.github/workflows/pipeline.yml' },
    allowListDeploy: { name: 'Only an allow-list of website files is published', where: '.github/workflows/pipeline.yml' },
    deployJobOnly: { name: 'Only the deploy job can write to Pages', where: '.github/workflows/pipeline.yml' },
    deployEnvironment: { name: 'Deployments run through the github-pages environment', where: '.github/workflows/pipeline.yml' },
  };

  const THREAT_MODEL = {
    browser: {
      name: 'Visitor\'s browser',
      summary: 'Everything runs here, so the main job is making sure only this site\'s own code can run.',
      threats: [
        {
          stride: 'T',
          title: 'Injected or third-party script runs in the page',
          likelihood: 1,
          impact: 4,
          controls: ['csp', 'trustedTypes', 'selfHosted', 'htmlLint'],
          gap: 'Trusted Types only helps in browsers that support it. The rest of the policy still applies elsewhere.',
        },
        {
          stride: 'I',
          title: 'The site collects or leaks data about visitors',
          likelihood: 1,
          impact: 2,
          controls: ['noTracking', 'noOutbound', 'themeOnly', 'referrer'],
          gap: 'GitHub hosts the site and can see normal web requests. That is outside this code.',
        },
        {
          stride: 'S',
          title: 'Another site frames this page to trick clicks (clickjacking)',
          likelihood: 2,
          impact: 1,
          controls: [],
          gap: 'No control is possible here: GitHub Pages can\'t set headers, and browsers ignore frame-ancestors in a meta tag. I accept this because there are no logins or sensitive actions to hijack.',
        },
        {
          stride: 'S',
          title: 'A linked page takes over this tab (reverse tabnabbing)',
          likelihood: 1,
          impact: 2,
          controls: ['noopener'],
        },
      ],
    },
    terminal: {
      name: 'Terminal intro',
      summary: 'The one place visitors can type anything they like, so all of it is treated as untrusted.',
      threats: [
        {
          stride: 'T',
          title: 'A typed payload runs as code (cross-site scripting)',
          likelihood: 1,
          impact: 3,
          controls: ['textContent', 'trustedTypes', 'eslint', 'codeql'],
        },
        {
          stride: 'E',
          title: 'Input such as __proto__ reaches something it shouldn\'t',
          likelihood: 1,
          impact: 2,
          controls: ['commandMap', 'codeql'],
        },
        {
          stride: 'S',
          title: 'A terminal link is made to point somewhere malicious',
          likelihood: 1,
          impact: 2,
          controls: ['staticLinks', 'noopener'],
        },
        {
          stride: 'D',
          title: 'Endless commands slow down the visitor\'s own tab',
          likelihood: 2,
          impact: 1,
          controls: ['outputCap'],
        },
      ],
    },
    games: {
      name: 'Mini-games',
      summary: 'They imitate risky things on purpose, so they have to stay obviously harmless.',
      threats: [
        {
          stride: 'I',
          title: 'A visitor types a real password into a game',
          likelihood: 2,
          impact: 2,
          controls: ['noRealFields', 'passwordWarning', 'noSubmit', 'noOutbound'],
          gap: 'I can\'t stop someone typing a real password into the puzzle. It would show on screen and go no further.',
        },
        {
          stride: 'S',
          title: 'The fake login or emails get mistaken for real ones',
          likelihood: 1,
          impact: 3,
          controls: ['fictionalContent', 'noRealFields'],
        },
        {
          stride: 'T',
          title: 'A crafted guess injects markup into the puzzle',
          likelihood: 1,
          impact: 2,
          controls: ['inputAllowList', 'textContent'],
        },
        {
          stride: 'R',
          title: 'Someone cheats and claims a perfect score',
          likelihood: 5,
          impact: 1,
          controls: ['localScores'],
          gap: 'Cheating is easy and I accept it. There is no leaderboard, and a score means nothing outside the visitor\'s own browser.',
        },
      ],
    },
    pages: {
      name: 'GitHub Pages hosting',
      summary: 'A third party I depend on, with no backend behind it. What I control is what gets sent there.',
      threats: [
        {
          stride: 'T',
          title: 'Unchecked changes reach the live site',
          likelihood: 2,
          impact: 4,
          controls: ['gatedDeploy', 'deployJobOnly'],
          gap: 'The gate only works if the repository\'s Pages source is set to GitHub Actions. That is a repository setting, not code, so it needs checking by hand.',
        },
        {
          stride: 'D',
          title: 'GitHub Pages has an outage',
          likelihood: 2,
          impact: 2,
          controls: [],
          gap: 'No failover. A portfolio can wait, so I accept this. A critical service couldn\'t, which is the point of DORA\'s third-party rules.',
        },
        {
          stride: 'I',
          title: 'Config or tooling gets published with the website',
          likelihood: 1,
          impact: 2,
          controls: ['allowListDeploy'],
        },
        {
          stride: 'R',
          title: 'Nobody can tell what was deployed or when',
          likelihood: 1,
          impact: 2,
          controls: ['deployEnvironment'],
        },
      ],
    },
    pipeline: {
      name: 'GitHub Actions pipeline',
      summary: 'The highest-value target here, because whatever controls the pipeline controls the live site.',
      threats: [
        {
          stride: 'T',
          title: 'A compromised action runs in the pipeline (supply chain)',
          likelihood: 2,
          impact: 5,
          controls: ['pinned', 'dependabot', 'leastPrivilege'],
          gap: 'Pinning stops a tag being moved, but a malicious update can still be merged if it isn\'t reviewed.',
        },
        {
          stride: 'T',
          title: 'A vulnerable code change gets through the checks',
          likelihood: 2,
          impact: 3,
          controls: ['codeql', 'eslint', 'htmlLint', 'gatedDeploy'],
          gap: 'Scanners miss things, and there is no second human reviewer on a one-person project.',
        },
        {
          stride: 'T',
          title: 'A lint tool or its dependency is compromised',
          likelihood: 2,
          impact: 3,
          controls: ['lockfile', 'leastPrivilege', 'noPersist'],
          gap: 'Dependabot only covers Actions, so npm updates are manual, and the lint tools currently have two moderate advisories. They run only in the pipeline, on this repository\'s files.',
        },
        {
          stride: 'I',
          title: 'A secret gets committed to the repository',
          likelihood: 1,
          impact: 3,
          controls: ['noSecrets', 'gitleaks', 'noReport'],
          gap: 'Pushes scan new commits, and the full history is scanned on the weekly run.',
        },
        {
          stride: 'E',
          title: 'A workflow job gets more access than it needs',
          likelihood: 1,
          impact: 4,
          controls: ['leastPrivilege', 'noPersist', 'deployJobOnly'],
        },
        {
          stride: 'E',
          title: 'Someone takes over my GitHub account',
          likelihood: 1,
          impact: 5,
          controls: [],
          gap: 'Nothing in this code can prevent it. It depends on my account security, which is outside the repository.',
        },
      ],
    },
  };

  function ratingBadge(rating) {
    return h('span', { className: `rating rating-${rating.toLowerCase()}`, text: rating });
  }

  // A component is rated by its worst threat.
  function componentScore(component) {
    return Math.max(...component.threats.map((threat) => threat.likelihood * threat.impact));
  }

  function initThreatModel() {
    const nodes = [...byId('tm-diagram').querySelectorAll('[data-component]')];
    const detail = byId('tm-detail');

    function renderThreat(threat) {
      const rating = riskRating(threat.likelihood * threat.impact);
      const parts = [
        h('p', { className: 'tm-threat-category', text: STRIDE[threat.stride] }),
        h('p', { className: 'tm-threat-title', text: threat.title }),
        h('p', { className: 'tm-threat-score' }, [
          ratingBadge(rating),
          `Likelihood ${threat.likelihood} × impact ${threat.impact}`,
        ]),
      ];

      if (threat.controls.length) {
        parts.push(h('ul', { className: 'tm-controls' }, threat.controls.map((id) => h('li', {}, [
          h('span', { className: 'tm-control-name', text: CONTROLS[id].name }),
          h('span', { className: 'tm-control-where', text: CONTROLS[id].where }),
        ]))));
      }
      if (threat.gap) {
        parts.push(h('p', { className: 'tm-gap' }, [
          h('strong', { text: threat.controls.length ? 'Not covered: ' : 'No control: ' }),
          threat.gap,
        ]));
      }
      return h('li', { className: 'tm-threat' }, parts);
    }

    function show(id) {
      const component = THREAT_MODEL[id];
      const score = componentScore(component);
      const categories = new Set(component.threats.map((threat) => threat.stride));

      nodes.forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.component === id)));

      const strideItems = Object.keys(STRIDE).map((letter) => {
        const active = categories.has(letter);
        return h('li', {
          className: active ? 'is-active' : '',
          text: letter,
          attrs: {
            title: STRIDE[letter],
            'aria-label': `${STRIDE[letter]}: ${active ? 'threats listed below' : 'nothing significant found'}`,
          },
        });
      });

      detail.replaceChildren(
        h('div', { className: 'tm-detail-head' }, [
          h('h3', { text: component.name }),
          ratingBadge(riskRating(score)),
        ]),
        h('p', { text: component.summary }),
        h('ul', { className: 'tm-stride', attrs: { 'aria-label': 'STRIDE categories' } }, strideItems),
        h('ul', { className: 'tm-threats' }, component.threats.map(renderThreat)),
      );
    }

    nodes.forEach((node) => {
      const component = THREAT_MODEL[node.dataset.component];
      const rating = riskRating(componentScore(component));
      node.querySelector('[data-node-rating]').append(ratingBadge(rating));
      node.addEventListener('click', () => {
        show(node.dataset.component);
        // On phones the details sit below the diagram, so bring them into view.
        detail.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
      });
    });

    show('browser');
  }

  /* 11. Risk matrix game
     Illustrative risks for a fictional bank. DORA does not set these scores.
     ======================================================================== */
  const RISKS = [
    {
      code: 'R1',
      title: 'Your main cloud provider has an outage lasting several hours',
      likelihood: 3,
      impact: 5,
      why: 'You can\'t prevent it, and when critical services sit with one provider, the impact is severe. Outages do happen, so plan your exit and failover options before you need them.',
      dora: 'DORA: ICT third-party risk (Chapter V)',
    },
    {
      code: 'R2',
      title: 'An employee enters their password on a phishing page',
      likelihood: 4,
      impact: 3,
      why: 'Across a whole workforce, this is close to expected. Multi-factor authentication and quick detection keep one stolen password from becoming a major incident.',
      dora: 'DORA: ICT risk management (Chapter II)',
    },
    {
      code: 'R3',
      title: 'A misconfigured role gives staff access they shouldn\'t have',
      likelihood: 3,
      impact: 4,
      why: 'Access drifts over time as people change roles, and excess access to sensitive systems does real damage if it is misused. Least privilege and regular access reviews bring this down.',
      dora: 'DORA: ICT risk management (Chapter II)',
    },
    {
      code: 'R4',
      title: 'An internet-facing system stays unpatched and is exploited',
      likelihood: 4,
      impact: 4,
      why: 'Attackers scan for known flaws constantly, and an exposed system can be a way into the wider network. This is why patching deadlines exist.',
      dora: 'DORA: ICT risk management (Chapter II)',
    },
    {
      code: 'R5',
      title: 'Ransomware encrypts core systems and their backups',
      likelihood: 2,
      impact: 5,
      why: 'Less likely with good controls in place, but close to the worst day a bank can have. It\'s why backups should be isolated and restores tested.',
      dora: 'DORA: ICT risk management (Chapter II) and resilience testing (Chapter IV)',
    },
    {
      code: 'R6',
      title: 'An employee loses a fully encrypted company laptop',
      likelihood: 3,
      impact: 1,
      why: 'This happens, but encryption and remote wipe mean little is exposed. It still gets logged, because not every risk needs urgent treatment, and rating it low shows the controls are working.',
      dora: 'DORA: ICT risk management (Chapter II)',
    },
  ];

  function initRiskGame() {
    const SIZE = 5;
    const tray = byId('risk-tray');
    const grid = byId('risk-grid');
    const status = byId('risk-status');
    const checkButton = byId('risk-check');
    const feedback = byId('risk-feedback');
    const results = byId('risk-results');

    const placements = new Map();
    let selected = RISKS[0];
    let checked = false;
    let dragged = null;
    let cellInFocus = null;

    const riskByCode = (code) => RISKS.find((risk) => risk.code === code);
    const describeCell = (likelihood, impact) => `likelihood ${likelihood}, impact ${impact}`;

    /* Build the risk cards. They are divs with a button role because Firefox
       won't start a drag from a real button element. */
    const cards = new Map(RISKS.map((risk) => {
      const card = h('div', {
        className: 'risk-card',
        attrs: { role: 'button', tabindex: '0', draggable: 'true', 'aria-pressed': 'false', 'data-risk': risk.code },
      }, [
        h('span', { className: 'risk-code', text: risk.code }),
        h('span', { text: risk.title }),
        h('span', { className: 'risk-place', text: 'Not placed yet' }),
      ]);
      tray.append(card);
      return [risk.code, card];
    }));

    /* Build the grid, with the highest likelihood at the top. */
    const cells = new Map();
    for (let likelihood = SIZE; likelihood >= 1; likelihood -= 1) {
      grid.append(h('span', { className: 'risk-tick', text: String(likelihood), attrs: { 'aria-hidden': 'true' } }));
      for (let impact = 1; impact <= SIZE; impact += 1) {
        const rating = riskRating(likelihood * impact);
        const level = { Low: '', Medium: 'is-mid', High: 'is-high' }[rating];
        const cell = h('button', {
          className: `risk-cell ${level}`.trim(),
          attrs: { type: 'button', tabindex: '-1', 'data-likelihood': likelihood, 'data-impact': impact },
        });
        cells.set(`${likelihood}-${impact}`, cell);
        grid.append(cell);
      }
    }
    grid.append(h('span', { attrs: { 'aria-hidden': 'true' } }));
    for (let impact = 1; impact <= SIZE; impact += 1) {
      grid.append(h('span', { className: 'risk-tick', text: String(impact), attrs: { 'aria-hidden': 'true' } }));
    }

    function setRovingCell(cell) {
      if (cellInFocus) cellInFocus.setAttribute('tabindex', '-1');
      cell.setAttribute('tabindex', '0');
      cellInFocus = cell;
    }

    /* Redraws the marks, labels and card states from the current placements. */
    function render() {
      cells.forEach((cell) => {
        const { likelihood, impact } = cell.dataset;
        const yours = RISKS.filter((risk) => {
          const placed = placements.get(risk.code);
          return placed && placed.likelihood === Number(likelihood) && placed.impact === Number(impact);
        });
        const mine = checked ? RISKS.filter((risk) => risk.likelihood === Number(likelihood) && risk.impact === Number(impact)) : [];

        cell.replaceChildren(
          ...yours.map((risk) => h('span', { className: 'risk-mark', text: risk.code })),
          ...mine.map((risk) => h('span', { className: 'risk-mark risk-mark-mine', text: `◇${risk.code}` })),
        );

        const rating = riskRating(Number(likelihood) * Number(impact)).toLowerCase();
        const contents = [
          yours.length ? `Your placement: ${yours.map((risk) => risk.code).join(', ')}.` : '',
          mine.length ? `My suggestion: ${mine.map((risk) => risk.code).join(', ')}.` : '',
        ].join(' ').trim();
        cell.setAttribute('aria-label', `${describeCell(likelihood, impact)}, ${rating}. ${contents}`.trim());
        if (checked) cell.setAttribute('aria-disabled', 'true');
        else cell.removeAttribute('aria-disabled');
      });

      cards.forEach((card, code) => {
        const placed = placements.get(code);
        card.setAttribute('aria-pressed', String(!checked && selected !== null && selected.code === code));
        card.querySelector('.risk-place').textContent = placed
          ? `Placed: ${describeCell(placed.likelihood, placed.impact)}`
          : 'Not placed yet';
        if (checked) {
          card.setAttribute('aria-disabled', 'true');
          card.setAttribute('draggable', 'false');
        } else {
          card.removeAttribute('aria-disabled');
          card.setAttribute('draggable', 'true');
        }
      });

      checkButton.disabled = checked || placements.size < RISKS.length;
    }

    function promptFor(risk) {
      status.textContent = `Now placing ${risk.code}: ${risk.title}.`;
    }

    function selectRisk(risk) {
      if (checked) return;
      selected = risk;
      promptFor(risk);
      render();
    }

    function place(risk, likelihood, impact) {
      if (checked) return;
      placements.set(risk.code, { likelihood, impact });

      // Move on to the next unplaced risk, so that placing them all is quick.
      const next = RISKS.find((item) => !placements.has(item.code)) || null;
      selected = next;
      const placedText = `${risk.code} placed at ${describeCell(likelihood, impact)}.`;
      status.textContent = next
        ? `${placedText} Now placing ${next.code}: ${next.title}.`
        : `${placedText} All six are placed. Move any of them, or compare with mine.`;
      render();

      if (!next) checkButton.focus({ preventScroll: true });
    }

    function focusGrid() {
      cellInFocus.focus({ preventScroll: true });
      grid.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
    }

    /* Cards: select by click, tap or keyboard. */
    tray.addEventListener('click', (event) => {
      const card = event.target.closest('.risk-card');
      if (!card) return;
      selectRisk(riskByCode(card.dataset.risk));
      if (!checked) grid.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
    });

    tray.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('.risk-card');
      if (!card || checked) return;
      event.preventDefault();
      selectRisk(riskByCode(card.dataset.risk));
      focusGrid();
    });

    /* Dragging with a mouse. Touch screens use tap to select, then tap to place,
       so that dragging never gets in the way of scrolling. */
    tray.addEventListener('dragstart', (event) => {
      const card = event.target.closest('.risk-card');
      if (!card || checked) {
        event.preventDefault();
        return;
      }
      dragged = riskByCode(card.dataset.risk);
      card.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', dragged.code);
      selectRisk(dragged);
    });

    tray.addEventListener('dragend', (event) => {
      const card = event.target.closest('.risk-card');
      if (card) card.classList.remove('is-dragging');
      dragged = null;
      cells.forEach((cell) => cell.classList.remove('is-over'));
    });

    grid.addEventListener('dragover', (event) => {
      const cell = event.target.closest('.risk-cell');
      if (!cell || !dragged) return;
      event.preventDefault();
      cells.forEach((item) => item.classList.toggle('is-over', item === cell));
    });

    grid.addEventListener('dragleave', (event) => {
      const cell = event.target.closest('.risk-cell');
      if (cell && !cell.contains(event.relatedTarget)) cell.classList.remove('is-over');
    });

    grid.addEventListener('drop', (event) => {
      const cell = event.target.closest('.risk-cell');
      if (!cell || !dragged) return;
      event.preventDefault();
      cell.classList.remove('is-over');
      setRovingCell(cell);
      place(dragged, Number(cell.dataset.likelihood), Number(cell.dataset.impact));
    });

    /* Grid: click, tap or Enter places the selected risk. */
    grid.addEventListener('click', (event) => {
      const cell = event.target.closest('.risk-cell');
      if (!cell || checked) return;
      setRovingCell(cell);
      if (!selected) {
        status.textContent = 'All six are placed. Select a risk to move it, or compare with mine.';
        return;
      }
      place(selected, Number(cell.dataset.likelihood), Number(cell.dataset.impact));
    });

    grid.addEventListener('focusin', (event) => {
      const cell = event.target.closest('.risk-cell');
      if (cell) setRovingCell(cell);
    });

    grid.addEventListener('keydown', (event) => {
      const cell = event.target.closest('.risk-cell');
      if (!cell) return;
      const moves = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] };
      if (!Object.hasOwn(moves, event.key)) return;
      event.preventDefault();
      const [likelihoodStep, impactStep] = moves[event.key];
      const target = cells.get(`${Number(cell.dataset.likelihood) + likelihoodStep}-${Number(cell.dataset.impact) + impactStep}`);
      if (target) target.focus();
    });

    /* Comparing with the suggested ratings */
    function verdictFor(risk, placed) {
      const yourRating = riskRating(placed.likelihood * placed.impact);
      const myRating = riskRating(risk.likelihood * risk.impact);
      if (placed.likelihood === risk.likelihood && placed.impact === risk.impact) return 'Exact match.';
      if (yourRating === myRating) return `Same ${myRating.toLowerCase()} rating, in a different square.`;

      const parts = [];
      if (placed.likelihood !== risk.likelihood) parts.push(`I'd put likelihood ${placed.likelihood > risk.likelihood ? 'lower' : 'higher'}`);
      if (placed.impact !== risk.impact) parts.push(`impact ${placed.impact > risk.impact ? 'lower' : 'higher'}`);
      return `A different rating: ${parts.join(' and ')}.`;
    }

    function showResults() {
      checked = true;
      selected = null;
      render();

      let sameRating = 0;
      let exact = 0;
      const items = RISKS.map((risk) => {
        const placed = placements.get(risk.code);
        const yourRating = riskRating(placed.likelihood * placed.impact);
        const myRating = riskRating(risk.likelihood * risk.impact);
        const matches = yourRating === myRating;
        if (matches) sameRating += 1;
        if (placed.likelihood === risk.likelihood && placed.impact === risk.impact) exact += 1;

        return h('li', { className: `risk-result ${matches ? '' : 'is-off'}`.trim() }, [
          h('p', { className: 'risk-result-name', text: `${risk.code}: ${risk.title}` }),
          h('p', { className: 'risk-result-scores' }, [
            `You: L${placed.likelihood} × I${placed.impact} `,
            ratingBadge(yourRating),
            ` Me: L${risk.likelihood} × I${risk.impact} `,
            ratingBadge(myRating),
          ]),
          h('p', { className: 'risk-result-verdict', text: verdictFor(risk, placed) }),
          h('p', { className: 'risk-result-why', text: risk.why }),
          h('p', { className: 'risk-result-dora', text: risk.dora }),
        ]);
      });

      results.replaceChildren(...items);
      byId('risk-result-title').textContent = `${sameRating} of ${RISKS.length} match my rating, ${exact} in the exact same square`;
      status.textContent = 'Comparison ready below. Press Start again to have another go.';
      feedback.hidden = false;

      const title = byId('risk-result-title');
      title.focus({ preventScroll: true });
      title.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
    }

    function reset() {
      placements.clear();
      checked = false;
      selected = RISKS[0];
      feedback.hidden = true;
      results.replaceChildren();
      setRovingCell(cells.get('3-3'));
      promptFor(selected);
      render();
    }

    checkButton.addEventListener('click', showResults);
    byId('risk-reset').addEventListener('click', reset);

    reset();
  }

  /* Start everything once the page has loaded
     ======================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initMobileMenu();
    initRiskMatrix();
    initNameEffect();
    initHeadlineTyping();
    initHeroNetwork();
    initScrollReveal();
    initActiveNavLink();
    initScrollProgress();
    initTerminal();
    initTabs();
    initVulnerabilityGame();
    initPhishingGame();
    initPasswordPuzzle();
    initThreatModel();
    initRiskGame();
  });
}());
