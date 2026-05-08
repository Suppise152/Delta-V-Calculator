# Delta-V Calculator

http://suppise-dv-calculator.com/

## How to Use this Site

This is an interactive Delta-V map. Simply click on a node on a branch to determine the target planet, and how you would like to explore it. Toggle the checkboxes to tweak the calculations to your mission parameters, and the required Delta-V values as well as the relevant transfer angles are displayed in real time.

## Using a Delta-V Map

To use a typical Delta-V map, you add all the values along the branch, from your starting position to your target position. A white arrow in the direction of your travel means you can aerobrake there and can therefore exclude the value from your calculation. The values above a branch indicate plane changes. This site performs all these calculations for you.

## What is Delta-V?

Delta-V is a craft's capacity to change its velocity, and can be interpreted as the range of a given craft. Similar to how a car may say it has 50 km of fuel left, a spacecraft may have 5000 m/s of Delta-V left. Performing manoeuvres such as changing your orbit or landing on a planet will use up some of your Delta-V. Knowing how much Delta-V is required to perform a given task is essential for planning any mission.

## The Mathematics

Rather than a look-up table, this site dynamically calculates the required Delta-V for each mission profile. After the route is selected, the calculator evaluates it using four primary calculation blocks.

In the expressions below:

- `mu = GM` is the standard gravitational parameter of the relevant central body.
- `r` is the relevant orbital or parking-orbit radius.
- `a` is the semi-major axis of the transfer ellipse.

### Orbit to Escape

For a circular parking orbit of radius `r0`, the local orbital speed is:

```text
v_circ = sqrt(mu / r0)
```

Pure escape from that radius requires:

```text
v_esc = sqrt(2mu / r0)
```

This gives the ideal escape burn:

```text
Delta-v_esc = v_esc - v_circ
```

Including hyperbolic excess velocity `v_inf`, the escape burn becomes:

```text
Delta-v_ej = sqrt(v_inf^2 + 2mu / r0) - sqrt(mu / r0)
```

### Interplanetary Transfer A-B

The interplanetary leg is modeled as an ideal coplanar Hohmann transfer from orbit A to orbit B. The transfer semi-major axis is:

```text
a_t = (r_A + r_B) / 2
```

The circular speeds are:

```text
v_A = sqrt(mu / r_A)
v_B = sqrt(mu / r_B)
```

The transfer-orbit speeds at the two ends are:

```text
v_t,A = sqrt(mu(2 / r_A - 1 / a_t))
v_t,B = sqrt(mu(2 / r_B - 1 / a_t))
```

The ideal heliocentric burns are therefore:

```text
Delta-v_A = |v_t,A - v_A|
Delta-v_B = |v_B - v_t,B|
```

### Capture to Low Orbit

On arrival, let the incoming hyperbolic excess velocity relative to the target be `v_inf`. At periapsis radius `r_p`, the hyperbolic periapsis speed is:

```text
v_p,hyp = sqrt(v_inf^2 + 2mu / r_p)
```

The circular low-orbit speed at that same radius is:

```text
v_circ,p = sqrt(mu / r_p)
```

The ideal capture burn is then:

```text
Delta-v_cap = v_p,hyp - v_circ,p
```

### Transfer Windows

The Hohmann transfer time between two circular orbits is:

```text
t_trans = pi * sqrt(a_t^3 / mu)
```

The corresponding mean motions are:

```text
n_A = sqrt(mu / r_A^3)
n_B = sqrt(mu / r_B^3)
```

The required departure phase angle for A to B is:

```text
phi_A->B = pi - n_B * t_trans
```

The reverse transfer is:

```text
phi_B->A = pi - n_A * t_trans
```

Converting to degrees gives:

```text
phi_deg = phi * 180 / pi
```

This assumes the target is ahead of the origin in its orbit.

## Assumptions

The calculator makes the following explicit assumptions:

1. All transfer-window solutions are ideal two-body Hohmann transfers between the selected orbital radii.
2. Departure and arrival burns are treated as impulsive burns rather than finite-duration burns.
3. Mean motion is taken from sidereal period where available, otherwise reconstructed from `mu` and semi-major axis.
4. Interplanetary transfer geometry is evaluated from orbital radii rather than a full Lambert solution over arbitrary departure dates.
5. Hyperbolic departure and capture are modeled with patched conics.
6. Local parking orbits are treated as circular for low-orbit, escape, and capture calculations.
7. Low-orbit radius is 10km above the planet's surface or atmosphere.
8. Flyby or capture periapsis is 10km above the planet's surface or atmosphere.
9. Escape and capture burns are evaluated at periapsis.
10. Pure local escape assumes `v_inf = 0`.
11. For top-level interplanetary transfers, departure-side `v_inf = |v_t,A - v_A|`.
12. For top-level interplanetary arrivals, arrival-side `v_inf = |v_B - v_t,B|`.
13. Where orbital planes differ, the burn is combined with a plane-change rotation rather than treating it as a separate manoeuvre.
14. Plane angle is derived from the relative inclination and longitude of ascending node only.
15. Plane-change cost uses the impulsive approximation `Delta-v = 2v sin(theta / 2)` at the speed chosen for that branch.
16. Surface-to-orbit and orbit-to-surface costs are taken from body data rather than being derived from thrust, drag, gravity turn, or entry simulation.
17. Thrust limits, steering losses, long-burn Oberth inefficiency, and staging transients are ignored.
18. Aerobraking conditions remove the entire Delta-V cost for the relevant branch.
