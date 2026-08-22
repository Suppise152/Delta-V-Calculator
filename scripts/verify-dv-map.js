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
 * Another honest gap: a return leg that escapes a moon toward a DIFFERENT
 * top-level body than its own host (calculateMoonHostEscapeBranch, e.g.
 * Gilly -> Kerbin passing through Eve's SOI) produces an "{Host} Escape"
 * stage that isn't a plain local escape - it's a composite retarget burn
 * with no single matching pack field. It's still compared against the
 * host's own orbit field here for lack of a better option, so a large diff
 * on one of those specific rows is worth a manual look before assuming it's
 * a formula bug, rather than an artifact of the reference choice.
 *
 * Each target is checked both ways: the outbound trip (origin -> target) and
 * the return trip (target -> origin), run as two independent one-way
 * jscalculate() calls (exactly how the site's own roundTrip option computes
 * them internally - see calc/index.js calculateRoute). The return leg is
 * where a class of bug hid previously: an arrival edge with no branch
 * classifier at all silently fell through to a flat fallback value. Running
 * both directions through the same per-stage reference check catches that
 * kind of thing without having to eyeball the dropdown by hand. The round
 * trip's combined total is also checked, using the real roundTrip:true
 * result (not a re-sum) so its rounding matches the site exactly; its
 * reference is the outbound map total counted twice, since the map's own
 * description assumes an idealized transfer with the same cost either
 * direction (see resolveMapTotal).
 *
 * Usage:
 *   node scripts/verify-dv-map.js [--pack ksp1/stock] [--origin kerbin]
 *     [--json] [--sort percent|diff|body] [--only moho,eve,...]
 *     [--legs outbound|return|both]
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
 * Inputs: body id, body lookup, and central body id.
 * Outputs: the id of that body's top-level ancestor (a direct child of the
 * central body), or the body id itself if it already is one.
 * Purpose: mirrors src/calc/branches/local.js's own
 * _resolveTransferOriginTopLevelBody, used to tell whether a leg's origin
 * sits within the same top-level system the map's reference numbers assume.
 */
function resolveTopLevelBodyId(bodyId, bodies, centralBodyId) {
    let currentId = bodyId;
    while (currentId && bodies[currentId]) {
        const parentId = bodies[currentId].parent;
        if (parentId === centralBodyId || parentId == null) return currentId;
        currentId = parentId;
    }
    return bodyId;
}

// Mirrors src/calc/branches/transfer.js's own LOW_GRAVITY_ESCAPE_BUDGET_DV.
// Not exported by the calculator (it's a private module constant), so it's
// duplicated here; keep it in sync if that file's threshold ever changes.
const LOW_GRAVITY_ESCAPE_BUDGET_DV = 600;

/**
 * Inputs: a top-level body and system metadata.
 * Outputs: true when escaping this body's own low orbit costs less than the
 * low-gravity threshold.
 * Purpose: replicates calculateDirectOrbitalTransferBranch's own
 * _usesLowGravitySoiBudget check (using the real exported formula
 * functions, not a re-derived approximation) to know when a "{Body} Escape"
 * stage stopped being a plain zero-vInf local escape and became one term
 * of a different, non-hyperbolic budget split - see that function's own
 * comment for why low-gravity bodies get this alternate treatment.
 */
function localEscapeBurnBelowLowGravityBudget(body, meta) {
    const mu = Number(DeltaVCalc.getPhysics(body).mu) || 0;
    const periapsis = DeltaVCalc.lowOrbitRadius(body, meta);
    return DeltaVCalc.hyperbolicDepartureBurn(mu, periapsis, 0) < LOW_GRAVITY_ESCAPE_BUDGET_DV;
}

/**
 * Inputs: breakdown entry (label, type, dv), origin body id, body lookup,
 * and system metadata.
 * Outputs: { bodyId, referenceDv, referenceField } describing the standard
 * map value this stage should match, or null if no reference applies.
 * Purpose: maps each dropdown-style stage to the pack node field that
 * represents its community-standard delta-v, per body.nodes.{land,orbit,
 * intercept}. See the file header for why this is a meaningful comparison
 * rather than a tautology, and for the composite-leg caveat this function
 * deliberately returns null for.
 */
