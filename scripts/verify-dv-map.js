#!/usr/bin/env node
/**
 * Delta-V map verification report.
 *
 * Runs the real site calculator (the unmodified files under src/calc/ and
 * src/calculator.js, read fresh off disk every run) from a chosen origin
 * point to the surface of every other body in a data pack, then prints the
 * resulting delta-v breakdown in the same stage order the dropdown shows
 * (orbit, escape, intercept, orbit, surface, ...).
 *
 * Each stage is compared against that body's own `nodes.{land,orbit,
 * intercept}` fields in the same pack JSON. Those fields are the community
 * "standard" delta-v map numbers (verified by hand against the stock 1.1.3
 * map image bundled at assets/images/stock.png) and are NOT what most
 * branches in src/calc use to compute a route: transfer/escape/capture
 * burns are derived from orbital mechanics formulas (radius, mu, vis-viva),
 * so a mismatch between the formula output and the pack's reference node
 * value is a real signal of calculator drift, not a tautology.
 *
 * Caveat: the map image itself says "Total values do not include maximum
 * plane change dV", but each body's `nodes.intercept` field bundles that
 * maximum-plane-change margin in (confirmed by hand: e.g. Eve's
 * intercept:520 = a 430 nominal transfer + a 90 max-plane-change figure the
 * map prints separately). So per-body TOTALS are NOT the sum of that body's
 * land/orbit/intercept fields - summing them double-counts a margin the
 * map's own totals exclude. The Total row below instead uses the stock
 * map's own printed per-body total (MAP_TOTAL_DV, transcribed by hand from
 * assets/images/stock.png), falling back to the summed stages only for
 * packs without a transcribed table (see resolveMapTotal). The per-stage
 * "Intercept" reference can therefore run a little high relative to what a
 * nominal (non-worst-case) transfer should cost - read it as an upper
 * bound, not a strict target.
 *
 * This script never embeds a copy of the calculator or pack data. It reads
 * both straight from the repo on every run, so its results can't drift out
 * of sync with the live site the way a hand-copied fixture could.
 *
 * Usage:
 *   node scripts/verify-dv-map.js [--pack ksp1/stock] [--origin kerbin]
 *     [--json] [--sort percent|diff|body] [--only moho,eve,...]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// Keep in the same attach order the site loads them in (index.html), since
// later modules read functions attached to globalThis.DeltaVCalc by earlier
// ones.
const CALCULATOR_SOURCE_FILES = [
    'src/calc/segment-types.js',
    'src/calc/physics.js',
    'src/calc/route-builder.js',
    'src/calc/assemble.js',
    'src/calc/branches/local.js',
    'src/calc/branches/transfer.js',
    'src/calc/index.js',
    'src/calculator.js',
];

const DEFAULT_PACK_ID = 'ksp1/stock';

// Per-body totals as printed on the map itself (the bold number under each
// body's name), transcribed by hand from assets/images/stock.png. This is
// deliberately NOT derived by summing nodes.{land,orbit,intercept}: see the
// file header caveat on why that double-counts a plane-change margin the
// map's own totals exclude. Add a `ksp1/<pack>` entry here if the same
// transcription is done for another pack's map image.
const MAP_TOTAL_DV = {
    'ksp1/stock': {
        moho: 8390,
        eve: 13850,
        gilly: 5020,
        mun: 5150,
        minmus: 4670,
        duna: 6540,
        ike: 5330,
        dres: 6680,
        jool: 22300,
        laythe: 10390,
        vall: 7880,
        tylo: 9260,
        bop: 6830,
        pol: 6600,
        eeloo: 7480,
    },
};

/**
 * Inputs: pack id (e.g. "ksp1/stock") and body id.
 * Outputs: that body's authoritative map total, or null when this pack has
 * no transcribed table (see MAP_TOTAL_DV).
 */
function resolveMapTotal(packId, bodyId) {
    const table = MAP_TOTAL_DV[packId];
    const value = table ? table[bodyId] : undefined;
    return Number.isFinite(value) ? value : null;
}

/**
 * Inputs: none.
 * Outputs: mutates globalThis.DeltaVCalc / globalThis.jscalculate by
 * executing the real calculator source files read fresh from disk.
 */
