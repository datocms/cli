# datocms

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

### Patch Changes

- Updated dependencies [76614b9]
  - @datocms/cli-utils@4.2.0
