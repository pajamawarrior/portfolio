/* ==========================================================================
   Portfolio behaviour
   Contents:
     1. Theme (runs straight away to avoid a flash of the wrong theme)
     2. Helpers
     3. Navigation and scroll effects
     4. Hero: name effect and risk matrix
     5. Terminal
     6. Tabs
     7. Game 1: Find the Vulnerability
     8. Game 2: Phishing Spotter
     9. Game 3: Password Puzzle

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

  /* 4. Hero: name effect and risk matrix
     ======================================================================== */

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

  // Builds the 5 x 5 likelihood and impact heat map behind the terminal, shaded
  // by score (likelihood multiplied by impact), as in a real risk matrix.
  function initRiskMatrix() {
    const matrix = byId('risk-matrix');
    const SIZE = 5;

    for (let likelihood = SIZE; likelihood >= 1; likelihood -= 1) {
      for (let impact = 1; impact <= SIZE; impact += 1) {
        const score = likelihood * impact;
        let level = '';
        if (score >= 15) level = 'is-high';
        else if (score >= 6) level = 'is-mid';
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
      ['contact', { description: 'LinkedIn and GitHub', run: printContact }],
      ['traceroute', { description: 'how I got to Dublin', run: printRoute }],
      ['challenge', { description: 'jump to the security games', run: goToChallenge }],
      ['theme', { description: 'switch between dark and light', run: () => print(`Theme set to ${toggleTheme()}.`) }],
      ['clear', { description: 'clear the screen', run: () => output.replaceChildren() }],
    ]);

    const EASTER_EGGS = new Map([
      ['sudo', 'guest is not in the sudoers file. This incident will be raised at the next audit.'],
      ['whoami', 'guest: read-only access. Least privilege, as it should be.'],
      ['ls', 'about  currently  skills  experience  education  projects  challenge  contact'],
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

    function runCommand(rawInput) {
      finishBoot();
      const raw = rawInput.trim();
      print(`${PROMPT} ${raw}`, 'term-echo');
      if (!raw) return;

      history.push(raw);
      if (history.length > MAX_HISTORY) history.shift();
      historyIndex = history.length;

      const name = raw.toLowerCase().split(/\s+/)[0];
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

  /* Start everything once the page has loaded
     ======================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initMobileMenu();
    initRiskMatrix();
    initNameEffect();
    initScrollReveal();
    initActiveNavLink();
    initScrollProgress();
    initTerminal();
    initTabs();
    initVulnerabilityGame();
    initPhishingGame();
    initPasswordPuzzle();
  });
}());
