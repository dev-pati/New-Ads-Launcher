/**
 * "This table has not been applied yet" — the one error Tracking must never render as 0.
 *
 * It arrives under two different codes depending on who noticed. Postgres raises `42P01`
 * when the statement reaches the database; PostgREST answers `PGRST205` from its own
 * schema cache and never issues the statement at all. A check for only the first one
 * looks correct in review and then returns a 500 in production, which the client reads
 * as "unavailable for an unknown reason" instead of "run the migration".
 *
 * The message test is the backstop for wrappers that pass neither code through.
 */

export type QueryError = { code?: string; message?: string } | null | undefined

export function isMissingTable(error: QueryError): boolean {
  if (!error) return false
  if (error.code === "42P01" || error.code === "PGRST205") return true
  return /relation .* does not exist|could not find the table/i.test(error.message || "")
}
