# Minecraft Enchantment Order Calculator

A browser-based calculator for finding the least-expensive order for combining Minecraft items and enchanted books in an anvil. It supports both **Bedrock Edition** and **Java Edition** rules and runs entirely in the browser.

The search uses precomputed binary-tree structures to avoid evaluating every possible anvil tree. Advanced searches run in a Web Worker so the page remains responsive.

## Features

- Bedrock and Java rules, with Bedrock selected by default
- A fast mode for one clean item plus individual enchanted books
- An advanced mode for combining existing enchanted items and books
- Prior work penalties and optional output conditions
- Identical-book quantities for cases such as combining four level-I books into level III
- Optional legacy God Armor and Infinity/Mending combinations
- Step-by-step results with enchantment and prior-work cost breakdowns
- Result PNG downloads that can be dropped back onto the page to restore a workspace
- Local workspace persistence
- Responsive, keyboard-accessible UI with no framework or server dependency

## Development

This project uses [Bun](https://bun.sh/) and Vite.

```sh
bun install
bun run dev
```

Useful commands:

```sh
bun run build          # Type-check and create the production build in dist/
bun run preview        # Preview the production build
bun run typecheck      # Run TypeScript without emitting files
bun run test           # Run the Vitest suite
bun run format         # Format maintained files with Prettier
bun run format:check   # Verify formatting without writing files
```

The `dist/` directory is ordinary static output and can be deployed to Vercel, Cloudflare Pages, GitHub Pages with a custom domain, or any other static host. The Vite base is `/`, so the production site is expected to be served from a domain root.

## Project structure

```text
src/
  app/          State, validation, search orchestration, results, and PNG persistence
  calculator/   Pure edition rules, tree evaluation, optimization, and Web Worker
  data/         The editable catalog and generated precomputed search trees
  styles/       Base, component, and responsive styles
  ui/           Plain-DOM editor and page rendering
tests/          Calculator, catalog, persistence, state, and UI regression tests
```

The executable code is intentionally split by responsibility. The two large search-tree JSON files are generated static data, not application logic.

## Adding items and enchantments

All ordinary item and enchantment updates happen in [`src/data/catalog.json`](src/data/catalog.json). There is no second copy to paste into a JavaScript file.

An enchantment entry has this shape:

```json
{
  "id": 40,
  "key": "wind_burst",
  "label": "Wind Burst",
  "maxLevel": 3,
  "costs": {
    "item": 4,
    "book": 2
  },
  "conflicts": [],
  "editions": ["java", "bedrock"]
}
```

An item entry lists the IDs it accepts:

```json
{
  "key": "mace",
  "label": "Mace",
  "category": "weapon",
  "enchantments": [10, 11, 13, 17, 26, 28, 38, 39, 40],
  "editions": ["java", "bedrock"]
}
```

When updating the catalog:

1. Give every item and enchantment a unique key, and every enchantment a unique numeric ID.
2. Add conflicts in both directions. If enchantment A conflicts with B, both entries must list the other ID.
3. Add the enchantment ID to each applicable item's `enchantments` array.
4. Assign each item an `armor`, `weapon`, `tool`, `utility`, or `book` category. Selectors display categories in that order and sort items alphabetically within them.
5. Use `"editions": ["java"]`, `["bedrock"]`, or both to control availability.
6. Run `bun run test`. Catalog tests catch duplicate identifiers, broken references, asymmetric conflicts, invalid costs/levels, and missing edition support.

Adding Minecraft content does not require regenerating the search-tree data. Those tables describe generic anvil tree shapes and depend only on input count and prior-work handling.

## Saved workspace compatibility

Current workspaces use a versioned payload containing the edition, mode, options, inputs, and output. The loader also accepts the original project's unversioned localStorage and PNG payloads. Because legacy payloads did not record an edition, they load as Bedrock by default and can then be switched in the UI.

## How the search works

An anvil sequence can be represented as a full binary tree:

- Leaves are the input item and books.
- Intermediate nodes are anvil operations.
- The root is the final item.

The right-side input contributes its enchantment cost at each operation, while the tree depth determines accumulated prior-work penalties. The project keeps precomputed candidate trees grouped by prior-work cost, then searches their valid input orderings for the lowest combined cost. Searches involving prior-work inputs use a separate reduced candidate table.

The calculator engine is pure TypeScript. Edition-specific differences are passed explicitly into every calculation rather than being stored in a global flag. Advanced searches use the same engine inside a typed Web Worker.

## Credits

This repository is a modernization of the original [Minecraft Enchantment Order Calculator](https://github.com/kkchengaf/Minecraft-Enchantment-Order-Calculator), including its search approach and precomputed tree data.

## License

Original modifications and additions made for this fork are available under the [MIT License](LICENSE). The license does not cover code, data, or other material inherited from the original repository, which did not include a license.
