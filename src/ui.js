/**
 * ui.js bootstraps the app and wires the main DOM interactions.
 * Calculator outputs remain placeholders until the backend is connected.
 */

document.addEventListener('DOMContentLoaded', () => {
    initMapVersionControls();
    loadPack('stock');
    initSlider();
});

let _originBodyId = null;
let _loadedDataPackId = null;
let _loadedSystemData = null;
let _activePackId = 'stock';

const PACK_CONFIG = {
    stock: { dataPackId: 'stock', mapId: 'stock' },
    opm: { dataPackId: 'stock', mapId: 'opm' },
    rss: { dataPackId: 'stock', mapId: 'rss' },
};

function initMapVersionControls() {
    _setActivePackToggle(_activePackId);
}

async function loadPack(packId) {
    const config = PACK_CONFIG[packId] || PACK_CONFIG.stock;

    try {
        if (_loadedSystemData && _loadedDataPackId === config.dataPackId) {
            _activePackId = packId;
            _originBodyId = _loadedSystemData.meta?.originBody ?? null;
            setMapLayout(config.mapId);
            _setActivePackToggle(packId);
            if (typeof refreshTransferDisplay === 'function') refreshTransferDisplay();
            return;
        }

        const res = await fetch(`data/${config.dataPackId}.json`);
        const data = await res.json();
        _loadedDataPackId = config.dataPackId;
        _loadedSystemData = data;
        _activePackId = packId;
        _originBodyId = data.meta?.originBody ?? null;
        initMap(data, { mapId: config.mapId });
        _setActivePackToggle(packId);
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
        '+ 0% Redundancy', '+ 5% Redundancy', '+ 10% Redundancy', '+ 15% Redundancy', '+ 20% Redundancy',
        '+ 25% Redundancy', '+ 30% Redundancy', '+ 35% Redundancy', '+ 40% Redundancy', '+ 45% Redundancy', '+ 50% Redundancy',
    ];
    document.getElementById('slider-value').textContent = labels[slider.value] || labels[0];
}

function handleToggleChange(id) {
    const roundTripToggle = document.getElementById('roundTripToggle');
    const returnOnlyToggle = document.getElementById('returnOnlyToggle');
    const aeroLowOrbitDestToggle = document.getElementById('aeroLowOrbitDest');
    const aeroInterceptDestToggle = document.getElementById('aeroInterceptDest');
    const aeroLowOrbitOriginToggle = document.getElementById('aeroLowOrbitOrigin');
    const aeroInterceptOriginToggle = document.getElementById('aeroInterceptOrigin');
    const fromLOToggle = document.getElementById('fromLO');

    switch (id) {
        case 'roundTripToggle':
            if (roundTripToggle.checked) returnOnlyToggle.checked = false;
            refreshMapDisplay();
            _refreshTransferUi();
            break;

        case 'returnOnlyToggle':
            if (returnOnlyToggle.checked) roundTripToggle.checked = false;
            refreshMapDisplay();
            _refreshTransferUi();
            break;

        case 'fromLO':
            if (!_originBodyId) break;
            if (fromLOToggle.checked) {
                setPointA(_originBodyId, 'orbit');
            } else {
                setPointA(_originBodyId, 'land');
            }
            _refreshTransferUi();
            break;

        case 'aeroLowOrbitDest':
            if (aeroLowOrbitDestToggle.checked) {
                aeroInterceptDestToggle.checked = false;
            }
            refreshMapDisplay();
            _refreshTransferUi();
            break;

        case 'aeroInterceptDest':
            if (aeroInterceptDestToggle.checked) {
                aeroLowOrbitDestToggle.checked = false;
            }
            refreshMapDisplay();
            _refreshTransferUi();
            break;

        case 'aeroLowOrbitOrigin':
            if (aeroLowOrbitOriginToggle.checked) {
                aeroInterceptOriginToggle.checked = false;
            }
            refreshMapDisplay();
            _refreshTransferUi();
            break;

        case 'aeroInterceptOrigin':
            if (aeroInterceptOriginToggle.checked) {
                aeroLowOrbitOriginToggle.checked = false;
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

function handleMapPackChange(packId) {
    const stockCheck = document.getElementById('stockCheck');
    const opmCheck = document.getElementById('opmCheck');
    const rssCheck = document.getElementById('rssCheck');

    if (packId === 'stock') {
        stockCheck.checked = true;
        opmCheck.checked = false;
        rssCheck.checked = false;
    } else if (packId === 'opm') {
        stockCheck.checked = false;
        opmCheck.checked = true;
        rssCheck.checked = false;
    } else if (packId === 'rss') {
        stockCheck.checked = false;
        opmCheck.checked = false;
        rssCheck.checked = true;
    }
    if (packId === _activePackId) return;

    loadPack(packId);
}

function _setActivePackToggle(activePackId) {
    Object.keys(PACK_CONFIG).forEach(packId => {
        const input = document.getElementById(packId);
        if (input) input.checked = packId === activePackId;
    });
}

function _refreshTransferUi() {
    if (typeof refreshTransferDisplay === 'function') refreshTransferDisplay();
}
