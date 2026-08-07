/**
 * Lets `node --test` run the .mts/.ts tests against app source unchanged.
 *
 * Application modules import each other the way Next resolves them — `./summary`,
 * no extension — which Node's ESM resolver rejects. Rather than rewriting imports
 * in lib/ to suit the test runner, the runner learns the bundler's rule: retry a
 * failed relative specifier with .ts, then /index.ts.
 *
 * Usage: node --experimental-strip-types --import ./tests/register-ts.mjs --test tests/<file>
 */
export async function resolve(specifier, context, nextResolve) {
  const resolvedSpecifier = specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}`, import.meta.url).href : specifier

  try {
    return await nextResolve(resolvedSpecifier, context)
  } catch (error) {
    if (!resolvedSpecifier.startsWith(".") && !resolvedSpecifier.startsWith("file:")) throw error
    if (/\.[cm]?[jt]sx?$/.test(resolvedSpecifier)) throw error
    for (const candidate of [`${resolvedSpecifier}.ts`, `${resolvedSpecifier}/index.ts`]) {
      try {
        return await nextResolve(candidate, context)
      } catch {
        // try the next candidate
      }
    }
    throw error
  }
}
