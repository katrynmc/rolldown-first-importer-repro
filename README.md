# Output depends on module load order for a module with no exports syntax

Rolldown 1.3.1 (latest at the time of writing).

## Steps

```sh
npm install
npm run repro
```

## Result

```
ESM importer delayed        1d2b3216babd  dual/index.js as CommonJS (__commonJSMin) runs: 42 42
CommonJS importer delayed   d5a8f297e328  dual/index.js as ESM (__esmMin)           runs: 42 42
no delay (for information)  1d2b3216babd  dual/index.js as CommonJS (__commonJSMin) runs: 42 42
BUG: output depends on module load order
Every bundle prints "42 42".
```

The script exits with code 1 when the two forced orders give different
bundles. It also runs each bundle and checks that it prints `42 42`.

## Expected

The two forced builds are the same. The only difference between them is which
importer gets a 50 ms delay in a `load` hook.

## Why this is not the same as #10909

#10909 was closed because a plugin discarded resolution metadata. This
reproduction has no custom resolver. Its only plugin is a `load` hook that
waits and then returns `null`. It does not change source code, module ids or
resolution results. It changes only the order in which modules finish loading.

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

The delays force each of the two orders, so the result does not depend on the
speed of the machine. Without a delay, we see the same two outputs at random
in a real project (7 of 10 builds gave one output, 3 of 10 gave the other).

Both outputs run correctly. The problem is that the build is not reproducible.

## Related

- https://github.com/rolldown/rolldown/issues/10909 (closed as not planned; see above)
- https://github.com/rolldown/rolldown/pull/10910 ("symptom B" is this problem; not merged)
- https://github.com/rolldown/rolldown/pull/10918 (not merged)

## Possible fixes

These are only suggestions. The repro shows that the output depends on timing;
it does not require a specific fix.

- Choose the kind for an `ExportsKind::None` module from a stable order, for
  example the sorted module ids or the importer's stable index, not from load
  completion order.
- Or always use one kind (for example CommonJS) when a module has importers of
  both kinds.
