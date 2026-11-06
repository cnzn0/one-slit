# Security

This project is a static browser demo. It has no server-side application,
authentication, API credentials, telemetry, user uploads, or package installation.
The only URL input is a fragment selecting one of eight fixed views. It is never
evaluated as code or inserted as HTML.

The HTML uses a restrictive content security policy: local scripts, styles,
images and fonts only; no inline scripts, script-initiated connections, workers,
forms or embedded objects. External links use a no-referrer policy.

The repository was created from a small, explicitly selected set of source and
asset files with fresh Git history. Private workspace configuration and history
are not part of this project. Commit authorship uses a GitHub no-reply address.

These measures reduce exposure; they are not a guarantee that the project or
the browser platform is free of vulnerabilities. Report suspected issues through
the repository's private vulnerability reporting feature when available. Avoid
putting credentials or sensitive details in public issues.
