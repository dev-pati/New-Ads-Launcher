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
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw error
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try {
        return await nextResolve(candidate, context)
      } catch {
        // try the next candidate
      }
    }
    throw error
  }
}
