/**
 * ui.js bootstraps the app and wires the main DOM interactions.
 * Calculator outputs remain placeholders until the backend is connected.
 */

document.addEventListener('DOMContentLoaded', () => {
    loadPack('stock');
    initSlider();
});

let _originBodyId = null;

async function loadPack(packId) {
    try {
        const res = await fetch(`data/${packId}.json`);
        const data = await res.json();
        _originBodyId = data.meta?.originBody ?? null;
        initMap(data);
        if (typeof refreshTransferDisplay === 'function') refreshTransferDisplay();
    } catch (e) {
        console.error('Failed to load pack:', packId, e);
        const c = document.getElementById('map-container');
        c.innerHTML = '<div class="map-placeholder"><span>Failed to load map data.</span></div>';
    }
}

function onNodeClick(bodyId, nodeKey) {
    setPointB(bodyId, nodeKey);
    document.getElementById('dV_display').value = '—';
    if (typeof refreshTransferDisplay === 'function') refreshTransferDisplay();
}

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

function handleToggleChange(id) {
    const t1 = document.getElementById('toggle1');
    const t4 = document.getElementById('toggle4');
    const t7 = document.getElementById('toggle7');

    switch (id) {
        case 'toggle1':
            if (t1.checked) t4.checked = false;
            refreshMapDisplay();
            _refreshTransferUi();
            break;

        case 'toggle4':
            if (t4.checked) t1.checked = false;
            refreshMapDisplay();
            _refreshTransferUi();
            break;

        case 'toggle7':
            if (!_originBodyId) break;
            if (t7.checked) {
                setPointA(_originBodyId, 'orbit');
            } else {
                setPointA(_originBodyId, 'land');
            }
            _refreshTransferUi();
            break;

        case 'toggle2':
            if (document.getElementById('toggle2').checked) {
                document.getElementById('toggle3').checked = false;
            }
            refreshMapDisplay();
            _refreshTransferUi();
            break;

        case 'toggle3':
            if (document.getElementById('toggle3').checked) {
                document.getElementById('toggle2').checked = false;
            }
            refreshMapDisplay();
            _refreshTransferUi();
            break;

        case 'toggle5':
            if (document.getElementById('toggle5').checked) {
                document.getElementById('toggle6').checked = false;
            }
            refreshMapDisplay();
            _refreshTransferUi();
            break;

        case 'toggle6':
            if (document.getElementById('toggle6').checked) {
                document.getElementById('toggle5').checked = false;
            }
            refreshMapDisplay();
            _refreshTransferUi();
            break;

        case 'toggle8': {
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
}

function _refreshTransferUi() {
    if (typeof refreshTransferDisplay === 'function') refreshTransferDisplay();
}
