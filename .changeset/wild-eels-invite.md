---
'@datocms/cli-plugin-contentful': patch
'@datocms/cli-plugin-wordpress': patch
'@datocms/cli-utils': minor
---

Fix asset imports failing with `422 INVALID_FORMAT` on every upload.

An asset's `default_field_metadata` has two shapes on the wire, and which one a
project accepts is a per-project setting rather than a version: projects created
before the [Non-localized focal
points](https://www.datocms.com/product-updates/non-localized-focal-points)
update take it keyed by locale (`{ en: { alt, title } }`), while newer projects —
and any project whose owner activated the one-way opt-in — take it keyed by
field (`{ alt: { en }, title: { en } }`). Each refuses the other on write.

Both importers hardcoded the locale-keyed shape, so no asset could be imported
into a project that had opted in, which today includes every newly created one.
They now ask the project, via the new `buildDefaultFieldMetadataEncoder` helper
in `@datocms/cli-utils`, and send the shape it accepts.
