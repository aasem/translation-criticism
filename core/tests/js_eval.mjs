// Runs the site's own code (assets/common.js) under Node for the parity tests.
// stdin: {"op": "figures"|"normalize"|"words", "input": ...}; stdout: JSON result.
globalThis.location = { search: '' };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { querySelectorAll: () => [], documentElement: { classList: { toggle() {} } } };
const c = await import(new URL('../../assets/common.js', import.meta.url));
let buf = ''; for await (const x of process.stdin) buf += x;
const { op, input } = JSON.parse(buf);
const run = {
  figures: (rs) => rs.map((r) => { const t = c.tally(r), p = c.proximity(r);
    return { figures: c.figures(r), pp100: t.pp100, score: t.score, band: t.band[0], proximity: p.score, mimicry: p.art }; }),
  normalize: (rs) => rs.map((r) => JSON.stringify(c.normalize(r), null, 2) + '\n'),
  words: (ts) => ts.map((t) => c.words(t)),
};
process.stdout.write(JSON.stringify(run[op](input)));
