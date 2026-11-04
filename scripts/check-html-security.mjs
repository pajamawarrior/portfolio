// Security checks on index.html that general HTML linters don't cover.
// The main job is to stop the Content Security Policy being weakened or removed
// by accident. If a change really needs a looser policy, change this file in the
// same commit, so that the decision is visible in review.
import { readFileSync } from 'node:fs';

const REQUIRED_DIRECTIVES = {
  'default-src': "'none'",
  'script-src': "'self'",
  'style-src': "'self'",
  'img-src': "'self'",
  'font-src': "'self'",
  'base-uri': "'none'",
  'form-action': "'none'",
  'require-trusted-types-for': "'script'",
};

// Allowed nowhere in the policy: unsafe keywords, wildcards, and other origins.
const FORBIDDEN_SOURCE = /'unsafe-[a-z-]+'|(^|\s)\*(\s|$)|https?:|data:|blob:/;

// Reads comments and tags together, left to right, as a browser does. Stripping
// comments first would be weaker: text can be built so that removing one comment
// creates another, which could hide a real tag from these checks.
const html = readFileSync('index.html', 'utf8');
const tags = [...html.matchAll(/<!--[\s\S]*?-->|<[a-z][^>]*>/gi)]
  .map((match) => match[0])
  .filter((token) => !token.startsWith('<!--'));
const problems = [];

const cspPattern = /http-equiv\s*=\s*"Content-Security-Policy"/i;
const cspIndex = tags.findIndex((tag) => cspPattern.test(tag));
const cspCount = tags.filter((tag) => cspPattern.test(tag)).length;

if (cspCount !== 1) {
  problems.push(`Expected exactly 1 Content Security Policy meta tag, found ${cspCount}.`);
} else {
  // The policy doesn't cover anything loaded before it.
  const firstLoader = tags.findIndex((tag) => /^<(script|link|style)\b/i.test(tag));
  if (firstLoader !== -1 && firstLoader < cspIndex) {
    problems.push('The Content Security Policy must come before any script, link or style tag.');
  }

  const policy = tags[cspIndex].match(/content\s*=\s*"([^"]*)"/i)?.[1] ?? '';
  const directives = new Map(
    policy.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const [name, ...sources] = part.split(/\s+/);
      return [name.toLowerCase(), sources.join(' ')];
    }),
  );

  for (const [name, expected] of Object.entries(REQUIRED_DIRECTIVES)) {
    if (directives.get(name) !== expected) {
      problems.push(`CSP directive "${name}" must be exactly ${expected}, found "${directives.get(name) ?? 'nothing'}".`);
    }
  }

  for (const [name, sources] of directives) {
    if (FORBIDDEN_SOURCE.test(sources)) {
      problems.push(`CSP directive "${name}" contains a forbidden source: "${sources}".`);
    }
  }
}

for (const tag of tags) {
  // The CSP would block these at runtime, but it's better to find out here.
  if (/^<script\b/i.test(tag) && !/\ssrc\s*=/i.test(tag)) {
    problems.push(`Inline script found: ${tag}`);
  }
  if (/^<(script|link|img)\b/i.test(tag)) {
    const url = tag.match(/\s(?:src|href)\s*=\s*"([^"]*)"/i)?.[1] ?? '';
    if (/^https?:|^\/\//i.test(url)) {
      problems.push(`Third-party resource found: ${tag}`);
    }
  }
  if (/^<base\b/i.test(tag)) {
    problems.push(`A <base> tag can redirect every relative link: ${tag}`);
  }
  // A new tab opened without this can navigate the page that opened it.
  if (/\starget\s*=\s*"_blank"/i.test(tag) && !/\srel\s*=\s*"[^"]*\bnoopener\b[^"]*"/i.test(tag)) {
    problems.push(`target="_blank" without rel="noopener": ${tag}`);
  }
}

if (problems.length > 0) {
  console.error(`index.html failed ${problems.length} security check(s):`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log('index.html passed the security checks.');
