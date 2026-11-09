import { describe, expect, it } from 'vitest';
import {
  autoFill, computeRuns, defaultArea, firstFreeSpot, gridFill, insideArea, isValid, moveAreaEdge, overlaps,
  panelRect, runLength, runRails, snapPanel, type Ctx, type Panel,
} from './layout';

const W = 1.134, H = 1.722, G = 0.02, PU = W + G, PV = H + G;
const area = { u0: -5, u1: 5, v0: 0, v1: 6 };
const ctx = (over: Partial<Ctx> = {}): Ctx => ({ area, obstacles: [], margin: 0, ...over });
let n = 0;
const id = () => `t${++n}`;

describe('rects', () => {
  it('panelRect is portrait, centred', () => {
    expect(panelRect({ u: 0, v: 1 })).toEqual({ u0: -W / 2, u1: W / 2, v0: 1 - H / 2, v1: 1 + H / 2 });
  });
  it('touching edges do not overlap', () => {
    expect(overlaps({ u0: 0, u1: 1, v0: 0, v1: 1 }, { u0: 1, u1: 2, v0: 0, v1: 1 })).toBe(false);
    expect(overlaps({ u0: 0, u1: 1, v0: 0, v1: 1 }, { u0: 0.9, u1: 2, v0: 0.5, v1: 1 })).toBe(true);
  });
  it('insideArea', () => {
    expect(insideArea({ u0: -5, u1: 5, v0: 0, v1: 6 }, area)).toBe(true);
    expect(insideArea({ u0: -5.1, u1: 0, v0: 0, v1: 1 }, area)).toBe(false);
  });
  it('defaultArea = slope minus 0.3 m', () => {
    expect(defaultArea(10, 5)).toEqual({ u0: -4.7, u1: 4.7, v0: 0.3, v1: 4.7 });
  });
});

describe('isValid', () => {
  const p = { u: 0, v: 2 };
  it('accepts a free spot', () => expect(isValid(p, [], ctx())).toBe(true));
  it('rejects outside area', () => expect(isValid({ u: 4.8, v: 2 }, [], ctx())).toBe(false));
  it('rejects overlap with panels, allows standard gap', () => {
    expect(isValid(p, [{ u: 1, v: 2 }], ctx())).toBe(false);
    expect(isValid(p, [{ u: PU, v: 2 }], ctx())).toBe(true);
  });
  it('rejects obstacles including margin', () => {
    const ob = { u0: W / 2 + 0.1, u1: 2, v0: 1, v1: 3 };
    expect(isValid(p, [], ctx({ obstacles: [ob] }))).toBe(true);
    expect(isValid(p, [], ctx({ obstacles: [ob], margin: 0.2 }))).toBe(false);
  });
  it('handles un-normalised obstacle rects', () => {
    expect(isValid(p, [], ctx({ obstacles: [{ u0: 1, u1: -1, v0: 3, v1: 1 }] }))).toBe(false);
  });
});

describe('snapPanel', () => {
  it('snaps to 0.05 grid', () => {
    expect(snapPanel({ u: 0.12, v: 1.03 }, [])).toEqual({ u: 0.1, v: 1.05 });
  });
  it('magnet-snaps to neighbour edge with standard gap', () => {
    const s = snapPanel({ u: PU + 0.1, v: 2.07 }, [{ u: 0, v: 2 }]);
    expect(s.u).toBeCloseTo(PU, 6);
    expect(s.v).toBeCloseTo(2, 6);
  });
  it('snaps above a neighbour', () => {
    const s = snapPanel({ u: 0.05, v: 2 + PV - 0.12 }, [{ u: 0, v: 2 }]);
    expect(s).toEqual({ u: 0, v: +(2 + PV).toFixed(6) });
  });
  it('ignores neighbours beyond threshold', () => {
    expect(snapPanel({ u: PU + 0.3, v: 2.3 }, [{ u: 0, v: 2 }], 0.05, 0.15)).toEqual({ u: 1.45, v: 2.3 });
  });
  it('snaps from further away with default threshold, and not at all when off', () => {
    expect(snapPanel({ u: PU + 0.3, v: 2.3 }, [{ u: 0, v: 2 }])).toEqual({ u: PU, v: 2 });
    expect(snapPanel({ u: PU + 0.3, v: 2.3 }, [{ u: 0, v: 2 }], 0.05, 0)).toEqual({ u: 1.45, v: 2.3 });
  });
  it('picks the nearest of two candidates', () => {
    // u=0.2 neighbour is 3 m away in v (not a neighbour row); aligns to u=0.
    expect(snapPanel({ u: 0.1, v: 2 + PV }, [{ u: 0, v: 2 }, { u: 0.2, v: 5.5 }]).u).toBe(0);
    expect(snapPanel({ u: 0.13, v: 2 }, [{ u: 0, v: 2 + PV }, { u: 0.2, v: 2 + PV }]).u).toBe(0.2);
  });
});

