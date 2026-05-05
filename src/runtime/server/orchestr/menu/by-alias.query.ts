import { MenuByAliasQuery } from '@laioutr-core/canonical-types/ecommerce';
import { codeFromTaxonIri, taxonEntityId } from '../../mappers/taxon';
import { defineSyliusQuery } from '../../middleware/defineSylius';

export default defineSyliusQuery(MenuByAliasQuery, async ({ context, input }) => {
  const { syliusClient } = context;
  const root = await syliusClient.getTaxonByCode(input.alias);
  if (!root) return { ids: [] };

  const childCodes = (root.children ?? [])
    .map((iri) => codeFromTaxonIri(iri))
    .filter((c): c is string => !!c);

  // Sylius returns children in tree order; the shop schema does not expose
  // `position` or `enabled` so we cannot filter or re-sort here. Children
  // come back in the order Sylius defines.
  const ids = [
    taxonEntityId(root.code ?? ''),
    ...childCodes.map(taxonEntityId),
  ];
  return { ids };
});