function loadRealCalculator() {
    for (const relativePath of CALCULATOR_SOURCE_FILES) {
        const fullPath = path.join(ROOT, relativePath);
        const code = fs.readFileSync(fullPath, 'utf8');
        vm.runInThisContext(code, { filename: fullPath });
    }

    if (typeof jscalculate !== 'function') {
        throw new Error('Failed to load the real calculator from src/calc/*.js');
    }
}

/**
 * Inputs: pack id such as "ksp1/stock", or a path to a JSON file.
 * Outputs: { bodies, meta, label } loaded straight from the real data file.
 * Purpose: mirrors how src/ui.js loads `data/${dataPackId}.json`, minus the
 * rss-only normalization step (not needed for the stock pack this script
 * targets by default; pass --pack with a full path for other packs).
 */
function loadPack(packArg) {
    const isPath = packArg.endsWith('.json');
    const fullPath = isPath
        ? path.resolve(packArg)
        : path.join(ROOT, 'data', `${packArg}.json`);

    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const bodies = {};
    data.bodies.forEach((body) => { bodies[body.id] = body; });

    return { bodies, meta: data.meta, label: path.relative(ROOT, fullPath) };
}

/**
 * Inputs: none.
 * Outputs: calculation options object identical to the site's defaults
 * (src/ui.js _buildCalculationOptions with every toggle unchecked), since
 * the reference map values assume no aerobraking discounts or redundancy.
 */
function defaultCalculationOptions() {
    return {
        roundTrip: false,
        returnOnly: false,
        aeroLowOrbitDest: false,
        aeroInterceptDest: false,
        aeroLowOrbitOrigin: false,
        aeroInterceptOrigin: false,
        redundancyMultiplier: 1,
        ipsBranchDV: 1000,
    };
}

/**
 * Inputs: dv value.
 * Outputs: value rounded to the nearest 10, exactly like the site's display
 * rounding (src/dropdown.js _formatEntryDv and calc/index.js totalDV).
 */
function roundTen(value) {
    return Math.round((Number(value) || 0) / 10) * 10;
}

/**
 * Inputs: breakdown entry label (e.g. "Low Eve Orbit", "Eve Intercept") and
 * the body lookup.
 * Outputs: matching body id, or null.
 * Purpose: the display breakdown does not carry a bodyId field for each
 * entry, but every label is built deterministically by formatEntryLabel, so
 * it can be parsed back into the body it names.
 */
function resolveBodyIdFromLabel(label, bodies) {
    const bodyList = Object.values(bodies);
    const orbitMatch = label.match(/^Low (.+) Orbit$/);
    if (orbitMatch) {
        const body = bodyList.find((candidate) => candidate.label === orbitMatch[1]);
        return body ? body.id : null;
    }

    for (const suffix of [' Surface', ' Escape', ' Intercept', ' Fly-by']) {
        if (!label.endsWith(suffix)) continue;
        const name = label.slice(0, -suffix.length);
        const body = bodyList.find((candidate) => candidate.label === name);
        return body ? body.id : null;
    }

    return null;
}

/**
 * Inputs: breakdown entry (label, type, dv), origin body id, and body
 * lookup.
 * Outputs: { bodyId, referenceDv, referenceField } describing the standard
 * map value this stage should match, or null if no reference applies.
 * Purpose: maps each dropdown-style stage to the pack node field that
 * represents its community-standard delta-v, per body.nodes.{land,orbit,
 * intercept}. See the file header for why this is a meaningful comparison
 * rather than a tautology.
 */
function resolveStageReference(entry, originBodyId, bodies) {
    const bodyId = resolveBodyIdFromLabel(entry.label, bodies);
    const body = bodyId ? bodies[bodyId] : null;
    if (!body) return null;

    if (entry.type === 'land') {
        return { bodyId, referenceField: 'land', referenceDv: Number(body.nodes?.land) };
    }
    if (entry.type === 'escape') {
        return { bodyId, referenceField: 'orbit', referenceDv: Number(body.nodes?.orbit) };
    }
    if (entry.type === 'intercept' || entry.type === 'flyby') {
        return { bodyId, referenceField: 'intercept', referenceDv: Number(body.nodes?.intercept) };
    }
    if (entry.type === 'orbit') {
        const isOriginAscent = bodyId === originBodyId;
        return isOriginAscent
            ? { bodyId, referenceField: 'land', referenceDv: Number(body.nodes?.land) }
            : { bodyId, referenceField: 'orbit', referenceDv: Number(body.nodes?.orbit) };
    }

    return null;
}

