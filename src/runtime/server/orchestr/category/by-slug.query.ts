import { CategoryBySlugQuery } from '@laioutr-core/canonical-types/ecommerce';
import { taxonEntityId } from '../../mappers/taxon';
import { defineSyliusQuery } from '../../middleware/defineSylius';

export default defineSyliusQuery(CategoryBySlugQuery, async ({ context, input }) => {
  const taxon = await context.syliusClient.getTaxonBySlug(input.slug);
  if (!taxon) return { id: undefined };
  const code = (taxon as { code?: string }).code;
  if (!code) return { id: undefined };
  return { id: taxonEntityId(code) };
});
