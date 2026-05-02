#!/usr/bin/env python3
"""Validate branch formulas against explicit map reference values.

Current scope:
- low orbit is 10 km above atmosphere or terrain obstacles
- plane change is included only in the transfer branch
- local-branch map values are validated separately for:
  - orbit -> escape
  - flyby -> capture
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from statistics import mean

from validation_reference_values import IMAGE_SOURCES, REFERENCE_VALUES


ROOT = Path(__file__).resolve().parents[1]
LOW_ORBIT_BUFFER_METERS = 10_000.0

@dataclass(frozen=True)
class ModeResult:
    name: str
    label: str
    values: dict[str, float]
    coplanar_values: dict[str, float]
    plane_change_values: dict[str, float]
    mean_abs_diff: float
    max_abs_diff: float


@dataclass(frozen=True)
class TransferModelContext:
    origin_radius: float
    target_radius: float
    origin_speed: float
    target_speed: float
    transfer_depart_speed: float
    transfer_arrive_speed: float
    plane_angle: float
    vinf_depart_coplanar: float
    vinf_depart_combined: float
    vinf_arrive_coplanar: float
    vinf_arrive_combined: float


def load_pack(pack_path: Path) -> tuple[dict, dict[str, dict], dict]:
    with pack_path.open("r", encoding="utf-8-sig") as handle:
        payload = json.load(handle)

    bodies = {body["id"]: body for body in payload["bodies"]}
    return payload["meta"], bodies, payload.get("transferConfig", {})


def load_reference_values() -> dict:
    return REFERENCE_VALUES


def get_pack_name(meta: dict) -> str:
    return meta.get("pack", "stock")


def get_node_model(meta: dict) -> dict:
    return meta.get("nodeModel", {})


def get_pack_physics(bodies: dict[str, dict]) -> dict[str, dict[str, float]]:
    physics = {}
    for body_id, body in bodies.items():
        body_physics = body.get("physics")
        if not body_physics:
            continue
        physics[body_id] = {
            "radius": float(body_physics.get("radius", 0.0) or 0.0),
            "mu": float(body_physics.get("mu", 0.0) or 0.0),
            "atmosphere": float(body_physics.get("atmosphereHeight", 0.0) or 0.0),
            "soiRadius": float(body_physics.get("soiRadius", 0.0) or 0.0),
        }
    return physics


def get_reference_image(pack_name: str) -> Path:
    return IMAGE_SOURCES.get(pack_name, ROOT / "assets" / "images" / f"{pack_name}.png")


def require_pack_support(meta: dict, bodies: dict[str, dict]) -> None:
    pack_name = get_pack_name(meta)
    physics = get_pack_physics(bodies)
    missing = sorted(body_id for body_id in bodies if body_id not in physics)
    if missing:
        missing_text = ", ".join(missing) if missing else "unknown bodies"
        raise SystemExit(
            f"Pack '{pack_name}' is missing embedded body constants. "
            f"Missing support for: {missing_text}"
        )


def requested_node_altitude(meta: dict, body_id: str, node_key: str, physics: dict[str, dict[str, float]]) -> float:
    node_model = get_node_model(meta)
    body = physics[body_id]
    if node_key == "orbit":
        altitude_override = (node_model.get("lowOrbitAltitudeOverrides") or {}).get(body_id)
        default_altitude = float(
            node_model.get("lowOrbitAltitudeMeters", LOW_ORBIT_BUFFER_METERS) or LOW_ORBIT_BUFFER_METERS
        )
    else:
        altitude_override = (node_model.get("flybyPeriapsisAltitudeOverrides") or {}).get(body_id)
        default_altitude = float(
            node_model.get("flybyPeriapsisAltitudeMeters", LOW_ORBIT_BUFFER_METERS) or LOW_ORBIT_BUFFER_METERS
        )
    return float(altitude_override) if altitude_override is not None else body["atmosphere"] + default_altitude


def constrained_periapsis_radius(
    meta: dict,
    body_id: str,
    node_key: str,
    physics: dict[str, dict[str, float]],
) -> float:
    body = physics[body_id]
    requested_radius = body["radius"] + requested_node_altitude(meta, body_id, node_key, physics)
    soi_radius = body["soiRadius"]
    if soi_radius <= 0.0:
        return requested_radius
    maximum_radius = max(body["radius"] + 1.0, soi_radius * 0.95)
    return min(requested_radius, maximum_radius)


def low_orbit_radius(meta: dict, body_id: str, physics: dict[str, dict[str, float]]) -> float:
    return constrained_periapsis_radius(meta, body_id, "orbit", physics)


def flyby_periapsis_radius(meta: dict, body_id: str, physics: dict[str, dict[str, float]]) -> float:
    return constrained_periapsis_radius(meta, body_id, "flyby", physics)


def get_node_value(body: dict, node_key: str) -> float | None:
    nodes = body.get("nodes") or {}
    value = nodes.get(node_key)
    return float(value) if value is not None else None


def circular_speed(mu: float, radius: float) -> float:
    return math.sqrt(mu / radius)


def relative_speed(speed_a: float, speed_b: float, angle_rad: float) -> float:
    return math.sqrt(
        (speed_a * speed_a)
        + (speed_b * speed_b)
        - (2.0 * speed_a * speed_b * math.cos(angle_rad))
    )


def hyperbolic_departure_burn(mu: float, periapsis_radius: float, v_inf: float) -> float:
    return math.sqrt((v_inf * v_inf) + ((2.0 * mu) / periapsis_radius)) - math.sqrt(
        mu / periapsis_radius
    )


def ellipse_periapsis_speed(mu: float, periapsis_radius: float, apoapsis_radius: float) -> float:
    semi_major_axis = (periapsis_radius + apoapsis_radius) / 2.0
    return math.sqrt(mu * ((2.0 / periapsis_radius) - (1.0 / semi_major_axis)))


def orbit_to_soi_edge_burn(mu: float, periapsis_radius: float, soi_radius: float) -> float:
    return ellipse_periapsis_speed(mu, periapsis_radius, soi_radius) - math.sqrt(mu / periapsis_radius)


def hohmann_transfer_speeds(mu: float, radius_a: float, radius_b: float) -> tuple[float, float]:
    semi_major_axis = (radius_a + radius_b) / 2.0
    speed_a = math.sqrt(mu * ((2.0 / radius_a) - (1.0 / semi_major_axis)))
    speed_b = math.sqrt(mu * ((2.0 / radius_b) - (1.0 / semi_major_axis)))
    return speed_a, speed_b


def plane_angle(body_a: dict, body_b: dict) -> float:
    inc_a = math.radians(body_a["orbit"].get("inclination", 0.0) or 0.0)
    inc_b = math.radians(body_b["orbit"].get("inclination", 0.0) or 0.0)
    lan_a = math.radians(body_a["orbit"].get("longitudeOfAscendingNode", 0.0) or 0.0)
    lan_b = math.radians(body_b["orbit"].get("longitudeOfAscendingNode", 0.0) or 0.0)

    cosine = (
        (math.cos(inc_a) * math.cos(inc_b))
        + (math.sin(inc_a) * math.sin(inc_b) * math.cos(lan_a - lan_b))
    )
    return math.acos(max(-1.0, min(1.0, cosine)))


def plane_change_delta_v(speed: float, angle_rad: float) -> float:
    return 2.0 * speed * math.sin(angle_rad / 2.0)


def summarize_mode(label: str, values: dict[str, float], expected: dict[str, float]) -> ModeResult:
    diffs = [abs(values[body_id] - expected[body_id]) for body_id in expected]
    return ModeResult(
        name=label.lower().replace(" ", "_"),
        label=label,
        values=values,
        coplanar_values={},
        plane_change_values={},
        mean_abs_diff=mean(diffs),
        max_abs_diff=max(diffs),
    )


def summarize_branch_errors(rows: list[dict[str, object]]) -> tuple[float, float]:
    diffs = [abs(float(row["diff"])) for row in rows]
    return mean(diffs), max(diffs)


def summarize_filtered_errors(
    rows: list[dict[str, object]],
    predicate,
) -> tuple[float, float] | None:
    filtered = [abs(float(row["diff"])) for row in rows if predicate(row)]
    if not filtered:
        return None
    return mean(filtered), max(filtered)


def orbital_radius(body: dict, location: str) -> float:
    if location == "periapsis":
        stored = body["orbit"].get("periapsisRadius")
        if stored is not None:
            return float(stored)
    if location == "apoapsis":
        stored = body["orbit"].get("apoapsisRadius")
        if stored is not None:
            return float(stored)
    sma = body["orbit"]["sma"]
    eccentricity = body["orbit"].get("eccentricity", 0.0) or 0.0
    if location == "periapsis":
        return sma * (1.0 - eccentricity)
    if location == "apoapsis":
        return sma * (1.0 + eccentricity)
    return sma


def orbital_speed(mu: float, semi_major_axis: float, radius: float) -> float:
    return math.sqrt(mu * ((2.0 / radius) - (1.0 / semi_major_axis)))


def build_transfer_context(
    origin: dict,
    target: dict,
    origin_radius: float,
    target_radius: float,
    central_body_id: str,
    physics: dict[str, dict[str, float]],
) -> TransferModelContext:
    star_mu = physics[central_body_id]["mu"]
    origin_speed = orbital_speed(star_mu, origin["orbit"]["sma"], origin_radius)
    target_speed = orbital_speed(star_mu, target["orbit"]["sma"], target_radius)
    transfer_depart_speed, transfer_arrive_speed = hohmann_transfer_speeds(
        star_mu, origin_radius, target_radius
    )
    angle = plane_angle(origin, target)

    return TransferModelContext(
        origin_radius=origin_radius,
        target_radius=target_radius,
        origin_speed=origin_speed,
        target_speed=target_speed,
        transfer_depart_speed=transfer_depart_speed,
        transfer_arrive_speed=transfer_arrive_speed,
        plane_angle=angle,
        vinf_depart_coplanar=abs(transfer_depart_speed - origin_speed),
        vinf_depart_combined=relative_speed(origin_speed, transfer_depart_speed, angle),
        vinf_arrive_coplanar=abs(target_speed - transfer_arrive_speed),
        vinf_arrive_combined=relative_speed(target_speed, transfer_arrive_speed, angle),
    )


def compute_interplanetary_context(
    origin_id: str,
    target_id: str,
    bodies: dict[str, dict],
    central_body_id: str,
    physics: dict[str, dict[str, float]],
) -> TransferModelContext:
    origin = bodies[origin_id]
    target = bodies[target_id]
    return build_transfer_context(
        origin,
        target,
        orbital_radius(origin, "periapsis"),
        orbital_radius(target, "apoapsis"),
        central_body_id,
        physics,
    )


def summarize_mode_with_components(
    label: str,
    totals: dict[str, float],
    coplanar: dict[str, float],
    plane_changes: dict[str, float],
    expected: dict[str, float],
) -> ModeResult:
    diffs = [abs(totals[body_id] - expected[body_id]) for body_id in expected]
    return ModeResult(
        name=label.lower().replace(" ", "_"),
        label=label,
        values=totals,
        coplanar_values=coplanar,
        plane_change_values=plane_changes,
        mean_abs_diff=mean(diffs),
        max_abs_diff=max(diffs),
    )


def build_transfer_mode(
    label: str,
    expected: dict[str, float],
    contexts: dict[str, TransferModelContext],
    origin_mu: float,
    origin_periapsis_radius: float,
) -> ModeResult:
    totals = {}
    coplanar_values = {}
    plane_change_values = {}
    local_escape = hyperbolic_departure_burn(origin_mu, origin_periapsis_radius, 0.0)

    for body_id, context in contexts.items():
        departure_burn = hyperbolic_departure_burn(
            origin_mu,
            origin_periapsis_radius,
            context.vinf_depart_coplanar,
        )
        coplanar_extra = departure_burn - local_escape
        plane_change_cost = plane_change_delta_v(context.origin_speed, context.plane_angle)

        totals[body_id] = coplanar_extra + plane_change_cost
        coplanar_values[body_id] = coplanar_extra
        plane_change_values[body_id] = plane_change_cost

    return summarize_mode_with_components(
        label,
        totals,
        coplanar_values,
        plane_change_values,
        expected,
    )


def build_interplanetary_mode(
    meta: dict,
    bodies: dict[str, dict],
    transfer_config: dict,
    expected: dict[str, float],
) -> ModeResult:
    physics = get_pack_physics(bodies)
    origin_id = transfer_config.get("originBody")
    central_body_id = meta.get("centralBody")
    origin_periapsis_radius = low_orbit_radius(meta, origin_id, physics)
    origin_mu = physics[origin_id]["mu"]

    contexts = {
        body_id: compute_interplanetary_context(origin_id, body_id, bodies, central_body_id, physics)
        for body_id, body in bodies.items()
        if body["parent"] == central_body_id and body_id not in {central_body_id, origin_id}
    }

    return build_transfer_mode(
        "Periapsis-to-apoapsis Hohmann + optimal transfer plane change",
        expected,
        contexts,
        origin_mu,
        origin_periapsis_radius,
    )


def body_inclination_angle(body: dict) -> float:
    return math.radians(body["orbit"].get("inclination", 0.0) or 0.0)


def build_host_to_child_transfer_context(
    meta: dict,
    host: dict,
    target: dict,
    physics: dict[str, dict[str, float]],
) -> TransferModelContext:
    host_mu = physics[host["id"]]["mu"]
    origin_radius = low_orbit_radius(meta, host["id"], physics)
    target_radius = orbital_radius(target, "apoapsis")
    origin_speed = circular_speed(host_mu, origin_radius)
    target_speed = orbital_speed(host_mu, target["orbit"]["sma"], target_radius)
    transfer_depart_speed, transfer_arrive_speed = hohmann_transfer_speeds(
        host_mu, origin_radius, target_radius
    )
    angle = body_inclination_angle(target)

    return TransferModelContext(
        origin_radius=origin_radius,
        target_radius=target_radius,
        origin_speed=origin_speed,
        target_speed=target_speed,
        transfer_depart_speed=transfer_depart_speed,
        transfer_arrive_speed=transfer_arrive_speed,
        plane_angle=angle,
        vinf_depart_coplanar=abs(transfer_depart_speed - origin_speed),
        vinf_depart_combined=relative_speed(origin_speed, transfer_depart_speed, angle),
        vinf_arrive_coplanar=abs(target_speed - transfer_arrive_speed),
        vinf_arrive_combined=relative_speed(target_speed, transfer_arrive_speed, angle),
    )


def build_escape_to_intercept_mode(
    meta: dict,
    bodies: dict[str, dict],
    transfer_config: dict,
    expected: dict[str, float],
) -> ModeResult:
    physics = get_pack_physics(bodies)
    origin_id = transfer_config.get("originBody")
    central_body_id = meta.get("centralBody")

    totals = {}
    coplanar_values = {}
    plane_change_values = {}

    for body_id in expected:
        target = bodies[body_id]
        if target["parent"] == central_body_id:
            origin_periapsis_radius = low_orbit_radius(meta, origin_id, physics)
            origin_mu = physics[origin_id]["mu"]
            context = compute_interplanetary_context(origin_id, body_id, bodies, central_body_id, physics)
            local_escape = hyperbolic_departure_burn(origin_mu, origin_periapsis_radius, 0.0)
            departure_burn = hyperbolic_departure_burn(
                origin_mu,
                origin_periapsis_radius,
                context.vinf_depart_coplanar,
            )
            coplanar_extra = departure_burn - local_escape
            plane_change_cost = plane_change_delta_v(context.origin_speed, context.plane_angle)
        else:
            host = bodies[target["parent"]]
            context = build_host_to_child_transfer_context(meta, host, target, physics)
            coplanar_extra = abs(context.transfer_depart_speed - context.origin_speed)
            plane_change_cost = plane_change_delta_v(context.origin_speed, context.plane_angle)

        totals[body_id] = coplanar_extra + plane_change_cost
        coplanar_values[body_id] = coplanar_extra
        plane_change_values[body_id] = plane_change_cost

    return summarize_mode_with_components(
        "Escape-to-intercept branch output",
        totals,
        coplanar_values,
        plane_change_values,
        expected,
    )


def get_periapsis_radius_for_branch(
    meta: dict,
    body_id: str,
    physics: dict[str, dict[str, float]],
    branch_mode: str,
) -> float:
    if branch_mode == "outbound":
        return low_orbit_radius(meta, body_id, physics)
    return flyby_periapsis_radius(meta, body_id, physics)


def compute_local_branch_values(
    meta: dict,
    bodies: dict[str, dict],
    transfer_config: dict,
    expected: dict[str, float],
    branch_mode: str,
) -> dict[str, float]:
    physics = get_pack_physics(bodies)
    origin_id = transfer_config.get("originBody")
    central_body_id = meta.get("centralBody")
    calculated = {}

    for body_id in expected:
        body = bodies[body_id]
        periapsis = get_periapsis_radius_for_branch(meta, body_id, physics, branch_mode)
        body_mu = physics[body_id]["mu"]
        base_escape = hyperbolic_departure_burn(body_mu, periapsis, 0.0)

        if branch_mode == "outbound":
            calculated[body_id] = base_escape
            continue

        if body_id == origin_id:
            v_inf = 0.0
        elif body["parent"] == central_body_id:
            context = compute_interplanetary_context(origin_id, body_id, bodies, central_body_id, physics)
            v_inf = context.vinf_arrive_coplanar
        else:
            parent = bodies[body["parent"]]
            parent_mu = physics[parent["id"]]["mu"]
            parent_low_orbit = low_orbit_radius(meta, parent["id"], physics)
            moon_orbit_radius = orbital_radius(body, "apoapsis")
            _, transfer_arrive_speed = hohmann_transfer_speeds(
                parent_mu, parent_low_orbit, moon_orbit_radius
            )
            moon_orbit_speed = orbital_speed(parent_mu, body["orbit"]["sma"], moon_orbit_radius)
            v_inf = abs(moon_orbit_speed - transfer_arrive_speed)

        calculated[body_id] = hyperbolic_departure_burn(body_mu, periapsis, v_inf)

    return calculated


def print_heading(title: str) -> None:
    print(f"\n{title}")
    print("-" * len(title))


def print_table(title: str, rows: list[dict[str, object]]) -> None:
    print_heading(title)
    print(
        f"{'Body':<10} {'Calc':>10} {'Expected':>10} {'Diff':>10}"
    )
    for row in rows:
        print(
            f"{row['body']:<10} "
            f"{row['calc']:>10.1f} "
            f"{row['expected']:>10.1f} "
            f"{row['diff']:>10.1f}"
        )


def print_output_table(title: str, rows: list[dict[str, object]]) -> None:
    print_heading(title)
    print(f"{'Body':<10} {'Calc':>10}")
    for row in rows:
        print(f"{row['body']:<10} {row['calc']:>10.1f}")


def print_mode_summary(title: str, modes: list[ModeResult]) -> None:
    print_heading(title)
    print(f"{'Mode':<56} {'Mean abs diff':>14} {'Max abs diff':>14}")
    for mode in modes:
        print(f"{mode.label:<56} {mode.mean_abs_diff:>14.1f} {mode.max_abs_diff:>14.1f}")


def print_transfer_breakdown(title: str, mode: ModeResult, bodies: dict[str, dict], expected: dict[str, float]) -> None:
    print_heading(title)
    print(
        f"{'Body':<10} {'Escape':>10} {'Plane chg':>10} {'Total':>10} {'Expected':>10} {'Diff':>10}"
    )
    for body_id in expected:
        total = mode.values[body_id]
        coplanar = mode.coplanar_values[body_id]
        plane_change = mode.plane_change_values[body_id]
        diff = total - expected[body_id]
        print(
            f"{bodies[body_id]['label']:<10} "
            f"{coplanar:>10.1f} "
            f"{plane_change:>10.1f} "
            f"{total:>10.1f} "
            f"{expected[body_id]:>10.1f} "
            f"{diff:>10.1f}"
        )


def print_combined_breakdown(
    title: str,
    transfer_mode: ModeResult,
    capture_values: dict[str, float],
    bodies: dict[str, dict],
    expected: dict[str, float],
) -> tuple[float, float]:
    print_heading(title)
    print(
        f"{'Body':<10} {'Transfer':>10} {'Capture':>10} {'Total':>10} {'Expected':>10} {'Diff':>10}"
    )
    rows = []
    for body_id in expected:
        transfer = transfer_mode.values[body_id]
        capture = capture_values[body_id]
        total = transfer + capture
        diff = total - expected[body_id]
        rows.append(diff)
        print(
            f"{bodies[body_id]['label']:<10} "
            f"{transfer:>10.1f} "
            f"{capture:>10.1f} "
            f"{total:>10.1f} "
            f"{expected[body_id]:>10.1f} "
            f"{diff:>10.1f}"
        )
    diffs = [abs(value) for value in rows]
    return mean(diffs), max(diffs)


def print_full_route_breakdown(
    title: str,
    route_rows: list[dict[str, object]],
) -> tuple[float, float]:
    print_heading(title)
    print(
        f"{'Body':<10} {'Surf->Orb':>10} {'Orig Esc':>10} {'Transfer':>10} "
        f"{'Capture':>10} {'Land':>10} {'Total':>10} {'Expected':>10} {'Diff':>10}"
    )
    diffs = []
    for row in route_rows:
        diff = float(row["diff"])
        diffs.append(abs(diff))
        print(
            f"{row['body']:<10} "
            f"{row['surface_to_orbit']:>10.1f} "
            f"{row['origin_escape']:>10.1f} "
            f"{row['transfer']:>10.1f} "
            f"{row['capture']:>10.1f} "
            f"{row['land']:>10.1f} "
            f"{row['calc']:>10.1f} "
            f"{row['expected']:>10.1f} "
            f"{diff:>10.1f}"
        )
    return mean(diffs), max(diffs)


def is_planet_row(row: dict[str, object]) -> bool:
    return bool(row.get("is_planet"))


def is_moon_row(row: dict[str, object]) -> bool:
    return bool(row.get("is_moon"))


def print_interplanetary_breakdown(title: str, mode: ModeResult, bodies: dict[str, dict], expected: dict[str, float]) -> None:
    print_heading(title)
    print(
        f"{'Body':<10} {'Coplanar':>10} {'Plane chg':>10} {'Total':>10} {'Expected':>10} {'Diff':>10}"
    )
    for body_id in expected:
        total = mode.values[body_id]
        coplanar = mode.coplanar_values[body_id]
        plane_change = mode.plane_change_values[body_id]
        diff = total - expected[body_id]
        print(
            f"{bodies[body_id]['label']:<10} "
            f"{coplanar:>10.1f} "
            f"{plane_change:>10.1f} "
            f"{total:>10.1f} "
            f"{expected[body_id]:>10.1f} "
            f"{diff:>10.1f}"
        )


def run_pack(pack_path: Path, reference_values: dict) -> None:
    meta, bodies, transfer_config = load_pack(pack_path)
    require_pack_support(meta, bodies)
    pack_name = get_pack_name(meta)
    pack_refs = reference_values.get(pack_name, {})
    transfer_expected = {
        body_id: float(value)
        for body_id, value in (pack_refs.get("escapeIntercept") or {}).items()
        if body_id in bodies
    }
    surface_to_surface_expected = {
        body_id: float(value)
        for body_id, value in (pack_refs.get("surfaceToSurface") or {}).items()
        if body_id in bodies
    }

    print(f"Pack:            {pack_path}")
    print(f"Reference image: {get_reference_image(pack_name)}")
    if pack_name == "rss":
        print("Low orbit rule:  pack-specific low-orbit altitudes taken from the RSS map labels")
    else:
        print("Low orbit rule:  10 km above atmosphere or terrain obstacles")

    comparison_ids = surface_to_surface_expected or transfer_expected
    outbound_calculated = compute_local_branch_values(meta, bodies, transfer_config, comparison_ids, "outbound")
    inbound_calculated = compute_local_branch_values(meta, bodies, transfer_config, comparison_ids, "inbound")
    outbound_rows = [
        {"body": bodies[body_id]["label"], "calc": outbound_calculated[body_id]}
        for body_id in comparison_ids
    ]
    inbound_rows = [
        {"body": bodies[body_id]["label"], "calc": inbound_calculated[body_id]}
        for body_id in comparison_ids
    ]
    print_output_table("Orbit -> Escape Output", outbound_rows)
    print_output_table("Flyby -> Capture Output", inbound_rows)

    if transfer_expected:
        transfer_mode = build_escape_to_intercept_mode(meta, bodies, transfer_config, transfer_expected)
        transfer_values = transfer_mode.values
        print_transfer_breakdown(
            f"Escape -> Intercept Validation ({transfer_mode.label})",
            transfer_mode,
            bodies,
            transfer_expected,
        )
        transfer_rows = [
            {
                "body": bodies[body_id]["label"],
                "diff": transfer_mode.values[body_id] - transfer_expected[body_id],
                "is_planet": bodies[body_id]["parent"] == meta.get("centralBody"),
                "is_moon": bodies[body_id]["parent"] not in {None, meta.get("centralBody")},
            }
            for body_id in transfer_expected
        ]
        print(f"\nEscape -> Intercept mean abs diff: {transfer_mode.mean_abs_diff:.1f} m/s")
        print(f"Escape -> Intercept max abs diff:  {transfer_mode.max_abs_diff:.1f} m/s")
        planet_transfer_stats = summarize_filtered_errors(transfer_rows, is_planet_row)
        moon_transfer_stats = summarize_filtered_errors(transfer_rows, is_moon_row)
        if planet_transfer_stats:
            print(f"Escape -> Intercept planets mean abs diff: {planet_transfer_stats[0]:.1f} m/s")
            print(f"Escape -> Intercept planets max abs diff:  {planet_transfer_stats[1]:.1f} m/s")
        if moon_transfer_stats:
            print(f"Escape -> Intercept moons mean abs diff:   {moon_transfer_stats[0]:.1f} m/s")
            print(f"Escape -> Intercept moons max abs diff:    {moon_transfer_stats[1]:.1f} m/s")

        if surface_to_surface_expected and pack_name != "rss":
            origin_id = transfer_config.get("originBody")
            origin_surface_to_orbit = float((bodies[origin_id].get("surface") or {}).get("dvToOrbit", 0.0) or 0.0)
            origin_escape = outbound_calculated[origin_id] if origin_id in outbound_calculated else compute_local_branch_values(
                meta, bodies, transfer_config, {origin_id: 0.0}, "outbound"
            )[origin_id]
            route_rows = []
            for body_id in surface_to_surface_expected:
                destination_land = float((bodies[body_id].get("surface") or {}).get("dvToLand", 0.0) or 0.0)
                target = bodies[body_id]
                transfer_chain = []
                ancestor_id = body_id
                while True:
                    parent_id = bodies[ancestor_id]["parent"]
                    if parent_id is None:
                        break
                    if parent_id == origin_id:
                        transfer_chain.insert(0, ancestor_id)
                        break
                    if parent_id == meta.get("centralBody"):
                        transfer_chain.insert(0, ancestor_id)
                        break
                    transfer_chain.insert(0, ancestor_id)
                    ancestor_id = parent_id

                transfer_total = sum(transfer_values.get(segment_id, 0.0) for segment_id in transfer_chain)
                include_origin_escape = target["parent"] != origin_id
                component_origin_escape = origin_escape if include_origin_escape else 0.0
                capture_total = inbound_calculated.get(body_id, 0.0)
                calc_total = (
                    origin_surface_to_orbit
                    + component_origin_escape
                    + transfer_total
                    + capture_total
                    + destination_land
                )
                route_rows.append(
                    {
                        "body": bodies[body_id]["label"],
                        "surface_to_orbit": origin_surface_to_orbit,
                        "origin_escape": component_origin_escape,
                        "transfer": transfer_total,
                        "capture": capture_total,
                        "land": destination_land,
                        "calc": calc_total,
                        "expected": surface_to_surface_expected[body_id],
                        "diff": calc_total - surface_to_surface_expected[body_id],
                        "is_planet": bodies[body_id]["parent"] == meta.get("centralBody"),
                        "is_moon": bodies[body_id]["parent"] not in {None, meta.get("centralBody")},
                    }
                )

            full_mean_abs, full_max_abs = print_full_route_breakdown(
                "Surface -> Surface Validation",
                route_rows,
            )
            print(f"\nSurface -> Surface mean abs diff: {full_mean_abs:.1f} m/s")
            print(f"Surface -> Surface max abs diff:  {full_max_abs:.1f} m/s")
            planet_surface_stats = summarize_filtered_errors(route_rows, is_planet_row)
            moon_surface_stats = summarize_filtered_errors(route_rows, is_moon_row)
            if planet_surface_stats:
                print(f"Surface -> Surface planets mean abs diff: {planet_surface_stats[0]:.1f} m/s")
                print(f"Surface -> Surface planets max abs diff:  {planet_surface_stats[1]:.1f} m/s")
            if moon_surface_stats:
                print(f"Surface -> Surface moons mean abs diff:   {moon_surface_stats[0]:.1f} m/s")
                print(f"Surface -> Surface moons max abs diff:    {moon_surface_stats[1]:.1f} m/s")

    if pack_name == "rss" and transfer_expected:
        combined_expected = {
            body_id: transfer_expected[body_id] + get_node_value(bodies[body_id], "orbit")
            for body_id in transfer_expected
            if get_node_value(bodies[body_id], "orbit") is not None
        }
        capture_values = {
            body_id: inbound_calculated[body_id]
            for body_id in combined_expected
        }
        combined_mean_abs, combined_max_abs = print_combined_breakdown(
            "Escape -> Orbit Validation (Escape -> Intercept + Flyby -> Capture)",
            transfer_mode,
            capture_values,
            bodies,
            combined_expected,
        )
        print(f"\nEscape -> Orbit mean abs diff: {combined_mean_abs:.1f} m/s")
        print(f"Escape -> Orbit max abs diff:  {combined_max_abs:.1f} m/s")


def main() -> None:
    reference_values = load_reference_values()
    pack_paths = [
        ROOT / "data" / "opm.json",
        ROOT / "data" / "rss.json",
    ]

    for index, pack_path in enumerate(pack_paths):
        if index > 0:
            print("\n" + ("=" * 100) + "\n")
        run_pack(pack_path.resolve(), reference_values)


if __name__ == "__main__":
    main()
