#!/usr/bin/env python3
"""Report stock Kerbin-surface route calculations against stock map sums.

The site calculator is JavaScript, so this validator intentionally executes the
same calculator files rather than keeping a second Python formula copy.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STOCK_PACK_PATH = ROOT / "data" / "stock.json"
ORIGIN_BODY_ID = "kerbin"
SURFACE_NODE_KEY = "land"


def run_site_calculator() -> list[dict]:
    """Inputs: stock pack JSON and site calculator files. Outputs: route report rows from the JS calculator."""
    js = r"""
const fs = require('fs');
const vm = require('vm');

const calculatorFiles = [
  'src/calc/segment-types.js',
  'src/calc/physics.js',
  'src/calc/route-builder.js',
  'src/calc/assemble.js',
  'src/calc/branches/local.js',
  'src/calc/branches/transfer.js',
  'src/calc/index.js',
  'src/calculator.js',
];

for (const file of calculatorFiles) {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}

const pack = JSON.parse(fs.readFileSync('data/stock.json', 'utf8'));
const bodies = Object.fromEntries(pack.bodies.map((body) => [body.id, body]));
const meta = pack.meta;
const origin = { body: 'kerbin', node: 'land' };
const options = {
  ipsBranchDV: 1000,
  roundTrip: false,
  returnOnly: false,
  aeroLowOrbitDest: false,
  aeroInterceptDest: false,
  aeroLowOrbitOrigin: false,
  aeroInterceptOrigin: false,
  redundancyMultiplier: 1,
};

function configuredDv(primaryValue, fallbackValue) {
  const primary = Number(primaryValue);
  if (primaryValue != null && Number.isFinite(primary)) return primary;

  const fallback = Number(fallbackValue);
  return Number.isFinite(fallback) ? fallback : 0;
}

function entry(label, dv, source) {
  return {
    label,
    dv: Number.isFinite(Number(dv)) ? Number(dv) : 0,
    source,
  };
}

function expectedEntriesForSegment(debugSegment) {
  const segment = debugSegment.segment;
  const branchType = debugSegment.branchType;
  const body = bodies[segment.bodyId];
  if (!body) return [entry('Transfer', 0, 'missing body')];

  if (branchType === 'surface_to_orbit') {
    return [entry(
      DeltaVCalc.formatEntryLabel(body, 'orbit'),
      configuredDv(body.surface?.dvToOrbit, body.nodes?.orbit),
      body.surface?.dvToOrbit == null ? 'body.nodes.orbit' : 'body.surface.dvToOrbit',
    )];
  }

  if (branchType === 'orbit_to_surface') {
    return [entry(
      DeltaVCalc.formatEntryLabel(body, 'land'),
      configuredDv(body.surface?.dvToLand, body.nodes?.land),
      body.surface?.dvToLand == null ? 'body.nodes.land' : 'body.surface.dvToLand',
    )];
  }

  if (branchType === 'orbit_to_escape') {
    return [entry(
      DeltaVCalc.formatEntryLabel(body, 'escape'),
      Number(body.nodes?.orbit) || 0,
      'body.nodes.orbit',
    )];
  }

  if (branchType === 'escape_to_intercept' || branchType === 'moon_host_escape') {
    const nodeKey = segment.primaryNodeKey || segment.nodeKey;
    return [entry(
      DeltaVCalc.formatEntryLabel(body, nodeKey),
      Number(body.nodes?.[nodeKey]) || 0,
      `body.nodes.${nodeKey}`,
    )];
  }

  if (branchType === 'flyby_to_capture') {
    return [entry(
      DeltaVCalc.formatEntryLabel(body, 'orbit'),
      Number(body.nodes?.orbit) || 0,
      'body.nodes.orbit',
    )];
  }

  if (branchType === 'central_body_transfer') {
    return [entry(
      DeltaVCalc.formatEntryLabel(body, segment.nodeKey),
      Number(body.nodes?.[segment.nodeKey]) || 0,
      `body.nodes.${segment.nodeKey}`,
    )];
  }

  if (branchType === 'direct_moon_transfer' || branchType === 'direct_orbital_transfer') {
    const originMoon = bodies[segment.originBodyId || segment.from.bodyId];
    const targetMoon = bodies[segment.targetBodyId || segment.to.bodyId];
    const targetNode = segment.primaryNodeKey || 'intercept';
    return [
      entry(DeltaVCalc.formatEntryLabel(originMoon, 'escape'), Number(originMoon?.nodes?.orbit) || 0, 'originMoon.nodes.orbit'),
      entry(DeltaVCalc.formatEntryLabel(targetMoon, targetNode), Number(targetMoon?.nodes?.[targetNode]) || 0, `targetMoon.nodes.${targetNode}`),
      entry(DeltaVCalc.formatEntryLabel(targetMoon, 'orbit'), Number(targetMoon?.nodes?.orbit) || 0, 'targetMoon.nodes.orbit'),
    ];
  }

  return [entry(
    DeltaVCalc.formatEntryLabel(body, segment.to.nodeKey),
    Number(body.nodes?.[segment.to.nodeKey]) || 0,
    `body.nodes.${segment.to.nodeKey}`,
  )];
}