/**
 * Inputs: computed dv and reference dv (both already rounded to the
 * nearest 10).
 * Outputs: { diff, percent } where diff is computed - reference, and
 * percent is that diff relative to the reference (null when reference is 0).
 */
function compareToReference(computedDv, referenceDv) {
    const diff = roundTen(computedDv - referenceDv);
    const percent = referenceDv ? (diff / referenceDv) * 100 : null;
    return { diff, percent };
}

/**
 * Inputs: origin point, target point, bodies, meta, options, and pack id.
 * Outputs: one report row: per-stage comparisons plus a total comparison.
 */
function buildTargetReport(pointA, pointB, bodies, meta, options, packId) {
    const result = jscalculate(pointA, pointB, options, bodies, meta);
    const targetBody = bodies[pointB.body];

    const stages = result.breakdown.map((entry) => {
        const computedDv = roundTen(entry.dv);
        const reference = resolveStageReference(entry, pointA.body, bodies);
        if (!reference || !Number.isFinite(reference.referenceDv)) {
            return { label: entry.label, computedDv, referenceDv: null, diff: null, percent: null };
        }

        const { diff, percent } = compareToReference(computedDv, reference.referenceDv);
        return { label: entry.label, computedDv, referenceDv: reference.referenceDv, diff, percent };
    });

    const computedTotal = result.totalDV;
    const mapTotal = resolveMapTotal(packId, pointB.body);
    const fallbackTotal = stages.every((stage) => stage.referenceDv !== null)
        ? stages.reduce((sum, stage) => sum + stage.referenceDv, 0)
        : null;
    const referenceTotal = mapTotal !== null ? mapTotal : fallbackTotal;
    const totalSource = mapTotal !== null ? 'map' : (fallbackTotal !== null ? 'summed-stages (no map total transcribed for this pack)' : null);
    const totalComparison = referenceTotal !== null
        ? compareToReference(computedTotal, referenceTotal)
        : { diff: null, percent: null };

    return {
        bodyId: pointB.body,
        label: targetBody?.label || pointB.body,
        stages,
        computedTotal,
        referenceTotal,
        totalSource,
        totalDiff: totalComparison.diff,
        totalPercent: totalComparison.percent,
    };
}

/**
 * Inputs: bodies lookup, meta, origin body id, and optional allow-list of
 * target body ids.
 * Outputs: ordered list of target points (every landable body except the
 * central body and the origin itself), matching the site's own node-model
 * surface key.
 */
function collectTargetPoints(bodies, meta, originBodyId, onlyIds) {
    const surfaceKey = meta?.nodeModel?.surfaceNodeKey || 'land';
    return Object.values(bodies)
        .filter((body) => (
            body.id !== meta?.centralBody
            && body.id !== originBodyId
            && Object.prototype.hasOwnProperty.call(body.nodes || {}, surfaceKey)
            && (!onlyIds || onlyIds.has(body.id))
        ))
        .map((body) => ({ body: body.id, node: surfaceKey }));
}

/**
 * Inputs: numeric dv value, or null.
 * Outputs: display string with thousands separators, or an em dash.
 */
function fmt(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return value.toLocaleString();
}

/**
 * Inputs: percent value, or null.
 * Outputs: signed percent string, or an em dash.
 */
