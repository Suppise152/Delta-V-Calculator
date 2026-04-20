/**
 * ui.js — bootstraps the app and wires DOM to modules.
 * Calculator logic is stubbed with mock values for UI-first development.
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
        document.getElementById('map-container').innerHTML =
            '<div class="map-placeholder"><span>Failed to load map data.</span></div>';
    }
}

// ─── Node Click (called by map.js) ───────────────────────────────────────────

function onNodeClick(bodyId, nodeKey) {
    setActiveNode(bodyId, nodeKey);

    // Stub: display mock values until calculator.js is wired in
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
    const labels = ['+ 0% Redundancy', '+ 10% Redundancy', '+ 15% Redundancy',
        '+ 25% Redundancy', '+ 35% Redundancy', '+ 50% Redundancy'];
    document.getElementById('slider-value').textContent = labels[slider.value] || labels[0];
}

// ─── Toggle stubs (mutual exclusivity rules — logic to be filled in state.js) -

function handleToggleChange(id) {
    // Stub — full logic goes in state.js
    console.log('toggle changed:', id);
}