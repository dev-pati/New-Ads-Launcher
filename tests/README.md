# Tests

Run them:

```bash
npm test
```

That is `node --import tsx --test "tests/*.test.mjs" "tests/*.test.ts"`. The `tsx`
loader is there for two reasons: it strips TypeScript, and it resolves the `@/`
path alias from `tsconfig.json`, which bare Node cannot do. Roughly 20 modules
under `lib/` import via `@/`, so without the loader they are untestable.

Current state: **238 tests, 238 passing, 38 suites.**

## The thing to know before you write a test here

Most of the existing tests do not run the code. They read the source file as a
string and assert regexes against it:

```js
const page = read("app/(dashboard)/launch/page.tsx")
assert.match(page, /setInterval\(loadStatus, 5000\)/)
```

**21 of the 27 test files work this way**, and each now carries a
`// refactor-fragile:` header saying so. Seven are pinned to
`app/(dashboard)/launch/page.tsx` and eleven to
`app/(dashboard)/ads-manager/page.tsx` — by file path, and in twelve files by
byte offset into the file:

```js
const resultModal = page.slice(
  page.indexOf("function LaunchResultModal"),
  page.indexOf("function LaunchHistory")
)
```

This has a consequence worth stating plainly: **the test suite currently opposes
refactoring.** A source-text test cannot tell a behaviour change from a rename,
so it fails on both. Every failure is a false alarm you still have to read,
diagnose, and hand-edit. That cost is charged per refactor, and it is why the
codebase is hard to move.

Three real examples, all from this repo:

- The 1 Aug extraction of `AdSetFormFields` from `AdSetLevel` moved markup
  between two files and broke two tests. Behaviour was unchanged. The tests
  stayed red until they were repointed by hand.
- One of those tests asserted `/Attribution setting/` while the file said
  "Attribution **S**etting" — the test was asserting display casing.
- Renaming a click handler from `useTemplate` to `applyTemplate` (a lint fix; the
  `use` prefix made React Compiler treat it as a hook) broke
  `ui-truthfulness-contract.test.mjs`, which had pinned the handler's name.

## The rule

**Assert the contract, not the characters.**

- Prefer importing the real module and calling it. `lib/` is importable — the
  `tsx` loader makes `@/` work. Six test files already do this, and they are the
  six without a `refactor-fragile` header.
- If you must read source text, assert the thing that would still be true after a
  rename, a move, or a reformat. Assert the guard, not the identifier calling it.
  Assert that a route reads `after`, not the exact expression that reads it.
- Never assert on display casing, whitespace, or byte offsets into a file.
- Never `slice()` a file between two function names.

If a test breaks and the behaviour did not change, the test was wrong. Fix the
test, and make the replacement assert something a refactor cannot break.

## Recorded lint debt

`npx eslint . --quiet` is a blocking gate and currently reports **zero errors**.
Two categories of real finding are recorded as warnings rather than fixed, both
listed with reasons in `eslint.config.mjs`:

1. **Codebase-wide, downgraded to warnings** — `no-explicit-any` (1443),
   `react/no-unescaped-entities` (66), `react-hooks/set-state-in-effect` (53).
   The warning count is the tracker; it should go down.

2. **Twelve React Compiler correctness violations**, scoped down to warnings in
   the seven files that already violate them. The rules stay errors everywhere
   else, so a new violation in any other file still fails CI. That list may only
   shrink — do not add a file to it to make a build pass. Four of the twelve are
   in `launch/page.tsx` and belong to TD-07.

## Gates

Three checks, all green, enforced in two places:

| Check | Command |
|---|---|
| Types | `npm run typecheck` |
| Lint | `npx eslint . --quiet` |
| Tests | `npm test` |

- **`.github/workflows/ci.yml`** runs them on every pull request.
- **`.githooks/pre-push`** runs them before a push leaves your machine.

Enable the local hook once per clone:

```bash
git config core.hooksPath .githooks
```

The local hook is not redundant with CI. Pushing to main triggers the Mac mini
Docker deploy, so a CI run on push-to-main reports after production has already
changed. On main, the pre-push hook is the last check that can still stop a bad
deploy.
