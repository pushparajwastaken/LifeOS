// Shared SQL helpers for static migration tests: comment stripping and statement splitting
// that respect quoted strings and dollar-quoted bodies.

/** Removes -- and block comments outside strings and dollar-quoted bodies. */
export function stripComments(sql) {
  let out = ''
  let i = 0
  while (i < sql.length) {
    const rest = sql.slice(i)
    const dollar = rest.match(/^\$[A-Za-z_]*\$/)
    if (dollar) {
      const tag = dollar[0]
      const end = sql.indexOf(tag, i + tag.length)
      const stop = end === -1 ? sql.length : end + tag.length
      out += sql.slice(i, stop)
      i = stop
    } else if (sql[i] === "'") {
      let j = i + 1
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1
      out += sql.slice(i, j + 1)
      i = j + 1
    } else if (rest.startsWith('--')) {
      const nl = sql.indexOf('\n', i)
      i = nl === -1 ? sql.length : nl
    } else if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2)
      i = end === -1 ? sql.length : end + 2
    } else {
      out += sql[i]
      i += 1
    }
  }
  return out
}

/** Splits on semicolons outside strings and dollar-quoted bodies. */
export function splitStatements(sql) {
  const statements = []
  let current = ''
  let i = 0
  while (i < sql.length) {
    const rest = sql.slice(i)
    const dollar = rest.match(/^\$[A-Za-z_]*\$/)
    if (dollar) {
      const tag = dollar[0]
      const end = sql.indexOf(tag, i + tag.length)
      const stop = end === -1 ? sql.length : end + tag.length
      current += sql.slice(i, stop)
      i = stop
    } else if (sql[i] === "'") {
      let j = i + 1
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1
      current += sql.slice(i, j + 1)
      i = j + 1
    } else if (sql[i] === ';') {
      if (current.trim()) statements.push(current.trim())
      current = ''
      i += 1
    } else {
      current += sql[i]
      i += 1
    }
  }
  if (current.trim()) statements.push(current.trim())
  return statements
}

export const normalize = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase()
