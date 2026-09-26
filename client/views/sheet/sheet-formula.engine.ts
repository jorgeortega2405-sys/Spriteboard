import { SheetCellData, SheetNumberFormat, SheetRange } from './sheet.types.js';

export function colIndexToLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function letterToColIndex(letters: string): number {
  const upper = letters.toUpperCase().trim();
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

export function cellKeyToCoord(key: string): { col: number; row: number } | null {
  const match = key.trim().toUpperCase().match(/^([A-Z]+)([0-9]+)$/);
  if (!match) return null;
  const col = letterToColIndex(match[1]);
  const row = parseInt(match[2], 10) - 1;
  if (isNaN(col) || isNaN(row) || col < 0 || row < 0) return null;
  return { col, row };
}

export function coordToCellKey(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`;
}

export function parseRange(rangeStr: string): SheetRange | null {
  const parts = rangeStr.trim().toUpperCase().split(':');
  if (parts.length === 1) {
    const c = cellKeyToCoord(parts[0]);
    if (!c) return null;
    return { endCol: c.col, endRow: c.row, startCol: c.col, startRow: c.row };
  }
  if (parts.length === 2) {
    const c1 = cellKeyToCoord(parts[0]);
    const c2 = cellKeyToCoord(parts[1]);
    if (!c1 || !c2) return null;
    return {
      endCol: Math.max(c1.col, c2.col),
      endRow: Math.max(c1.row, c2.row),
      startCol: Math.min(c1.col, c2.col),
      startRow: Math.min(c1.row, c2.row),
    };
  }
  return null;
}

export function formatCellValue(value: boolean | number | string | null | undefined, format?: SheetNumberFormat, decimals: number = 2): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'VERDADERO' : 'FALSO';
  if (typeof value === 'string' && value.startsWith('#')) return value;

  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return String(value);

  const dec = Math.max(0, Math.min(decimals, 10));

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('es-MX', {
        currency: 'USD',
        maximumFractionDigits: dec,
        minimumFractionDigits: dec,
        style: 'currency',
      }).format(num);
    case 'percentage':
      return `${(num * 100).toFixed(dec)}%`;
    case 'number':
      return new Intl.NumberFormat('es-MX', {
        maximumFractionDigits: dec,
        minimumFractionDigits: dec,
      }).format(num);
    case 'date':
      if (num > 10000) {
        return new Date(num).toLocaleDateString();
      }
      return String(value);
    case 'general':
    default:
      if (Number.isInteger(num)) return num.toString();
      return parseFloat(num.toFixed(dec)).toString();
  }
}

function resolveCellValue(key: string, cells: Record<string, SheetCellData>, visiting: Set<string>): any {
  const normKey = key.toUpperCase();
  if (visiting.has(normKey)) {
    return '#CIRCULAR!';
  }
  const cell = cells[normKey];
  if (!cell || !cell.raw) return 0;
  if (!cell.raw.startsWith('=')) {
    const n = Number(cell.raw);
    return isNaN(n) ? cell.raw : n;
  }
  visiting.add(normKey);
  const result = evaluateFormulaString(cell.raw.slice(1), cells, visiting);
  visiting.delete(normKey);
  return result;
}

function getRangeValues(range: SheetRange, cells: Record<string, SheetCellData>, visiting: Set<string>): any[] {
  const values: any[] = [];
  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      const k = coordToCellKey(r, c);
      const v = resolveCellValue(k, cells, visiting);
      if (typeof v === 'number' && !isNaN(v)) {
        values.push(v);
      } else if (typeof v === 'string') {
        const parsed = parseFloat(v);
        if (!isNaN(parsed) && String(parsed) === v.trim()) {
          values.push(parsed);
        } else if (v.startsWith('#')) {
          values.push(v);
        } else {
          values.push(v);
        }
      } else if (typeof v === 'boolean') {
        values.push(v);
      }
    }
  }
  return values;
}

function extractArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inQuote = false;
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
    } else if (ch === '(' && !inQuote) {
      depth++;
      current += ch;
    } else if (ch === ')' && !inQuote) {
      depth--;
      current += ch;
    } else if ((ch === ',' || ch === ';') && depth === 0 && !inQuote) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    args.push(current.trim());
  }
  return args;
}

export function evaluateFormulaString(expr: string, cells: Record<string, SheetCellData>, visiting: Set<string> = new Set()): any {
  let cleaned = expr.trim();
  if (!cleaned) return '';

  const funcMatch = cleaned.match(/^([A-Za-z_]+)\((.*)\)$/);
  if (funcMatch) {
    const fnName = funcMatch[1].toUpperCase();
    const rawArgs = extractArgs(funcMatch[2]);

    const numericValues: number[] = [];
    const allArgsValues: any[] = [];

    for (const a of rawArgs) {
      if (a.includes(':')) {
        const rng = parseRange(a);
        if (rng) {
          const list = getRangeValues(rng, cells, visiting);
          for (const item of list) {
            allArgsValues.push(item);
            if (typeof item === 'number') numericValues.push(item);
          }
          continue;
        }
      }
      const val = evaluateFormulaString(a, cells, visiting);
      allArgsValues.push(val);
      if (typeof val === 'number') numericValues.push(val);
      else if (typeof val === 'string') {
        const p = parseFloat(val);
        if (!isNaN(p)) numericValues.push(p);
      }
    }

    if (allArgsValues.some((v) => typeof v === 'string' && v.startsWith('#'))) {
      const err = allArgsValues.find((v) => typeof v === 'string' && v.startsWith('#'));
      return err || '#ERROR!';
    }

    switch (fnName) {
      case 'SUM':
      case 'SUMA':
        return numericValues.reduce((acc, curr) => acc + curr, 0);

      case 'AVERAGE':
      case 'PROMEDIO':
        return numericValues.length === 0 ? 0 : numericValues.reduce((acc, curr) => acc + curr, 0) / numericValues.length;

      case 'COUNT':
      case 'CONTAR':
        return numericValues.length;

      case 'COUNTA':
      case 'CONTARA':
        return allArgsValues.filter((v) => v !== '' && v !== null && v !== undefined).length;

      case 'MAX':
      case 'MAXIMO':
        return numericValues.length === 0 ? 0 : Math.max(...numericValues);

      case 'MIN':
      case 'MINIMO':
        return numericValues.length === 0 ? 0 : Math.min(...numericValues);

      case 'ROUND':
      case 'REDONDEAR': {
        const num = typeof allArgsValues[0] === 'number' ? allArgsValues[0] : parseFloat(String(allArgsValues[0]));
        const decimals = typeof allArgsValues[1] === 'number' ? allArgsValues[1] : parseInt(String(allArgsValues[1] || '0'), 10);
        if (isNaN(num)) return '#VALUE!';
        const factor = Math.pow(10, decimals || 0);
        return Math.round(num * factor) / factor;
      }

      case 'ABS': {
        const num = typeof allArgsValues[0] === 'number' ? allArgsValues[0] : parseFloat(String(allArgsValues[0]));
        return isNaN(num) ? '#VALUE!' : Math.abs(num);
      }

      case 'SQRT':
      case 'RAIZ': {
        const num = typeof allArgsValues[0] === 'number' ? allArgsValues[0] : parseFloat(String(allArgsValues[0]));
        return isNaN(num) || num < 0 ? '#NUM!' : Math.sqrt(num);
      }

      case 'POWER':
      case 'POTENCIA': {
        const base = typeof allArgsValues[0] === 'number' ? allArgsValues[0] : parseFloat(String(allArgsValues[0]));
        const exp = typeof allArgsValues[1] === 'number' ? allArgsValues[1] : parseFloat(String(allArgsValues[1]));
        return isNaN(base) || isNaN(exp) ? '#VALUE!' : Math.pow(base, exp);
      }

      case 'IF':
      case 'SI': {
        const condition = allArgsValues[0];
        const isTruthy = condition === true || condition === 'true' || (typeof condition === 'number' && condition !== 0);
        return isTruthy ? (allArgsValues[1] ?? '') : (allArgsValues[2] ?? '');
      }

      case 'AND':
      case 'Y':
        return allArgsValues.every((v) => Boolean(v));

      case 'OR':
      case 'O':
        return allArgsValues.some((v) => Boolean(v));

      case 'NOT':
      case 'NO':
        return !Boolean(allArgsValues[0]);

      case 'CONCAT':
      case 'CONCATENAR':
        return allArgsValues.map((v) => (v === null || v === undefined ? '' : String(v))).join('');

      case 'UPPER':
      case 'MAYUSC':
        return String(allArgsValues[0] || '').toUpperCase();

      case 'LOWER':
      case 'MINUSC':
        return String(allArgsValues[0] || '').toLowerCase();

      case 'TRIM':
      case 'ESPACIOS':
        return String(allArgsValues[0] || '').trim();

      case 'LEN':
      case 'LARGO':
        return String(allArgsValues[0] || '').length;

      case 'TODAY':
      case 'HOY': {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }

      case 'NOW':
      case 'AHORA':
        return new Date().toLocaleString();
    }
  }

  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    return cleaned.slice(1, -1);
  }

  const cellRef = cellKeyToCoord(cleaned);
  if (cellRef) {
    return resolveCellValue(cleaned, cells, visiting);
  }

  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned);
  }

  if (cleaned.toUpperCase() === 'TRUE' || cleaned.toUpperCase() === 'VERDADERO') return true;
  if (cleaned.toUpperCase() === 'FALSE' || cleaned.toUpperCase() === 'FALSO') return false;

  return evaluateArithmetic(cleaned, cells, visiting);
}

function evaluateArithmetic(expr: string, cells: Record<string, SheetCellData>, visiting: Set<string>): any {
  const tokens = tokenize(expr);
  if (tokens.length === 0) return '';
  if (tokens.length === 1) {
    const t = tokens[0];
    if (t.type === 'number') return parseFloat(t.value);
    if (t.type === 'string') return t.value;
    if (t.type === 'cell') return resolveCellValue(t.value, cells, visiting);
    return t.value;
  }

  try {
    const rpn = toRpn(tokens);
    return evalRpn(rpn, cells, visiting);
  } catch {
    return '#ERROR!';
  }
}

interface Token {
  type: 'cell' | 'lparen' | 'number' | 'op' | 'rparen' | 'string';
  value: string;
}

function tokenize(str: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '&' || ch === '<' || ch === '>' || ch === '=') {
      let op = ch;
      if (i + 1 < str.length) {
        const next = str[i + 1];
        if ((ch === '<' && (next === '=' || next === '>')) || (ch === '>' && next === '=') || (ch === '=' && next === '=')) {
          op += next;
          i++;
        }
      }
      tokens.push({ type: 'op', value: op });
      i++;
      continue;
    }
    if (ch === '"') {
      let s = '';
      i++;
      while (i < str.length && str[i] !== '"') {
        s += str[i];
        i++;
      }
      i++;
      tokens.push({ type: 'string', value: s });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < str.length && /[0-9]/.test(str[i + 1]))) {
      let num = '';
      while (i < str.length && (/[0-9.]/.test(str[i]))) {
        num += str[i];
        i++;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      let word = '';
      while (i < str.length && /[A-Za-z0-9]/.test(str[i])) {
        word += str[i];
        i++;
      }
      if (cellKeyToCoord(word)) {
        tokens.push({ type: 'cell', value: word.toUpperCase() });
      } else {
        tokens.push({ type: 'string', value: word });
      }
      continue;
    }
    i++;
  }
  return tokens;
}

const PRECEDENCE: Record<string, number> = {
  '&': 2,
  '*': 4,
  '+': 3,
  '-': 3,
  '/': 4,
  '<': 1,
  '<=': 1,
  '<>': 1,
  '=': 1,
  '==': 1,
  '>': 1,
  '>=': 1,
  '^': 5,
};

function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const ops: Token[] = [];

  for (const t of tokens) {
    if (t.type === 'number' || t.type === 'string' || t.type === 'cell') {
      output.push(t);
    } else if (t.type === 'op') {
      while (ops.length > 0) {
        const top = ops[ops.length - 1];
        if (top.type === 'op' && (PRECEDENCE[top.value] || 0) >= (PRECEDENCE[t.value] || 0)) {
          output.push(ops.pop()!);
        } else {
          break;
        }
      }
      ops.push(t);
    } else if (t.type === 'lparen') {
      ops.push(t);
    } else if (t.type === 'rparen') {
      while (ops.length > 0 && ops[ops.length - 1].type !== 'lparen') {
        output.push(ops.pop()!);
      }
      if (ops.length > 0 && ops[ops.length - 1].type === 'lparen') {
        ops.pop();
      }
    }
  }

  while (ops.length > 0) {
    output.push(ops.pop()!);
  }

  return output;
}

function evalRpn(rpn: Token[], cells: Record<string, SheetCellData>, visiting: Set<string>): any {
  const stack: any[] = [];

  for (const t of rpn) {
    if (t.type === 'number') {
      stack.push(parseFloat(t.value));
    } else if (t.type === 'string') {
      stack.push(t.value);
    } else if (t.type === 'cell') {
      stack.push(resolveCellValue(t.value, cells, visiting));
    } else if (t.type === 'op') {
      const b = stack.pop();
      const a = stack.pop();

      if (typeof a === 'string' && a.startsWith('#')) return a;
      if (typeof b === 'string' && b.startsWith('#')) return b;

      const numA = typeof a === 'number' ? a : parseFloat(String(a));
      const numB = typeof b === 'number' ? b : parseFloat(String(b));

      switch (t.value) {
        case '+':
          stack.push(isNaN(numA) || isNaN(numB) ? `${a}${b}` : numA + numB);
          break;
        case '-':
          stack.push(isNaN(numA) || isNaN(numB) ? '#VALUE!' : numA - numB);
          break;
        case '*':
          stack.push(isNaN(numA) || isNaN(numB) ? '#VALUE!' : numA * numB);
          break;
        case '/':
          if (numB === 0) return '#DIV/0!';
          stack.push(isNaN(numA) || isNaN(numB) ? '#VALUE!' : numA / numB);
          break;
        case '^':
          stack.push(isNaN(numA) || isNaN(numB) ? '#VALUE!' : Math.pow(numA, numB));
          break;
        case '&':
          stack.push(`${a ?? ''}${b ?? ''}`);
          break;
        case '=':
        case '==':
          stack.push(a == b);
          break;
        case '<>':
          stack.push(a != b);
          break;
        case '<':
          stack.push(numA < numB);
          break;
        case '<=':
          stack.push(numA <= numB);
          break;
        case '>':
          stack.push(numA > numB);
          break;
        case '>=':
          stack.push(numA >= numB);
          break;
      }
    }
  }

  return stack.length > 0 ? stack[0] : '';
}

export function evaluateAllCells(cells: Record<string, SheetCellData>): void {
  for (const [key, cell] of Object.entries(cells)) {
    if (!cell.raw) {
      cell.computed = '';
      continue;
    }
    if (cell.raw.startsWith('=')) {
      cell.type = 'formula';
      cell.computed = resolveCellValue(key, cells, new Set());
    } else {
      const num = Number(cell.raw);
      if (!isNaN(num) && cell.raw.trim() !== '') {
        cell.type = 'number';
        cell.computed = num;
      } else if (cell.raw.toUpperCase() === 'VERDADERO' || cell.raw.toUpperCase() === 'TRUE') {
        cell.type = 'boolean';
        cell.computed = true;
      } else if (cell.raw.toUpperCase() === 'FALSO' || cell.raw.toUpperCase() === 'FALSE') {
        cell.type = 'boolean';
        cell.computed = false;
      } else {
        cell.type = 'text';
        cell.computed = cell.raw;
      }
    }
  }
}
