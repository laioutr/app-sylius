import { CartItemProductVariantLink } from '@laioutr-core/canonical-types/ecommerce';
import { defineSyliusLink } from '../../middleware/defineSylius';

export default defineSyliusLink(CartItemProductVariantLink, async ({ entityIds, context }) => {
  const results = await Promise.all(
    entityIds.map(async (id) => {
      const [cartToken, orderItemId] = String(id).split('::');
      if (!cartToken || !orderItemId) return null;

      const cart = await context.syliusClient.getCart(cartToken);
      const item = ((cart as any)?.items ?? []).find((it: any) => String(it.id) === orderItemId);
      const variantIri = (item?.variant as string | undefined) ?? '';
      const variantCode = variantIri.split('/').pop() ?? '';
      if (!variantCode) return null;
      return { sourceId: String(id), targetId: variantCode };
    })
  );
  const links = results.filter((l): l is { sourceId: string; targetId: string } => !!l);
  return { links };
});