function expectedBreakdown(debugSegments) {
  return debugSegments.flatMap(expectedEntriesForSegment);
}

function routeRows() {
  return pack.bodies
    .filter((body) => (
      body.id !== meta.centralBody
      && body.id !== origin.body
      && Object.prototype.hasOwnProperty.call(body.nodes || {}, 'land')
    ))
    .map((target) => {
      const pointB = { body: target.id, node: 'land' };
      const result = jscalculate(origin, pointB, options, bodies, meta);
      const debugSegments = result.debug?.route?.segments || [];
      const expected = expectedBreakdown(debugSegments);
      const expectedTotal = expected.reduce((sum, item) => sum + item.dv, 0);

      return {
        bodyId: target.id,
        label: target.label,
        actualTotal: result.totalDV,
        actualBreakdown: result.breakdown.map((item) => ({
          label: item.label,
          dv: item.dv,
          rawDv: item.rawDv,
          type: item.type,
        })),
        expectedTotal,
        expectedBreakdown: expected,
        difference: result.totalDV - expectedTotal,
      };
    });
}

console.log(JSON.stringify(routeRows(), null, 2));
"""
    result = subprocess.run(
        ["node", "-e", js],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def format_dv(value: float) -> str:
    """Inputs: numeric delta-v. Outputs: display string rounded to one decimal where needed."""
    rounded = round(float(value), 1)
    if abs(rounded - round(rounded)) < 0.05:
        return f"{round(rounded):,} m/s"
    return f"{rounded:,.1f} m/s"


def print_actual_breakdowns(rows: list[dict]) -> None:
    """Inputs: route report rows. Outputs: prints per-target live calculator breakdowns."""
    print("Site calculation breakdowns")
    print("===========================")
    print(f"Origin: Kerbin Surface")
    print(f"Data:   {STOCK_PACK_PATH.relative_to(ROOT)}")
    print()

    for row in rows:
        print(f"{row['label']} Surface")
        print("-" * (len(row["label"]) + len(" Surface")))
        for item in row["actualBreakdown"]:
            print(f"  {item['label']:<24} {format_dv(item['dv']):>12}")
        print(f"  {'Total':<24} {format_dv(row['actualTotal']):>12}")
        print()


def print_expected_comparison(rows: list[dict]) -> None:
    """Inputs: route report rows. Outputs: prints expected stock map totals and differences."""
    print("Expected stock map sums")
    print("=======================")
    print(f"{'Target':<12} {'Calculated':>14} {'Expected':>14} {'Difference':>14}")
    print("-" * 58)

    for row in rows:
        print(
            f"{row['label']:<12} "
            f"{format_dv(row['actualTotal']):>14} "
            f"{format_dv(row['expectedTotal']):>14} "
            f"{format_dv(row['difference']):>14}"
        )


def print_expected_breakdowns(rows: list[dict]) -> None:
    """Inputs: route report rows. Outputs: prints the stock JSON entries used for expected sums."""
    print()
    print("Expected sum components")
    print("=======================")

    for row in rows:
        print(f"{row['label']} Surface expected")
        print("-" * (len(row["label"]) + len(" Surface expected")))
        for item in row["expectedBreakdown"]:
            print(f"  {item['label']:<24} {format_dv(item['dv']):>12}  ({item['source']})")
        print(f"  {'Expected total':<24} {format_dv(row['expectedTotal']):>12}")
        print()


def main() -> None:
    """Inputs: none. Outputs: prints stock route calculation validation report."""
    rows = run_site_calculator()
    print_actual_breakdowns(rows)
    print_expected_comparison(rows)
    print_expected_breakdowns(rows)


if __name__ == "__main__":
    main()