describe('autoFill', () => {
  it('fills rows from the eave, centred', () => {
    const ps = autoFill(ctx(), id);
    expect(new Set(ps.map((p) => p.v)).size).toBe(3); // 3*1.742-0.02 = 5.206 <= 6
    const row = ps.filter((p) => p.v === ps[0].v);
    expect(row.length).toBe(8); // (10+0.02)/1.154 = 8.68
    expect(ps[0].v).toBeCloseTo(H / 2, 6);
    expect(row[0].u + row[row.length - 1].u).toBeCloseTo(0, 6);
    expect(ps.every((p) => isValid(p, ps.filter((q) => q !== p), ctx()))).toBe(true);
  });
  it('avoids obstacles with margin and splits rows', () => {
    const c = ctx({ obstacles: [{ u0: -0.5, u1: 0.5, v0: 0, v1: 6 }], margin: 0.2 });
    const ps = autoFill(c, id);
    expect(ps.every((p) => isValid(p, ps.filter((q) => q !== p), c))).toBe(true);
    expect(ps.filter((p) => p.v === ps[0].v).length).toBe(6);
    expect(computeRuns(ps).length).toBe(6);
  });
  it('empty when area too small', () => {
    expect(autoFill(ctx({ area: { u0: 0, u1: 1, v0: 0, v1: 1 } }), id)).toEqual([]);
  });
});

describe('gridFill / firstFreeSpot', () => {
  it('gridFill centres rows x cols', () => {
    const ps = gridFill(2, 3, ctx(), id);
    expect(ps.length).toBe(6);
    expect(ps.reduce((s, p) => s + p.u, 0)).toBeCloseTo(0, 6);
    expect(ps.reduce((s, p) => s + p.v, 0) / 6).toBeCloseTo(3, 6);
  });
  it('gridFill drops panels that do not fit', () => {
    expect(gridFill(5, 20, ctx(), id).length).toBeLessThan(100);
  });
  it('firstFreeSpot finds eave-left corner, then next', () => {
    const a = firstFreeSpot([], ctx())!;
    expect(a.u).toBeCloseTo(-5 + W / 2, 6);
    expect(a.v).toBeCloseTo(H / 2, 6);
    const b = firstFreeSpot([{ id: 'x', ...a }], ctx())!;
    expect(isValid(b, [a], ctx())).toBe(true);
    expect(b.v).toBeCloseTo(a.v, 6);
  });
  it('firstFreeSpot returns null when full', () => {
    const full = autoFill(ctx({ area: { u0: 0, u1: W, v0: 0, v1: H } }), id);
    expect(firstFreeSpot(full, ctx({ area: { u0: 0, u1: W, v0: 0, v1: H } }))).toBeNull();
  });
});

describe('computeRuns', () => {
  const row = (count: number, v: number, u0 = 0, pre = 'r'): Panel[] =>
    Array.from({ length: count }, (_, i) => ({ id: `${pre}${v}-${i}`, u: u0 + i * PU, v }));
  it('empty', () => expect(computeRuns([])).toEqual([]));
  it('one contiguous row = one run, order independent', () => {
    const r = computeRuns(row(4, 1).reverse());
    expect(r.map((x) => x.panels)).toEqual([4]);
    expect(r[0].u).toBeCloseTo(1.5 * PU, 6);
    expect(r[0].length).toBeCloseTo(runLength(4), 6);
    expect(runLength(4)).toBeCloseTo(4 * W + 3 * G + 0.2, 6);
  });
  it('splits on gap and on different v', () => {
    const ps = [...row(2, 1), ...row(3, 1, 5), ...row(2, 3)];
    expect(computeRuns(ps).map((x) => x.panels)).toEqual([2, 3, 2]);
  });
  it('tolerates ±0.01 in v', () => {
    const ps = row(3, 1);
    ps[1].v = 1.008;
    expect(computeRuns(ps).map((x) => x.panels)).toEqual([3]);
    ps[1].v = 1.03;
    expect(computeRuns(ps).length).toBe(3);
  });
  it('splits runs longer than 60', () => {
    expect(computeRuns(row(130, 1)).map((x) => x.panels)).toEqual([60, 60, 10]);
  });
  it('two rails per run at ±0.4', () => {
    const rails = runRails(computeRuns(row(2, 1)));
    expect(rails.map((r) => r.v)).toEqual([0.6, 1.4]);
  });
});

describe('moveAreaEdge', () => {
  const slope = { u0: -6, u1: 6, v0: 0, v1: 7 };
  it('clamps to slope and min size', () => {
    expect(moveAreaEdge(area, 'u0', -9, slope).u0).toBe(-6);
    expect(moveAreaEdge(area, 'u1', -4.9, slope).u1).toBe(-4.5);
    expect(moveAreaEdge(area, 'v1', 3, slope).v1).toBe(3);
  });
});
