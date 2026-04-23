/**
 * ui.js — bootstraps the app, wires DOM to map module.
 * Calculator logic is stubbed — results display placeholder values.
 * Toggle wiring for map display (round trip, return only, LKO) is fully active.
 */

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadPack('stock');
    initSlider();
});

// ─── Pack Loading ─────────────────────────────────────────────────────────────

async function loadPack(packId) {
    try {
        const res = await fetch(`data/${packId}.json`);
        const data = await res.json();
        initMap(data);
    } catch (e) {
        console.error('Failed to load pack:', packId, e);
        const c = document.getElementById('map-container');
        c.innerHTML = '<div class="map-placeholder"><span>Failed to load map data.</span></div>';
    }
}

// ─── Node Click (called by map.js) ───────────────────────────────────────────

function onNodeClick(bodyId, nodeKey) {
    setPointB(bodyId, nodeKey);

    // Stub: clear display until calculator is wired
    document.getElementById('dV_display').value = '—';
    document.getElementById('arrival_angle').value = '—';
    document.getElementById('departure_angle').value = '—';
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function initSlider() {
    const slider = document.getElementById('slider');
    slider.value = 0;
    handleSliderChange(slider);
}

function handleSliderChange(slider) {
    const labels = [
        '+ 0% Redundancy', '+ 10% Redundancy', '+ 15% Redundancy',
        '+ 25% Redundancy', '+ 35% Redundancy', '+ 50% Redundancy',
    ];
    document.getElementById('slider-value').textContent = labels[slider.value] || labels[0];
}

// ─── Toggle handling ──────────────────────────────────────────────────────────

function handleToggleChange(id) {
    const t1 = document.getElementById('toggle1'); // round trip
    const t4 = document.getElementById('toggle4'); // return only
    const t7 = document.getElementById('toggle7'); // from LKO

    switch (id) {

        case 'toggle1': // round trip
            if (t1.checked) t4.checked = false;
            refreshMapDisplay();
            break;

        case 'toggle4': // return only
            if (t4.checked) {
                t1.checked = false;
                // Disable arrival aerobrakes — irrelevant for return only
                document.getElementById('toggle2').checked = false;
                document.getElementById('toggle2').disabled = true;
                document.getElementById('toggle3').checked = false;
                document.getElementById('toggle3').disabled = true;
            } else {
                document.getElementById('toggle2').disabled = false;
                document.getElementById('toggle3').disabled = false;
            }
            refreshMapDisplay();
            break;

        case 'toggle7': // calculate from LKO
            // Shifts pointA between interplanetary hub and kerbin_orbit
            if (t7.checked) {
                setPointA('kerbin', 'orbit');
            } else {
                setPointA('interplanetary', null);
            }
            break;

        case 'toggle2': // aerobrake low orbit arrival
            if (document.getElementById('toggle2').checked) {
                document.getElementById('toggle3').checked = false;
            }
            break;

        case 'toggle3': // aerobrake intercept arrival
            if (document.getElementById('toggle3').checked) {
                document.getElementById('toggle2').checked = false;
            }
            break;

        case 'toggle5': // aerobrake low orbit return
            if (document.getElementById('toggle5').checked) {
                document.getElementById('toggle6').checked = false;
            }
            break;

        case 'toggle6': // aerobrake intercept return
            if (document.getElementById('toggle6').checked) {
                document.getElementById('toggle5').checked = false;
            }
            break;

        case 'toggle8': // breakdown dropdown
            const dropdown = document.getElementById('dv-dropdown');
            const checkbox = document.getElementById('toggle8');
            if (checkbox.checked) {
                dropdown.classList.add('is-open');
            } else {
                dropdown.classList.remove('is-open');
            }
            break;
    }
}