import type { ApiTypes, Client } from '@datocms/cma-client-node';

/**
 * An asset's default metadata as it is natural to author it: by locale, then by
 * field. Whether it reaches the API in this shape is `encodeDefaultFieldMetadata`'s
 * problem, not the caller's.
 */
export type DefaultFieldMetadataByLocale = {
  [localeCode: string]: {
    alt?: string | null;
    title?: string | null;
    custom_data?: { [k: string]: unknown };
  };
};

export type DefaultFieldMetadataEncoder = (
  byLocale: DefaultFieldMetadataByLocale,
) => ApiTypes.UploadCreateSchema['default_field_metadata'];

/**
 * `default_field_metadata` has two shapes on the wire, and which one a project
 * accepts is a per-project setting, not a version:
 *
 * - locale-keyed (`{ en: { alt, title } }`) — the historical shape, still the
 *   default for projects created before the [Non-localized focal
 *   points](https://www.datocms.com/product-updates/non-localized-focal-points)
 *   update;
 * - field-keyed (`{ alt: { en }, title: { en } }`) — used by projects created
 *   after it, and by any project whose owner has activated the opt-in.
 *
 * Neither is "the new format" in a way that lets you just pick one: the opt-in
 * is a one-way switch, and once it is on the legacy shape is refused on write
 * (`422 INVALID_FORMAT: "en" is not a permitted key`). Off, the field-keyed
 * shape is refused the same way. So we ask the project.
 *
 * Reading is the easier direction and does not need this: a field-keyed payload
 * always carries a single top-level `focal_point`, and a locale-keyed one never
 * can, since no locale code is the literal string `focal_point`.
 */
export async function buildDefaultFieldMetadataEncoder(
  client: Client,
): Promise<DefaultFieldMetadataEncoder> {
  const site = await client.site.find();

  // An API predating the opt-in omits the meta entirely, which the types don't
  // admit but runtime does. Anything short of an explicit `true` means the
  // project still speaks locale-keyed.
  const fieldKeyed =
    (site.meta as { non_localized_focal_points?: boolean } | undefined)
      ?.non_localized_focal_points === true;

  return (byLocale) => {
    if (!fieldKeyed) {
      return byLocale as ApiTypes.UploadCreateSchema['default_field_metadata'];
    }

    const alt: Record<string, string | null> = {};
    const title: Record<string, string | null> = {};
    const customData: Record<string, { [k: string]: unknown }> = {};

    for (const [locale, entry] of Object.entries(byLocale)) {
      alt[locale] = entry.alt ?? null;
      title[locale] = entry.title ?? null;
      customData[locale] = entry.custom_data ?? {};
    }

    return { alt, title, custom_data: customData };
  };
}
