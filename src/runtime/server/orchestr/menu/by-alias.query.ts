import { MenuByAliasQuery } from '@laioutr-core/canonical-types/ecommerce';
import { codeFromTaxonIri, taxonEntityId } from '../../mappers/taxon';
import { defineSyliusQuery } from '../../middleware/defineSylius';

const MAX_MENU_DEPTH = 5;

export default defineSyliusQuery(MenuByAliasQuery, async ({ context, input }) => {
  const { syliusClient } = context;
  const root = await syliusClient.getTaxonByCode(input.alias);
  if (!root?.code) return { ids: [] };

  // BFS the taxon tree so the returned id list is parent-before-children. The
  // MenuItem resolver materializes each node and emits `childIds`/`parentId`
  // (where available); the frontend reconstructs the tree top-down.
  const ids: string[] = [taxonEntityId(root.code)];
  let frontier: string[] = (root.children ?? [])
    .map(codeFromTaxonIri)
    .filter((c): c is string => !!c);

  for (let depth = 1; depth < MAX_MENU_DEPTH && frontier.length > 0; depth++) {
    ids.push(...frontier.map(taxonEntityId));
    const taxons = await Promise.all(frontier.map((c) => syliusClient.getTaxonByCode(c)));
    frontier = taxons.flatMap((t) =>
      (t?.children ?? []).map(codeFromTaxonIri).filter((c): c is string => !!c)
    );
  }

  // Append the deepest level (codes already collected, but their grandchildren
  // are beyond MAX_MENU_DEPTH and skipped). If we exited because of the depth
  // cap rather than empty frontier, the leaves at MAX_MENU_DEPTH carry stale
  // childIds the frontend cannot resolve — acceptable for a 5-level cap that
  // exceeds typical storefront menus.
  if (frontier.length > 0) ids.push(...frontier.map(taxonEntityId));

  return { ids };
});
