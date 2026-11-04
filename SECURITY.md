# Security Policy

This is the personal portfolio site of [Your Name]. It is a static site with no backend, accounts, cookies or stored visitor data, but security reports are still welcome.

## Reporting a vulnerability

Please report privately, not in a public issue:

- **Preferred:** [open a private security advisory](../../security/advisories/new) on this repository.
- **Alternative:** email [your-security-contact@example.com].

Please include:

- what the problem is and where it is (URL, file or line)
- steps to reproduce it
- what an attacker could do with it

This is a personal project, so responses are on a best-effort basis and there is no bug bounty.

## Scope

**In scope**

- The live site and the code in this repository
- Script injection, or any way to get past the Content Security Policy
- Anything that could affect a visitor's browser
- Weaknesses in the deployment pipeline, including its GitHub Actions workflows
- Secrets committed to the repository, including in its history

**Out of scope**

- **The Security Challenge content.** The fake login page, phishing emails and weak passwords are simulated on purpose. None of the people, companies or domains in them are real.
- GitHub's own infrastructure. Please report those issues to [GitHub](https://bounty.github.com/).
- Missing HTTP response headers, which GitHub Pages doesn't let this site set. See [Known limitations](#known-limitations).
- Denial of service, automated scanning at high volume, and social engineering. Please don't attempt these.

## Supported versions

Only the current version on the `main` branch, which is what the live site runs, gets fixes.

## How the site is protected

**In the browser**

- A strict Content Security Policy allows scripts, styles and images from this site only, and blocks inline scripts.
- Trusted Types makes `innerHTML` and similar string-to-HTML assignments throw an error in browsers that support it.
- Visitor input is written to the page with `textContent` only, and the password puzzle also limits its input to letters and digits.
- There is no third-party code, and only the theme preference is stored, in the visitor's own browser.

**Before anything is published**

Every change goes through CodeQL, Gitleaks and security-focused linting, and any failure stops the deployment. See [Security pipeline](README.md#security-pipeline) for details.

## Known limitations

These risks are accepted for a static site with no logins or sensitive actions:

- **Clickjacking:** GitHub Pages can't set custom response headers, and browsers ignore `frame-ancestors` in a meta tag, so other sites could display this page in a frame.
- **Trusted Types support varies:** browsers without it don't get that extra protection. They still have the rest of the policy, and the code doesn't use these assignments anyway.
- **Lint tool advisories:** the lint tools may have open advisories from time to time. They run only in the pipeline, on this repository's own files, and are never sent to visitors.
