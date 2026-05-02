#!/usr/bin/env python3
"""Validate stock DV formulas against the current stock map data.

Assumptions taken from the bundled stock map:
- low orbit is 10 km above atmosphere or terrain obstacles
- orbit -> escape burns happen at periapsis
- interplanetary legs are Hohmann-style transfers

The script uses the current `data/stock.json` node values as the expected
reference values that back the stock map in `assets/images/stock.png`.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from statistics import mean


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PACK_PATH = ROOT / "data" / "stock.json"
REFERENCE_IMAGE_PATH = ROOT / "assets" / "images" / "stock.png"
LOW_ORBIT_BUFFER_METERS = 10_000.0


STOCK_PHYSICS = {
    "kerbol": {"radius": 261_600_000.0, "mu": 1.1723328e18, "atmosphere": 0.0},
    "moho": {"radius": 250_000.0, "mu": 1.6860938e11, "atmosphere": 0.0},
    "eve": {"radius": 700_000.0, "mu": 8.1717302e12, "atmosphere": 90_000.0},
    "gilly": {"radius": 13_000.0, "mu": 8.2894498e6, "atmosphere": 0.0},
    "kerbin": {"radius": 600_000.0, "mu": 3.5316e12, "atmosphere": 70_000.0},
    "mun": {"radius": 200_000.0, "mu": 6.5138398e10, "atmosphere": 0.0},
    "minmus": {"radius": 60_000.0, "mu": 1.7658e9, "atmosphere": 0.0},
    "duna": {"radius": 320_000.0, "mu": 3.0136321e11, "atmosphere": 50_000.0},
    "ike": {"radius": 130_000.0, "mu": 1.8568369e10, "atmosphere": 0.0},
    "dres": {"radius": 138_000.0, "mu": 2.1484489e10, "atmosphere": 0.0},
    "jool": {"radius": 6_000_000.0, "mu": 2.82528e14, "atmosphere": 200_000.0},
    "laythe": {"radius": 500_000.0, "mu": 1.962e12, "atmosphere": 50_000.0},
    "vall": {"radius": 300_000.0, "mu": 2.074815e11, "atmosphere": 0.0},
    "tylo": {"radius": 600_000.0, "mu": 2.82528e12, "atmosphere": 0.0},
    "bop": {"radius": 65_000.0, "mu": 2.4868349e9, "atmosphere": 0.0},
    "pol": {"radius": 44_000.0, "mu": 7.2170208e8, "atmosphere": 0.0},
    "eeloo": {"radius": 210_000.0, "mu": 7.4410815e10, "atmosphere": 0.0},
}


@dataclass(frozen=True)
class ModeResult:
    name: str
    label: str
    values: dict[str, float]
    mean_abs_diff: float
    max_abs_diff: float


def load_pack(pack_path: Path) -> tuple[dict, dict[str, dict], dict]:
    with pack_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    bodies = {body["id"]: body for body in payload["bodies"]}
    return payload["meta"], bodies, payload.get("transferConfig", {})


def require_stock_support(meta: dict, bodies: dict[str, dict]) -> None:
    pack_name = meta.get("pack")
    missing = sorted(body_id for body_id in bodies if body_id not in STOCK_PHYSICS)
    if pack_name != "stock" or missing:
        missing_text = ", ".join(missing) if missing else "unknown bodies"
        raise SystemExit(
            "This validator currently supports only data/stock.json with the bundled "
            f"stock-body constants. Missing support for: {missing_text}"
        )


def low_orbit_radius(body_id: str) -> float:
    body = STOCK_PHYSICS[body_id]
    return body["radius"] + body["atmosphere"] + LOW_ORBIT_BUFFER_METERS


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
        mean_abs_diff=mean(diffs),
        max_abs_diff=max(diffs),
    )


def compute_interplanetary_context(
    origin_id: str,
    target_id: str,
    bodies: dict[str, dict],
) -> dict[str, float]:
    origin = bodies[origin_id]
    target = bodies[target_id]
    star_mu = STOCK_PHYSICS["kerbol"]["mu"]

    origin_radius = origin["orbit"]["sma"]
    target_radius = target["orbit"]["sma"]
    origin_speed = circular_speed(star_mu, origin_radius)
    target_speed = circular_speed(star_mu, target_radius)
    transfer_depart_speed, transfer_arrive_speed = hohmann_transfer_speeds(
        star_mu, origin_radius, target_radius
    )
    angle = plane_angle(origin, target)

    return {
        "plane_angle": angle,
        "origin_speed": origin_speed,
        "target_speed": target_speed,
        "transfer_depart_speed": transfer_depart_speed,
        "transfer_arrive_speed": transfer_arrive_speed,
        "vinf_depart_coplanar": abs(transfer_depart_speed - origin_speed),
        "vinf_depart_combined": relative_speed(origin_speed, transfer_depart_speed, angle),
        "vinf_arrive_coplanar": abs(target_speed - transfer_arrive_speed),
        "vinf_arrive_combined": relative_speed(target_speed, transfer_arrive_speed, angle),
    }


def build_interplanetary_modes(
    bodies: dict[str, dict],
    transfer_config: dict,
) -> tuple[list[ModeResult], dict[str, float]]:
    origin_id = transfer_config.get("originBody", "kerbin")
    origin = bodies[origin_id]
    origin_periapsis = low_orbit_radius(origin_id)
    origin_mu = STOCK_PHYSICS[origin_id]["mu"]
    base_escape = hyperbolic_departure_burn(origin_mu, origin_periapsis, 0.0)

    expected = {
        body_id: body["nodes"]["intercept"]
        for body_id, body in bodies.items()
        if body["parent"] == "kerbol" and body_id not in {"kerbol", origin_id}
    }

    mode_values = {
        "Coplanar extra + piecewise transfer plane change": {},
        "Combined vector departure": {},
        "Coplanar extra only": {},
        "Coplanar extra + departure circular plane change": {},
        "Coplanar extra + departure transfer plane change": {},
        "Coplanar extra + arrival circular plane change": {},
        "Coplanar extra + arrival transfer plane change": {},
        "Coplanar extra + minimum-speed plane change": {},
    }

    for body_id in expected:
        context = compute_interplanetary_context(origin_id, body_id, bodies)
        angle = context["plane_angle"]
        total_combined = hyperbolic_departure_burn(
            origin_mu,
            origin_periapsis,
            context["vinf_depart_combined"],
        )
        coplanar_total = hyperbolic_departure_burn(
            origin_mu,
            origin_periapsis,
            context["vinf_depart_coplanar"],
        )
        coplanar_extra = coplanar_total - base_escape

        departure_circular_pc = plane_change_delta_v(context["origin_speed"], angle)
        departure_transfer_pc = plane_change_delta_v(context["transfer_depart_speed"], angle)
        arrival_circular_pc = plane_change_delta_v(context["target_speed"], angle)
        arrival_transfer_pc = plane_change_delta_v(context["transfer_arrive_speed"], angle)
        min_speed_pc = min(
            departure_circular_pc,
            departure_transfer_pc,
            arrival_circular_pc,
            arrival_transfer_pc,
        )
        piecewise_transfer_pc = (
            arrival_transfer_pc
            if bodies[body_id]["orbit"]["sma"] < bodies[origin_id]["orbit"]["sma"]
            else departure_transfer_pc
        )

        mode_values["Coplanar extra + piecewise transfer plane change"][body_id] = (
            coplanar_extra + piecewise_transfer_pc
        )
        mode_values["Combined vector departure"][body_id] = total_combined - base_escape
        mode_values["Coplanar extra only"][body_id] = coplanar_extra
        mode_values["Coplanar extra + departure circular plane change"][body_id] = (
            coplanar_extra + departure_circular_pc
        )
        mode_values["Coplanar extra + departure transfer plane change"][body_id] = (
            coplanar_extra + departure_transfer_pc
        )
        mode_values["Coplanar extra + arrival circular plane change"][body_id] = (
            coplanar_extra + arrival_circular_pc
        )
        mode_values["Coplanar extra + arrival transfer plane change"][body_id] = (
            coplanar_extra + arrival_transfer_pc
        )
        mode_values["Coplanar extra + minimum-speed plane change"][body_id] = (
            coplanar_extra + min_speed_pc
        )

    modes = [summarize_mode(label, values, expected) for label, values in mode_values.items()]
    modes.sort(key=lambda item: (item.mean_abs_diff, item.max_abs_diff, item.label))
    return modes, expected


def compute_orbit_escape_values(
    bodies: dict[str, dict],
    transfer_config: dict,
) -> tuple[dict[str, float], dict[str, float]]:
    origin_id = transfer_config.get("originBody", "kerbin")
    expected = {}
    calculated = {}

    for body_id, body in bodies.items():
        if body_id == "kerbol":
            continue

        periapsis = low_orbit_radius(body_id)
        body_mu = STOCK_PHYSICS[body_id]["mu"]
        expected[body_id] = float(body["nodes"]["orbit"])

        if body_id == origin_id:
            v_inf = 0.0
        elif body["parent"] == "kerbol":
            context = compute_interplanetary_context(origin_id, body_id, bodies)
            v_inf = context["vinf_arrive_coplanar"]
        else:
            parent = bodies[body["parent"]]
            parent_mu = STOCK_PHYSICS[parent["id"]]["mu"]
            parent_low_orbit = low_orbit_radius(parent["id"])
            moon_orbit_radius = body["orbit"]["sma"]
            transfer_depart_speed, transfer_arrive_speed = hohmann_transfer_speeds(
                parent_mu, parent_low_orbit, moon_orbit_radius
            )
            parent_low_orbit_speed = circular_speed(parent_mu, parent_low_orbit)
            moon_orbit_speed = circular_speed(parent_mu, moon_orbit_radius)

            v_inf = abs(moon_orbit_speed - transfer_arrive_speed)

            # Keep the departure-side values available for debugging symmetry checks.
            _ = abs(parent_low_orbit_speed - transfer_depart_speed)

        calculated[body_id] = hyperbolic_departure_burn(body_mu, periapsis, v_inf)

    return calculated, expected


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


def print_mode_summary(modes: list[ModeResult]) -> None:
    print_heading("Interplanetary Mode Summary")
    print(f"{'Mode':<56} {'Mean abs diff':>14} {'Max abs diff':>14}")
    for mode in modes:
        print(f"{mode.label:<56} {mode.mean_abs_diff:>14.1f} {mode.max_abs_diff:>14.1f}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare stock DV formulas against the bundled stock map values."
    )
    parser.add_argument(
        "--pack",
        default=str(DEFAULT_PACK_PATH),
        help="Path to the pack JSON to validate. Only stock is currently supported.",
    )
    args = parser.parse_args()

    pack_path = Path(args.pack).resolve()
    meta, bodies, transfer_config = load_pack(pack_path)
    require_stock_support(meta, bodies)

    print(f"Pack:            {pack_path}")
    print(f"Reference image: {REFERENCE_IMAGE_PATH}")
    print("Low orbit rule:  10 km above atmosphere or terrain obstacles")

    orbit_calculated, orbit_expected = compute_orbit_escape_values(bodies, transfer_config)
    orbit_rows = [
        {
            "body": bodies[body_id]["label"],
            "calc": orbit_calculated[body_id],
            "expected": orbit_expected[body_id],
            "diff": orbit_calculated[body_id] - orbit_expected[body_id],
        }
        for body_id in orbit_expected
    ]
    print_table("Orbit -> Escape Validation", orbit_rows)
    orbit_mean_abs = mean(abs(row["diff"]) for row in orbit_rows)
    orbit_max_abs = max(abs(row["diff"]) for row in orbit_rows)
    print(f"\nOrbit mean abs diff: {orbit_mean_abs:.1f} m/s")
    print(f"Orbit max abs diff:  {orbit_max_abs:.1f} m/s")

    modes, intercept_expected = build_interplanetary_modes(bodies, transfer_config)
    print_mode_summary(modes)

    best_mode = modes[0]
    intercept_rows = [
        {
            "body": bodies[body_id]["label"],
            "calc": best_mode.values[body_id],
            "expected": intercept_expected[body_id],
            "diff": best_mode.values[body_id] - intercept_expected[body_id],
        }
        for body_id in intercept_expected
    ]
    print_table(f"Kerbin Escape -> Intercept Validation ({best_mode.label})", intercept_rows)
    print(f"\nBest mode mean abs diff: {best_mode.mean_abs_diff:.1f} m/s")
    print(f"Best mode max abs diff:  {best_mode.max_abs_diff:.1f} m/s")


if __name__ == "__main__":
    main()
