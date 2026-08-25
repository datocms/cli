---
'@datocms/cli-plugin-contentful': patch
'@datocms/cli-plugin-wordpress': patch
---

Fix asset imports failing with `422 INVALID_FORMAT` on every upload.

Both importers sent an asset's default metadata keyed by locale and then by
field (`{ en: { alt, title } }`). The CMA now keys it the other way round
(`{ alt: { en }, title: { en } }`) and rejects the old shape outright —
`"en" is not a permitted key` — so no asset could be imported at all.
