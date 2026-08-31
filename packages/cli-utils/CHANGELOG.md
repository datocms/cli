# @datocms/cli-utils

## 4.2.0

### Minor Changes

- 76614b9: Move to the 6.x DatoCMS clients, and drop the `default_field_metadata` encoder.

  `@datocms/cma-client` 6.0.0 made the simple `uploads` methods speak one
  `default_field_metadata` shape whatever the environment does: they convert the
  field-keyed shape the types describe into whatever the environment accepts on
  the way out, and back again on the way in. That is exactly the problem
  `buildDefaultFieldMetadataEncoder` was added to solve in 4.1.0, so it is gone
  from `@datocms/cli-utils` — the importers now build the field-keyed shape the
  types describe and hand it to `uploads.createFromUrl`, and the assertions read
  `default_field_metadata` back the same way.

  One consequence worth naming: the encoder asked the project which shape it
  spoke, once per import, with an extra `site.find()`. The client asks the same
  question, memoized per client and only when metadata is actually written, so
  the call has not moved so much as it has stopped being the importer's business.

  Anyone who imported `buildDefaultFieldMetadataEncoder` from `@datocms/cli-utils`
  directly should delete the call and pass the field-keyed shape straight through.

## 4.1.0

### Minor Changes

- 7ab4723: Fix asset imports failing with `422 INVALID_FORMAT` on every upload.

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
