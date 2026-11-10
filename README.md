# Output depends on module load order for a module with no exports syntax

Rolldown 1.3.1 (latest at the time of writing).

## Steps

```sh
npm install
npm run repro
```

## Result

```
no delay:            1d2b3216babd  dual/index.js wrapped as CommonJS (__commonJSMin)
cjs-user.cjs delayed: d5a8f297e328  dual/index.js wrapped as ESM (__esmMin)
BUG: output depends on module load order
```

## Expected

The two builds are the same. The only difference between them is a 50 ms delay
in a `load` hook. The delay changes only when a module finishes loading.

## Input

`dual` is a dual package with the same shape as `safe-stable-stringify@3.0.0`:

- `index.js` has no `import`, `export`, `require`, `module` or `exports`. It
  sets a value on `globalThis` as a side effect.
- `wrapper.cjs` (the `require` condition) does `require('./index.js')`.
- `esm/wrapper.mjs` (the `import` condition) does `import '../index.js'`.

`src/entry.mjs` imports `src/esm-user.mjs` (which does `import 'dual'`) and
`src/cjs-user.cjs` (which does `require('dual')`). Thus `dual/index.js` has one
ESM importer and one CommonJS importer.

## Cause (we think)

`determine_module_exports_kind.rs` gives a module with `ExportsKind::None` the
kind of its first importer: an `import` makes it ESM, a `require` makes it
CommonJS. "First" follows module index order, and module index order follows
the order in which parallel load tasks complete. Thus the kind, and the bundle,
can change from one build to the next.

The delay in the repro makes the order fixed so that the result is easy to see.
Without the delay, we see the same two outputs at random in a real project
(7 of 10 builds gave one output, 3 of 10 gave the other).

Both outputs run correctly. The problem is that the build is not reproducible.

## Related

- https://github.com/rolldown/rolldown/issues/10909 (closed as not planned)
- https://github.com/rolldown/rolldown/pull/10910 ("symptom B" is this problem; not merged)
- https://github.com/rolldown/rolldown/pull/10918 (not merged)

## Possible fixes

- Choose the kind for an `ExportsKind::None` module from a stable order, for
  example the sorted module ids or the importer's stable index, not from load
  completion order.
- Or always use one kind (for example CommonJS) when a module has importers of
  both kinds.
