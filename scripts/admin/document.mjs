import { parseDocument, isMap, isSeq, isScalar } from 'yaml';

const blocked = new Set(['__proto__', 'prototype', 'constructor']);
export function safePath(path) {
  if (!Array.isArray(path) || path.some(p => (typeof p !== 'string' && !Number.isInteger(p)) || blocked.has(String(p)))) throw new Error('无效字段路径');
  return path;
}
export function getAt(object, path) { return safePath(path).reduce((value, key) => value?.[key], object); }
export function equal(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
}
export function parseSource(source, file = 'page.md') {
  const front = !/\.ya?ml$/i.test(file);
  const match = front && source.match(/^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
  if (front && !match) throw new Error('页面缺少 front matter，已停止编辑以保护原文件');
  const yaml = front ? match[2] : source;
  const doc = parseDocument(yaml, { keepSourceTokens: true, uniqueKeys: true, maxAliasCount: 50 });
  if (doc.errors.length) throw new Error('原文件 YAML 解析失败：' + doc.errors[0].message);
  const data = doc.toJS({ maxAliasCount: 50 }) || {};
  return { source, file, yaml, doc, data, body: front ? source.slice(match[0].length) : '', prefix: front ? match[1] : '', suffix: front ? match[3] : '', front };
}
function assemble(p, yaml, body = p.body) { return p.front ? p.prefix + yaml + p.suffix + body : yaml; }
function lineStart(s, index) { return s.lastIndexOf('\n', index - 1) + 1; }
function setExpected(data, path, value) {
  const result = structuredClone(data); let parent = result;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (parent[key] == null) parent[key] = typeof path[i + 1] === 'number' ? [] : {};
    parent = parent[key];
  }
  parent[path.at(-1)] = value;
  return result;
}
function validate(p, yaml, expected, body = p.body) {
  const result = assemble(p, yaml, body), check = parseSource(result, p.file);
  if (!equal(check.data, expected) || check.body !== body) throw new Error('内容完整性检查未通过，已保留修改前的草稿');
  return result;
}
// Replace a single YAML node; untouched bytes (including unknown keys and Markdown) remain intact.
export function setValue(source, file, path, value) {
  safePath(path); const p = parseSource(source, file);
  if (path.length === 1 && path[0] === '$body') return value === p.body ? source : assemble(p, p.yaml, String(value));
  if (!path.length || value === undefined || !JSON.stringify(value)) throw new Error('不能保存无效内容');
  if (equal(getAt(p.data, path), value)) return source;
  let node = p.doc.getIn(path, true), actualPath = path, actualValue = value;
  if (!node) {
    // Only the first missing ancestor needs insertion; preserve its existing siblings.
    let i = 0;
    while (i < path.length && p.doc.hasIn(path.slice(0, i + 1))) i++;
    actualPath = path.slice(0, i + 1);
    actualValue = value;
    for (let j = path.length - 1; j > i; j--) actualValue = { [path[j]]: actualValue };
    const parent = actualPath.length === 1 ? p.doc.contents : p.doc.getIn(actualPath.slice(0, -1), true);
    if (!isMap(parent)) throw new Error('请先创建父级内容区块');
    if (parent.flow) {
      const parentPath = actualPath.slice(0, -1);
      if (!parentPath.length) throw new Error('暂不支持向紧凑根映射新增字段');
      const copy = { ...getAt(p.data, parentPath), [actualPath.at(-1)]: actualValue };
      return setValue(source, file, parentPath, copy);
    }
    const indent = parent.srcToken?.indent || 0;
    const end = parent.range[1];
    const before = p.yaml.slice(0, end);
    const addition = (before.endsWith('\n') ? '' : '\n') + ' '.repeat(indent) + JSON.stringify(String(actualPath.at(-1))) + ': ' + JSON.stringify(actualValue) + '\n';
    return validate(p, before + addition + p.yaml.slice(end), setExpected(p.data, path, value));
  }
  if (!node.range || (!isMap(node) && !isSeq(node) && !isScalar(node))) throw new Error('这个字段使用了共享引用，请先在 GitHub 检查');
  const [start, end] = node.range, old = p.yaml.slice(start, end);
  let replacement = JSON.stringify(value);
  if (node.srcToken?.type === 'block-scalar') {
    const comment = node.srcToken.props?.find(t => t.type === 'comment');
    if (comment) replacement += ' ' + comment.source;
  }
  if (old.endsWith('\n')) replacement += '\n';
  return validate(p, p.yaml.slice(0, start) + replacement + p.yaml.slice(end), setExpected(p.data, path, value));
}
// Move/delete complete original item slices instead of rebuilding blocks from a form schema.
export function editSequence(source, file, path, operation) {
  safePath(path); const p = parseSource(source, file), values = getAt(p.data, path) || [];
  if (!Array.isArray(values)) throw new Error('该字段不是列表');
  const expected = structuredClone(values), order = values.map((_, i) => i);
  if (operation.type === 'move') {
    const { from, to } = operation;
    if (![from, to].every(i => Number.isInteger(i) && i >= 0 && i < values.length)) throw new Error('无效排序');
    if (from === to) return source;
    expected.splice(to, 0, expected.splice(from, 1)[0]); order.splice(to, 0, order.splice(from, 1)[0]);
  } else if (operation.type === 'remove') {
    if (!Number.isInteger(operation.index) || operation.index < 0 || operation.index >= values.length) throw new Error('无效列表项');
    expected.splice(operation.index, 1); order.splice(operation.index, 1);
  } else if (operation.type === 'add') expected.push(operation.value);
  else throw new Error('未知列表操作');
  const node = p.doc.getIn(path, true);
  if (!node || node.flow || !values.length || !expected.length || node.srcToken?.type !== 'block-seq') return setValue(source, file, path, expected);
  const tokens = node.srcToken.items;
  const starts = tokens.map(t => Math.min(...t.start.map(x => x.offset), t.value?.offset ?? Infinity));
  starts[0] = lineStart(p.yaml, node.range[0]);
  for (let i = 1; i < starts.length; i++) starts[i] = lineStart(p.yaml, starts[i]);
  const end = node.range[1];
  const chunks = starts.map((s, i) => p.yaml.slice(s, starts[i + 1] ?? end));
  let replacement = order.map(i => chunks[i].replace(/\n?$/, '\n')).join('');
  if (operation.type === 'add') replacement += ' '.repeat(node.srcToken.indent) + '- ' + JSON.stringify(operation.value) + '\n';
  return validate(p, p.yaml.slice(0, starts[0]) + replacement + p.yaml.slice(end), setExpected(p.data, path, expected));
}
export function changes(before, after, file) {
  const a = parseSource(before, file), b = parseSource(after, file), result = [];
  function visit(x, y, path) {
    if (equal(x, y)) return;
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) {
      for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) visit(x[key], y[key], [...path, key]);
    } else result.push({ path, before: x, after: y });
  }
  visit(a.data, b.data, []);
  if (a.body !== b.body) result.push({ path: ['$body'], before: a.body, after: b.body });
  return result;
}
export function allowedFile(path) {
  return /^_(projects|publications|updates)\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.md$/.test(path) || /^_data\/(profile|site|home|research|teaching|portfolio|tools|fine_art|institutions|preview_media)\.yml$/.test(path);
}
