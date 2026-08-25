type FieldKeyed = {
  alt: Record<string, string | null>;
  title: Record<string, string | null>;
};

/**
 * An upload's `default_field_metadata`, always field-keyed.
 *
 * The API answers in whichever shape the project speaks, and these suites can
 * only ever create projects that are opted in to non-localized focal points
 * (new ones always are), so left alone they would silently stop covering the
 * other half of `buildDefaultFieldMetadataEncoder`. Normalizing here at least
 * keeps the assertions true against both.
 *
 * The detection is self-describing rather than a flag lookup: a field-keyed
 * payload always carries a single top-level `focal_point`, and a locale-keyed
 * one never can, since no locale code is the literal string `focal_point`.
 */
export function fieldKeyedMetadata(upload: {
  default_field_metadata: unknown;
}): FieldKeyed {
  const metadata = upload.default_field_metadata as Record<string, any>;

  if (metadata && 'focal_point' in metadata) {
    return metadata as FieldKeyed;
  }

  const alt: Record<string, string | null> = {};
  const title: Record<string, string | null> = {};

  for (const [locale, entry] of Object.entries(metadata ?? {})) {
    alt[locale] = entry.alt ?? null;
    title[locale] = entry.title ?? null;
  }

  return { alt, title };
}