function resolveStageReference(entry, originBodyId, bodies, meta) {
    const bodyId = resolveBodyIdFromLabel(entry.label, bodies);
    const body = bodyId ? bodies[bodyId] : null;
    if (!body) return null;

    if (entry.type === 'land') {
        return { bodyId, referenceField: 'land', referenceDv: Number(body.nodes?.land) };
    }
    if (entry.type === 'escape') {
        // A plain local escape from wherever this leg started (outbound, or
        // a return leg's first hop off the target body) matches the pack's
        // orbit field. An "escape" stage for any OTHER body is a
        // calculateMoonHostEscapeBranch composite retarget through an
        // intermediate host (e.g. "Eve Escape" while actually departing
        // Gilly) - not a single-body quantity the pack has a field for.
        if (bodyId !== originBodyId) return null;

        // A top-level body escaping toward a DIFFERENT top-level system
        // (only possible on a return leg, since an outbound leg always
        // starts at the map's own origin body) can hit
        // calculateDirectOrbitalTransferBranch's low-gravity SOI budget,
        // which stops decomposing the burn the normal way once the local
        // escape is cheap enough. The "escape" entry is then one term of a
        // linear split rather than a standalone zero-vInf escape, so it no
        // longer matches the pack's orbit field either.
        const isTopLevelBody = body.parent === meta?.centralBody;
        if (isTopLevelBody && bodyId !== meta?.originBody && localEscapeBurnBelowLowGravityBudget(body, meta)) {
            return null;
        }

        return { bodyId, referenceField: 'orbit', referenceDv: Number(body.nodes?.orbit) };
    }
    if (entry.type === 'intercept' || entry.type === 'flyby') {
        return { bodyId, referenceField: 'intercept', referenceDv: Number(body.nodes?.intercept) };
    }
    if (entry.type === 'orbit') {
        const isOriginAscent = bodyId === originBodyId;
        if (isOriginAscent) {
            return { bodyId, referenceField: 'land', referenceDv: Number(body.nodes?.land) };
        }

        // A leg that starts at one of this body's own moons and captures
        // straight into this body's low orbit (calculateMoonHostCaptureBranch,
        // e.g. a Mun -> Low Kerbin Orbit return leg) mirrors that moon's own
        // outbound intercept burn by Hohmann-transfer symmetry - see that
        // branch's doc comment. Comparing it against the moon's intercept
        // field is the precise check; the host's own orbit field (a plain
        // zero-vInf escape/capture magnitude) is the wrong reference here.
        const originBody = bodies[originBodyId];
        if (originBody?.parent === bodyId) {
            return { bodyId: originBodyId, referenceField: 'intercept', referenceDv: Number(originBody.nodes?.intercept) };
        }

        // Otherwise this is a capture arriving from a genuinely different
        // top-level system (e.g. any "Low Kerbin Orbit" on a return leg from
        // Eve, Duna, or a Jool moon). The pack's orbit field is a plain
        // zero-vInf local escape/capture magnitude calibrated around
        // Kerbin-origin transfers (this IS a Kerbin dV map); comparing it
        // against an arrival from some other body's system - which
        // calculateFlybyCaptureBranch already correctly derives a distinct,
        // body-specific speed for - has no single right answer in the pack,
        // so there's nothing meaningful to check it against here.
        const originTopLevelId = resolveTopLevelBodyId(originBodyId, bodies, meta?.centralBody);
        if (originTopLevelId !== (meta?.originBody ?? originTopLevelId)) return null;

        return { bodyId, referenceField: 'orbit', referenceDv: Number(body.nodes?.orbit) };
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
 * Inputs: leg start point, leg end point, bodies, meta, options, pack id,
 * and the body id whose transcribed map total applies to this leg.
 * Outputs: one leg report: per-stage comparisons plus a total comparison.
 * Purpose: computes ONE direction of travel. mapTotalBodyId is passed
 * explicitly (rather than always inferred from pointB) so a return leg
 * (target -> origin) can still be checked against the same body's map
 * total, since the origin itself (e.g. Kerbin) was never transcribed.
 */
function buildLegReport(pointA, pointB, bodies, meta, options, packId, mapTotalBodyId) {
    const result = jscalculate(pointA, pointB, options, bodies, meta);
    const fromBody = bodies[pointA.body];
    const toBody = bodies[pointB.body];

    const stages = result.breakdown.map((entry) => {
        const computedDv = roundTen(entry.dv);
        const reference = resolveStageReference(entry, pointA.body, bodies, meta);
        if (!reference || !Number.isFinite(reference.referenceDv)) {
            return { label: entry.label, computedDv, referenceDv: null, diff: null, percent: null };
        }

        const { diff, percent } = compareToReference(computedDv, reference.referenceDv);
        return { label: entry.label, computedDv, referenceDv: reference.referenceDv, diff, percent };
    });

    const computedTotal = result.totalDV;
    const mapTotal = resolveMapTotal(packId, mapTotalBodyId ?? pointB.body);
    const fallbackTotal = stages.every((stage) => stage.referenceDv !== null)
        ? stages.reduce((sum, stage) => sum + stage.referenceDv, 0)
        : null;
    const referenceTotal = mapTotal !== null ? mapTotal : fallbackTotal;
    const totalSource = mapTotal !== null ? 'map' : (fallbackTotal !== null ? 'summed-stages (no map total transcribed for this pack)' : null);
    const totalComparison = referenceTotal !== null
        ? compareToReference(computedTotal, referenceTotal)
        : { diff: null, percent: null };

    return {
        fromLabel: fromBody?.label || pointA.body,
        toLabel: toBody?.label || pointB.body,
        stages,
        computedTotal,
        referenceTotal,
        totalSource,
        totalDiff: totalComparison.diff,
        totalPercent: totalComparison.percent,
    };
}

/**
 * Inputs: origin point, target point, bodies, meta, options, and pack id.
 * Outputs: { bodyId, label, outbound, inbound, roundTrip* } - both leg
 * reports plus the real combined round-trip total (from an actual
 * roundTrip:true call, so its rounding matches the site exactly rather
 * than being re-derived by adding two independently-rounded totals).
 */
function buildRoundTripReport(originPoint, targetPoint, bodies, meta, options, packId) {
    const targetBody = bodies[targetPoint.body];
    const outbound = buildLegReport(originPoint, targetPoint, bodies, meta, options, packId, targetPoint.body);
    const inbound = buildLegReport(targetPoint, originPoint, bodies, meta, options, packId, targetPoint.body);

    const roundTripResult = jscalculate(originPoint, targetPoint, { ...options, roundTrip: true }, bodies, meta);
    const roundTripReferenceTotal = (outbound.referenceTotal !== null && inbound.referenceTotal !== null)
        ? outbound.referenceTotal + inbound.referenceTotal
        : null;
    const roundTripComparison = roundTripReferenceTotal !== null
        ? compareToReference(roundTripResult.totalDV, roundTripReferenceTotal)
        : { diff: null, percent: null };

    return {
        bodyId: targetPoint.body,
        label: targetBody?.label || targetPoint.body,
        outbound,
        inbound,
        roundTripTotal: roundTripResult.totalDV,
        roundTripReferenceTotal,
        roundTripDiff: roundTripComparison.diff,
        roundTripPercent: roundTripComparison.percent,
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
 * Inputs: one leg report and a heading line.
 * Outputs: prints its per-stage breakdown table, dropdown-order, plus total.
 */
function printLegTable(leg, heading) {
    console.log(heading);
    console.log('-'.repeat(heading.length));
    console.log(
        `  ${'Stage'.padEnd(22)} ${'Computed'.padStart(10)} ${'Reference'.padStart(10)} ${'Diff'.padStart(8)} ${'Diff %'.padStart(8)}`,
    );
    for (const stage of leg.stages) {
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
        + `${fmt(leg.computedTotal).padStart(10)} `
        + `${fmt(leg.referenceTotal).padStart(10)} `
        + `${fmtDiff(leg.totalDiff).padStart(8)} `
        + `${fmtPercent(leg.totalPercent).padStart(8)}`,
    );
    if (leg.totalSource && leg.totalSource !== 'map') {
        console.log(`  (total reference: ${leg.totalSource})`);
    }
}

/**
 * Inputs: one round-trip report (outbound leg, return leg, combined total).
 * Outputs: prints both leg tables plus the combined round-trip total line.
 */
function printRoundTripReport(report) {
    printLegTable(report.outbound, `${report.label} - Outbound: ${report.outbound.fromLabel} -> ${report.outbound.toLabel}`);
    console.log();
    printLegTable(report.inbound, `${report.label} - Return: ${report.inbound.fromLabel} -> ${report.inbound.toLabel}`);
    console.log();
    console.log(
        `  ${'Round trip total'.padEnd(22)} `
        + `${fmt(report.roundTripTotal).padStart(10)} `
        + `${fmt(report.roundTripReferenceTotal).padStart(10)} `
        + `${fmtDiff(report.roundTripDiff).padStart(8)} `
        + `${fmtPercent(report.roundTripPercent).padStart(8)}`,
    );
    console.log();
}

/**
 * Inputs: all round-trip reports and the requested leg scope.
 * Outputs: prints a summary table sorted worst-offender first, across every
 * stage of every leg in scope (not just totals), so a body with one bad leg
 * still surfaces even if its total looks fine.
 */
function printWorstOffenders(reports, sortKey, legScope) {
    const rows = [];
    for (const report of reports) {
        const legs = [];
        if (legScope !== 'return') legs.push(['Outbound', report.outbound]);
        if (legScope !== 'outbound') legs.push(['Return', report.inbound]);

        for (const [legName, leg] of legs) {
            for (const stage of leg.stages) {
                if (stage.percent === null) continue;
                rows.push({
                    body: `${report.label} (${legName})`,
                    stage: stage.label,
                    computedDv: stage.computedDv,
                    referenceDv: stage.referenceDv,
                    diff: stage.diff,
                    percent: stage.percent,
                });
            }
            if (leg.totalPercent !== null) {
                rows.push({
                    body: `${report.label} (${legName})`,
                    stage: 'Leg total',
                    computedDv: leg.computedTotal,
                    referenceDv: leg.referenceTotal,
                    diff: leg.totalDiff,
                    percent: leg.totalPercent,
                });
            }
        }

        if (legScope === 'both' && report.roundTripPercent !== null) {
            rows.push({
                body: report.label,
                stage: 'Round trip total',
                computedDv: report.roundTripTotal,
                referenceDv: report.roundTripReferenceTotal,
                diff: report.roundTripDiff,
                percent: report.roundTripPercent,
            });
        }
    }

    const sorters = {
        percent: (a, b) => Math.abs(b.percent) - Math.abs(a.percent),
        diff: (a, b) => Math.abs(b.diff) - Math.abs(a.diff),
        body: (a, b) => a.body.localeCompare(b.body),
    };
    rows.sort(sorters[sortKey] || sorters.percent);

    const bodyColumnWidth = Math.max(18, ...rows.map((row) => row.body.length));

    console.log('Worst offenders (all legs in scope, all bodies)');
    console.log('================================================');
    console.log(
        `${'Body'.padEnd(bodyColumnWidth)} ${'Stage'.padEnd(22)} ${'Computed'.padStart(10)} ${'Reference'.padStart(10)} ${'Diff'.padStart(8)} ${'Diff %'.padStart(8)}`,
    );
    for (const row of rows) {
        console.log(
            `${row.body.padEnd(bodyColumnWidth)} ${row.stage.padEnd(22)} `
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
        legs: 'both',
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--pack') options.pack = argv[++i];
        else if (arg === '--origin') options.origin = argv[++i];
        else if (arg === '--json') options.json = true;
        else if (arg === '--sort') options.sort = argv[++i];
        else if (arg === '--only') options.only = new Set(argv[++i].split(',').map((id) => id.trim()));
        else if (arg === '--legs') options.legs = argv[++i];
        else throw new Error(`Unknown argument: ${arg}`);
    }

    if (!['both', 'outbound', 'return'].includes(options.legs)) {
        throw new Error(`--legs must be one of: both, outbound, return (got "${options.legs}")`);
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
    const reports = targets.map((point) => buildRoundTripReport(originPoint, point, bodies, meta, calcOptions, args.pack));

    if (args.json) {
        console.log(JSON.stringify({ pack: label, origin: originPoint, legs: args.legs, reports }, null, 2));
        return;
    }

    console.log('Delta-V map verification report');
    console.log('================================');
    console.log(`Pack:   ${label}`);
    console.log(`Origin: ${bodies[originBodyId]?.label || originBodyId} Surface`);
    console.log(`Legs:   ${args.legs}`);
    console.log();

    for (const report of reports) {
        if (args.legs === 'both') {
            printRoundTripReport(report);
        } else if (args.legs === 'outbound') {
            printLegTable(report.outbound, `${report.label} - Outbound: ${report.outbound.fromLabel} -> ${report.outbound.toLabel}`);
            console.log();
        } else {
            printLegTable(report.inbound, `${report.label} - Return: ${report.inbound.fromLabel} -> ${report.inbound.toLabel}`);
            console.log();
        }
    }

    printWorstOffenders(reports, args.sort, args.legs);
}

main();
