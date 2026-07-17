// Safe arithmetic evaluator for custom metric formulas.
// Tokens are whitelisted metric IDs (resolved to numbers by the caller) and
// the operators + - * / ( ). No eval / new Function — uses shunting-yard.

export type MetricResolver = (metricId: string) => number | null

const OPS: Record<string, { prec: number; right: boolean }> = {
  "+": { prec: 1, right: false },
  "-": { prec: 1, right: false },
  "*": { prec: 2, right: false },
  "/": { prec: 2, right: false },
}
const isOp = (t: string) => t in OPS

// Convert infix token list to RPN (shunting-yard), then evaluate.
export function evalCustomMetric(formula: string[], resolve: MetricResolver): number | null {
  if (!formula.length) return null
  const out: (string | number)[] = []
  const ops: string[] = []
  let expectOperand = true

  for (const token of formula) {
    if (token === "(") {
      ops.push(token)
      expectOperand = true
    } else if (token === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop()!)
      if (!ops.length) return null // mismatched
      ops.pop()
      expectOperand = false
    } else if (isOp(token)) {
      // unary minus → push 0 before it
      if (token === "-" && expectOperand) out.push(0)
      while (ops.length) {
        const top = ops[ops.length - 1]
        if (top === "(") break
        const o1 = OPS[token], o2 = OPS[top]
        if (!o2.right && o1.prec <= o2.prec) out.push(ops.pop()!)
        else if (o2.right && o1.prec < o2.prec) out.push(ops.pop()!)
        else break
      }
      ops.push(token)
      expectOperand = true
    } else {
      const v = resolve(token)
      if (v === null || !Number.isFinite(v)) return null
      out.push(v)
      expectOperand = false
    }
  }
  while (ops.length) {
    const op = ops.pop()!
    if (op === "(" || op === ")") return null // mismatched
    out.push(op)
  }

  const stack: number[] = []
  for (const t of out) {
    if (typeof t === "number") { stack.push(t); continue }
    const b = stack.pop(), a = stack.pop()
    if (a === undefined || b === undefined) return null
    let r: number
    switch (t) {
      case "+": r = a + b; break
      case "-": r = a - b; break
      case "*": r = a * b; break
      case "/": r = b === 0 ? NaN : a / b; break
      default: return null
    }
    if (!Number.isFinite(r)) return null
    stack.push(r)
  }
  return stack.length === 1 ? stack[0] : null
}
