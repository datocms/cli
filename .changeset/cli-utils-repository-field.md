---
'@datocms/cli-utils': patch
---

Add the `repository` field to the package manifest. It was the only package
here without one, so npm had no link back to the source, and tooling that reads
that field could not resolve the repository.