function fmtPercent(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

/**
 * Inputs: numeric diff value, or null.
 * Outputs: signed display string, or an em dash.
 */
function fmtDiff(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toLocaleString()}`;
}

/**
 * Inputs: one target report.
 * Outputs: prints its per-stage breakdown table, dropdown-order, plus total.
 */
function printTargetTable(report) {
    console.log(`${report.label} (Surface)`);
    console.log('-'.repeat(report.label.length + 10));
    console.log(
        `  ${'Stage'.padEnd(22)} ${'Computed'.padStart(10)} ${'Reference'.padStart(10)} ${'Diff'.padStart(8)} ${'Diff %'.padStart(8)}`,
    );
    for (const stage of report.stages) {
        console.log(
            `  ${stage.label.padEnd(22)} `
            + `${fmt(stage.computedDv).padStart(10)} `
            + `${fmt(stage.referenceDv).padStart(10)} `
            + `${fmtDiff(stage.diff).padStart(8)} `
            + `${fmtPercent(stage.percent).padStart(8)}`,
        );
    }
    console.log(
        `  ${'Total'.padEnd(22)} `
        + `${fmt(report.computedTotal).padStart(10)} `
        + `${fmt(report.referenceTotal).padStart(10)} `
        + `${fmtDiff(report.totalDiff).padStart(8)} `
        + `${fmtPercent(report.totalPercent).padStart(8)}`,
    );
    if (report.totalSource && report.totalSource !== 'map') {
        console.log(`  (total reference: ${report.totalSource})`);
    }
    console.log();
}

/**
 * Inputs: all target reports.
 * Outputs: prints a summary table sorted worst-offender first, across every
 * stage of every route (not just totals), so a body with one bad leg still
 * surfaces even if its total looks fine.
 */
function printWorstOffenders(reports, sortKey) {
    const rows = [];
    for (const report of reports) {
        for (const stage of report.stages) {
            if (stage.percent === null) continue;
            rows.push({
                body: report.label,
                stage: stage.label,
                computedDv: stage.computedDv,
                referenceDv: stage.referenceDv,
                diff: stage.diff,
                percent: stage.percent,
            });
        }
        if (report.totalPercent !== null) {
            rows.push({
                body: report.label,
                stage: 'Total',
                computedDv: report.computedTotal,
                referenceDv: report.referenceTotal,
                diff: report.totalDiff,
                percent: report.totalPercent,
            });
        }
    }

    const sorters = {
        percent: (a, b) => Math.abs(b.percent) - Math.abs(a.percent),
        diff: (a, b) => Math.abs(b.diff) - Math.abs(a.diff),
        body: (a, b) => a.body.localeCompare(b.body),
    };
    rows.sort(sorters[sortKey] || sorters.percent);

    console.log('Worst offenders (all stages, all bodies)');
    console.log('=========================================');
    console.log(
        `${'Body'.padEnd(10)} ${'Stage'.padEnd(22)} ${'Computed'.padStart(10)} ${'Reference'.padStart(10)} ${'Diff'.padStart(8)} ${'Diff %'.padStart(8)}`,
    );
    for (const row of rows) {
        console.log(
            `${row.body.padEnd(10)} ${row.stage.padEnd(22)} `
            + `${fmt(row.computedDv).padStart(10)} `
            + `${fmt(row.referenceDv).padStart(10)} `
            + `${fmtDiff(row.diff).padStart(8)} `
            + `${fmtPercent(row.percent).padStart(8)}`,
        );
    }
    console.log();
}

/**
 * Inputs: raw argv (excluding node/script path).
 * Outputs: parsed CLI options.
 */
function parseArgs(argv) {
    const options = {
        pack: DEFAULT_PACK_ID,
        origin: null,
        json: false,
        sort: 'percent',
        only: null,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--pack') options.pack = argv[++i];
        else if (arg === '--origin') options.origin = argv[++i];
        else if (arg === '--json') options.json = true;
        else if (arg === '--sort') options.sort = argv[++i];
        else if (arg === '--only') options.only = new Set(argv[++i].split(',').map((id) => id.trim()));
        else throw new Error(`Unknown argument: ${arg}`);
    }

    return options;
}

/**
 * Inputs: CLI argv.
 * Outputs: none. Runs the full verification report to stdout.
 */
function main() {
    const args = parseArgs(process.argv.slice(2));
    loadRealCalculator();

    const { bodies, meta, label } = loadPack(args.pack);
    const originBodyId = args.origin || meta?.originBody || 'kerbin';
    const surfaceKey = meta?.nodeModel?.surfaceNodeKey || 'land';
    const originPoint = { body: originBodyId, node: surfaceKey };
    const calcOptions = defaultCalculationOptions();

    const targets = collectTargetPoints(bodies, meta, originBodyId, args.only);
    const reports = targets.map((point) => buildTargetReport(originPoint, point, bodies, meta, calcOptions, args.pack));

    if (args.json) {
        console.log(JSON.stringify({ pack: label, origin: originPoint, reports }, null, 2));
        return;
    }

    console.log('Delta-V map verification report');
    console.log('================================');
    console.log(`Pack:   ${label}`);
    console.log(`Origin: ${bodies[originBodyId]?.label || originBodyId} Surface`);
    console.log();

    for (const report of reports) {
        printTargetTable(report);
    }

    printWorstOffenders(reports, args.sort);
}

main();
