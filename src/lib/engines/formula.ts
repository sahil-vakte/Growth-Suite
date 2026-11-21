/** Safe arithmetic expression evaluator for calculator forms (no eval).
 * Supports + - * / % ^, parentheses, numbers, field references {field_key}, and functions min, max, round, ceil, floor, abs, pmt.
 * pmt(rate, nper, pv) = loan repayment per period. */
type Tok =
  | { t: "num"; v: number }
  | { t: "op"; v: string }
  | { t: "id"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "comma" };

function tokenize(src: string, vars: Record<string, number>): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "{") {
      const j = src.indexOf("}", i);
      if (j < 0) throw new Error("Unclosed field reference");
      const key = src.slice(i + 1, j).trim();
      const v = vars[key];
      out.push({ t: "num", v: Number.isFinite(v) ? v : 0 });
      i = j + 1;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = Number(src.slice(i, j));
      if (!Number.isFinite(n)) throw new Error("Bad number");
      out.push({ t: "num", v: n });
      i = j;
      continue;
    }
    if (/[a-z_]/i.test(c)) {
      let j = i;
      while (j < src.length && /[a-z0-9_]/i.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }
    if ("+-*/%^".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    if (c === "(") {
      out.push({ t: "lp" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ t: "rp" });
      i++;
      continue;
    }
    if (c === ",") {
      out.push({ t: "comma" });
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${c}"`);
  }
  return out;
}

const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: (x, d = 0) => {
    const f = 10 ** d;
    return Math.round(x * f) / f;
  },
  pmt: (rate, nper, pv) => (rate === 0 ? pv / nper : (pv * rate) / (1 - (1 + rate) ** -nper)),
};

export function evaluateFormula(expr: string, vars: Record<string, number> = {}): number {
  const toks = tokenize(expr, vars);
  let pos = 0;
  const peek = () => toks[pos];
  const expect = (t: Tok["t"]) => {
    if (toks[pos]?.t !== t) throw new Error(`Expected ${t}`);
    pos++;
  };
  function primary(): number {
    const tk = toks[pos++];
    if (!tk) throw new Error("Unexpected end");
    if (tk.t === "num") return tk.v;
    if (tk.t === "op" && tk.v === "-") return -power();
    if (tk.t === "op" && tk.v === "+") return power();
    if (tk.t === "lp") {
      const v = expr0();
      expect("rp");
      return v;
    }
    if (tk.t === "id") {
      const fn = FUNCS[tk.v];
      if (!fn) throw new Error(`Unknown function ${tk.v}`);
      expect("lp");
      const args: number[] = [];
      if (peek()?.t !== "rp") {
        args.push(expr0());
        while (peek()?.t === "comma") {
          pos++;
          args.push(expr0());
        }
      }
      expect("rp");
      return fn(...args);
    }
    throw new Error("Unexpected token");
  }
  function power(): number {
    const base = primary();
    const tk = peek();
    if (tk?.t === "op" && tk.v === "^") {
      pos++;
      return base ** power();
    }
    return base;
  }
  function term(): number {
    let v = power();
    for (;;) {
      const tk = peek();
      if (tk?.t === "op" && "*/%".includes(tk.v)) {
        pos++;
        const r = power();
        v = tk.v === "*" ? v * r : tk.v === "/" ? (r === 0 ? NaN : v / r) : v % r;
      } else return v;
    }
  }
  function expr0(): number {
    let v = term();
    for (;;) {
      const tk = peek();
      if (tk?.t === "op" && (tk.v === "+" || tk.v === "-")) {
        pos++;
        const r = term();
        v = tk.v === "+" ? v + r : v - r;
      } else return v;
    }
  }
  const result = expr0();
  if (pos !== toks.length) throw new Error("Unexpected trailing input");
  return result;
}
