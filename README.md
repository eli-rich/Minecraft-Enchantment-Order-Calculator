# Minecraft Enchantment Order Calculator

A browser-based calculator for finding the least-expensive order for combining Minecraft items and enchanted books in an anvil. It supports both **Bedrock Edition** and **Java Edition** rules and runs entirely in the browser.

The optimizer searches canonical multisets of items with A*. Identical books share one state entry with a quantity, and searches run in a Web Worker so the page remains responsive.

## Features

- Bedrock and Java rules, with Bedrock selected by default
- A simple mode for one clean item plus individual enchanted books
- An advanced mode for combining existing enchanted items and books
- Prior work penalties and automatically derived advanced outputs
- Identical-book quantities for cases such as combining four level-I books into level III
- Progressive item-compatibility and conflict filtering across active inputs
- Temporarily excluded inputs for quick what-if comparisons
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
  calculator/   Pure anvil rules, shortest-path optimization, result evaluation, and Web Worker
  data/         The editable item and enchantment catalog
  styles/       Base, component, and responsive styles
  ui/           Plain-DOM editor and page rendering
tests/          Calculator, catalog, persistence, state, and UI regression tests
```

The executable code is intentionally split by responsibility. Content data lives in the catalog; the optimizer does not require generated lookup tables.

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

Adding Minecraft content does not require regenerating optimizer data.

## Saved workspace compatibility

Current workspaces use a versioned payload containing the edition, mode, options, inputs, and output. The loader also accepts the original project's unversioned localStorage and PNG payloads. Because legacy payloads did not record an edition, they load as Bedrock by default and can then be switched in the UI.

## How the search works

Each search state is a multiset of the remaining items and books. A legal ordered pair represents one anvil operation: the first component is the target, the second is the sacrifice, and their result replaces both. Components are canonically identified by their item, enchantments, levels, and prior-work count, so interchangeable copies are represented by a quantity instead of separate permutations.

A\* explores these transitions in estimated total-level-cost order. Its lower bound combines unavoidable remaining prior work with relaxed per-enchantment consolidation costs. States that can no longer reach the derived levels are discarded immediately, and a fast prior-work-optimal pass supplies an incumbent for exact branch-and-bound. Because the estimate never exceeds the true remaining cost, the final result remains optimal. Backpointers reconstruct that path as a binary tree for the step-by-step result display.

The shared anvil function enforces item direction, applicability, conflicts, edition-specific enchantment costs, both prior-work penalties, result work count, and the 39-level survival limit for each operation. In advanced mode, the output item and highest reachable enchantment levels are derived from the active inputs and used as the search goal. Every active input must still be consumed into the final item; bypassed inputs are excluded from both the goal and the search.

The calculator engine is pure TypeScript. Edition-specific differences are passed explicitly into every calculation rather than being stored in a global flag. Both modes use the same engine inside a typed Web Worker. Searches accept up to 25 expanded inputs and stop with a useful error if a highly varied search exceeds the browser's state budget.

## Mechanics verification

The Java and Bedrock fixtures cover equal and unequal enchantment levels, book multipliers, conflicts, inapplicable enchantments, maximum levels, prior work, and the per-operation survival cap. The Java implementation was also checked against the official current Java server artifact (26.2 on August 14, 2026), including its anvil-menu bytecode and data-driven `anvil_cost` values. Spear and Lunge availability is checked against the official Mounts of Mayhem release notes, with Lunge's cost, maximum level, applicability, and conflicts verified from the Java artifact. Minecraft's Java 1.21 notes document the data-driven enchantment fields and book cost halving, while the edition-specific examples are cross-checked against the community anvil mechanics documentation:

- [Minecraft Java Edition 1.21 changelog](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21)
- [Minecraft: Java Edition 1.21.11 - Mounts of Mayhem](https://feedback.minecraft.net/hc/en-us/articles/41809981427213-Minecraft-Java-Edition-1-21-11-Mounts-of-Mayhem)
- [Minecraft: Bedrock Edition 1.21.130 - Mounts of Mayhem](https://feedback.minecraft.net/hc/en-us/articles/41446685014669-Minecraft-Bedrock-Edition-1-21-130-Mounts-of-Mayhem)
- [Minecraft Wiki: Anvil mechanics](https://minecraft.wiki/w/Anvil_mechanics)

No Minecraft binaries are included in this repository.

## Credits

This repository is a modernization of the original [Minecraft Enchantment Order Calculator](https://github.com/kkchengaf/Minecraft-Enchantment-Order-Calculator). The current shortest-path optimizer replaces the original precomputed-tree search.

## License

Original modifications and additions made for this fork are available under the [MIT License](LICENSE). The license does not cover code, data, or other material inherited from the original repository, which did not include a license.
