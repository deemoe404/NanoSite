# Security Policy

## Supported Versions

Press is a zero-build static site runtime. Security fixes are made on `main`
and, when runtime files change, are shipped in the next system release package.

| Version | Supported |
| ------- | --------- |
| `main` | Yes |
| Latest published `press-system-v*.zip` release | Yes |
| Older system releases | No |
| Custom forks or site-specific content | No |

Press does not maintain separate long-term support branches. If a security fix
is released, users should update to the latest published system release package.

## Scope

Security reports should relate to the Press runtime, editor, theme system,
Markdown/front matter processing, release package boundary, or update flow.

Examples of in-scope issues include:

- Cross-site scripting or script injection in rendered Markdown, front matter,
  theme output, search, navigation, or editor preview behavior.
- Unsafe URL, media, or link handling that can execute code unexpectedly or
  expose user data.
- Path traversal or content-root escape issues in editor or content-loading
  workflows.
- System update package issues that allow files outside the supported runtime
  boundary to be overwritten or installed.
- Release integrity issues affecting the published `press-system-v*.zip`
  package or its documented digest.

Examples of out-of-scope issues include:

- Security problems in a browser, GitHub Pages, or a third-party hosting
  provider.
- HTML, scripts, links, or media intentionally added by a site owner to their
  own content.
- Attacks that require a maintainer or site owner to install unrelated
  untrusted software.
- Denial-of-service reports based only on very large local test content unless
  they show a realistic security impact.

## Reporting a Vulnerability

Please do not open a public GitHub issue for a suspected vulnerability.

Use GitHub's private vulnerability reporting flow:

<https://github.com/EkilyHQ/Press/security/advisories/new>

Include as much of the following as possible:

- Affected Press version, release tag, or commit SHA.
- Browser, operating system, and hosting context.
- A minimal reproduction, including Markdown, YAML, theme configuration, or URL
  inputs needed to trigger the issue.
- Expected behavior and actual behavior.
- Security impact and any conditions required for exploitation.
- Whether the issue affects the public viewer, the browser editor, the system
  update flow, or a theme module.

After a report is received, the maintainers will make a best-effort attempt to:

1. Acknowledge the report within 7 days.
2. Triage the report and confirm whether it is accepted or declined within
   14 days.
3. Coordinate a fix privately for accepted vulnerabilities.
4. Publish the fix on `main` and, when runtime files are affected, include it
   in the next system release package.
5. Credit the reporter in the advisory or release notes if they want credit.

Please avoid public disclosure until a fix is available or the maintainers have
had a reasonable coordination window. Do not test against sites you do not own,
access private data, or disrupt hosted Press sites while researching an issue.
