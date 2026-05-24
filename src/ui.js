/**
 * ui.js bootstraps the app and wires the main DOM interactions.
 * Calculation logic lives in pure functions under calculator.js.
 */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof initAnalytics === 'function') {
        initAnalytics();
    }
    initMapVersionControls();
    loadPack('stock');
    initSlider();
    _initMobileLayoutSync();
});

let _originBodyId = null;
let _loadedDataPackId = null;
let _loadedSystemData = null;
let _activePackId = 'stock';

const PACK_CONFIG = {
    stock: { dataPackId: 'stock', mapId: 'stock' },
    opm: { dataPackId: 'opm', mapId: 'opm' },
    rss: { dataPackId: 'rss', mapId: 'rss' },
};
const MOBILE_MAP_SCROLL_EXPANSION = 1.5;
const MOBILE_MAP_VIEWBOX_EXPANSION = 1.18;

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
            _syncMobileMapViewport();
            _refreshOutputs();
            return;
        }

        const res = await fetch(`data/${config.dataPackId}.json`, { cache: 'no-store' });
        const data = _normalizeLoadedPackData(await res.json());
        _loadedDataPackId = config.dataPackId;
        _loadedSystemData = data;
        _activePackId = packId;
        _originBodyId = data.meta?.originBody ?? null;
        initMap(data, { mapId: config.mapId });
        _setActivePackToggle(packId);
        _syncMobileMapViewport();
        _refreshOutputs();
    } catch (e) {
        console.error('Failed to load pack:', packId, e);
        const c = document.getElementById('map-container');
        c.innerHTML = '<div class="map-placeholder"><span>Failed to load map data.</span></div>';
    }
}

function _normalizeLoadedPackData(data) {
    if (data?.meta?.pack !== 'rss') return data;

    const sol = data.bodies?.find((body) => body.id === 'sol');
    if (!sol) return data;

    const solSurfaceDv = 436760;
    sol.surface = sol.surface || {};
    sol.nodes = sol.nodes || {};
    sol.surface.dvToLand = solSurfaceDv;
    sol.nodes.land = solSurfaceDv;

    return data;
}

function onNodeClick(bodyId, nodeKey) {
    if (typeof trackNodeInteraction === 'function') {
        const bodies = typeof getBodies === 'function' ? getBodies() : null;
        trackNodeInteraction(bodyId, nodeKey, {
            packId: _activePackId,
            bodyLabel: bodies?.[bodyId]?.label || bodyId,
        });
    }

    setPointB(bodyId, nodeKey);
    _refreshOutputs();
}

function getActivePackId() {
    return _activePackId;
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
    _refreshOutputs();
}

function handleClearSelection() {
    [
        'roundTripToggle',
        'returnOnlyToggle',
        'fromLO',
        'aeroInterceptDest',
        'aeroLowOrbitDest',
        'aeroInterceptOrigin',
        'aeroLowOrbitOrigin',
        'toggle8',
    ].forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.checked = false;
    });

    const dropdown = document.getElementById('dv-dropdown');
    if (dropdown) dropdown.classList.remove('is-open');

    const slider = document.getElementById('slider');
    if (slider) {
        slider.value = 0;
        handleSliderChange(slider);
    }

    if (typeof clearCalculationState === 'function') {
        clearCalculationState();
    }
    if (typeof renderBreakdown === 'function') {
        renderBreakdown([]);
    }

    const dVDisplay = document.getElementById('dV_display');
    if (dVDisplay) dVDisplay.value = dVDisplay.placeholder || '';

    if (typeof resetSelection === 'function') {
        resetSelection();
    } else if (_originBodyId && typeof setPointA === 'function' && typeof setPointB === 'function') {
        setPointA(_originBodyId, 'land');
        setPointB(null, null);
    }

    _refreshOutputs();
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
            _refreshOutputs();
            break;

        case 'returnOnlyToggle':
            if (returnOnlyToggle.checked) roundTripToggle.checked = false;
            refreshMapDisplay();
            _refreshOutputs();
            break;

        case 'fromLO':
            if (!_originBodyId) break;
            if (fromLOToggle.checked) {
                setPointA(_originBodyId, 'orbit');
            } else {
                setPointA(_originBodyId, 'land');
            }
            _refreshOutputs();
            break;

        case 'aeroLowOrbitDest':
            if (aeroLowOrbitDestToggle.checked) {
                aeroInterceptDestToggle.checked = false;
            }
            refreshMapDisplay();
            _refreshOutputs();
            break;

        case 'aeroInterceptDest':
            if (aeroInterceptDestToggle.checked) {
                aeroLowOrbitDestToggle.checked = false;
            }
            refreshMapDisplay();
            _refreshOutputs();
            break;

        case 'aeroLowOrbitOrigin':
            if (aeroLowOrbitOriginToggle.checked) {
                aeroInterceptOriginToggle.checked = false;
            }
            refreshMapDisplay();
            _refreshOutputs();
            break;

        case 'aeroInterceptOrigin':
            if (aeroInterceptOriginToggle.checked) {
                aeroLowOrbitOriginToggle.checked = false;
            }
            refreshMapDisplay();
            _refreshOutputs();
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
    Object.keys(PACK_CONFIG).forEach((packId) => {
        const input = document.getElementById(`${packId}Check`);
        if (input) input.checked = packId === activePackId;
    });
}

function _refreshTransferUi() {
    if (typeof refreshTransferDisplay === 'function') refreshTransferDisplay();
}

function _refreshOutputs() {
    _refreshCalculationUi();
    _refreshTransferUi();
}

function _refreshCalculationUi() {
    const dVDisplay = document.getElementById('dV_display');
    const bodies = typeof getBodies === 'function' ? getBodies() : null;
    const selection = typeof getSelectedPoints === 'function' ? getSelectedPoints() : null;
    const meta = typeof getSystemMeta === 'function' ? getSystemMeta() : null;

    if (!dVDisplay || !bodies || !selection?.pointA?.body || !selection?.pointB?.body || !meta) {
        if (typeof clearCalculationState === 'function') {
            clearCalculationState();
        }
        if (typeof renderBreakdown === 'function') {
            renderBreakdown([]);
        }
        if (typeof renderDebugView === 'function') {
            renderDebugView(null);
        }
        if (dVDisplay) {
            dVDisplay.value = dVDisplay.placeholder || '';
        }
        return;
    }

    const options = _buildCalculationOptions();
    const result = typeof jscalculate === 'function'
        ? jscalculate(selection.pointA, selection.pointB, options, bodies, meta)
        : null;

    if (typeof setCalculationState === 'function') {
        setCalculationState(result, options);
    }

    if (!result) {
        dVDisplay.value = dVDisplay.placeholder || '';
        if (typeof renderBreakdown === 'function') {
            renderBreakdown([]);
        }
        if (typeof renderDebugView === 'function') {
            renderDebugView(null);
        }
        return;
    }

    dVDisplay.value = `${result.totalDV.toLocaleString()} m/s`;
    if (typeof renderBreakdown === 'function') {
        renderBreakdown(result.breakdown);
    }
    if (typeof renderDebugView === 'function') {
        renderDebugView(result);
    }
}

function _buildCalculationOptions() {
    return {
        roundTrip: document.getElementById('roundTripToggle')?.checked ?? false,
        returnOnly: document.getElementById('returnOnlyToggle')?.checked ?? false,
        fromLowOrbit: document.getElementById('fromLO')?.checked ?? false,
        aeroLowOrbitDest: document.getElementById('aeroLowOrbitDest')?.checked ?? false,
        aeroInterceptDest: document.getElementById('aeroInterceptDest')?.checked ?? false,
        aeroLowOrbitOrigin: document.getElementById('aeroLowOrbitOrigin')?.checked ?? false,
        aeroInterceptOrigin: document.getElementById('aeroInterceptOrigin')?.checked ?? false,
        redundancyMultiplier: _getRedundancyMultiplier(),
        ipsBranchDV: 1000,
    };
}

function _getRedundancyMultiplier() {
    const slider = document.getElementById('slider');
    const step = Number.parseInt(slider?.value ?? '0', 10);
    return 1 + ((Number.isFinite(step) ? step : 0) * 0.05);
}

function _initMobileLayoutSync() {
    ['load', 'resize', 'orientationchange'].forEach((eventName) => {
        window.addEventListener(eventName, _syncMobileMapViewport);
    });
}

function _syncMobileMapViewport() {
    const mapContainer = document.getElementById('map-container');
    const mapSvg = mapContainer?.querySelector('.dv-map');

    if (!mapContainer || !mapSvg) return;

    _syncMobileMapViewBox(mapSvg);

    if (!_isMobilePortraitViewport()) {
        mapSvg.style.removeProperty('--mobile-map-width');
        return;
    }

    const activeMapId = typeof getActiveMapId === 'function' ? getActiveMapId() : _activePackId;
    const baseWidth = _getMobileLayoutContentWidth('stock');
    const activeWidth = _getMobileLayoutContentWidth(activeMapId);
    if (!Number.isFinite(baseWidth) || baseWidth <= 0 || !Number.isFinite(activeWidth) || activeWidth <= 0) return;

    const widthRatio = Math.max(1, activeWidth / baseWidth);
    const targetWidth = Math.ceil(mapContainer.clientWidth * widthRatio * MOBILE_MAP_SCROLL_EXPANSION);
    mapSvg.style.setProperty('--mobile-map-width', `${targetWidth}px`);
    _centerMobileMapScroll(mapContainer);
}

function _isMobilePortraitViewport() {
    return window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches;
}

function _getMobileLayoutContentWidth(mapId) {
    const layout = window.DeltaVMapPositions?.getMapLayout?.(mapId);
    const positions = layout?.positions ? Object.values(layout.positions) : null;
    if (!positions?.length) return null;

    const xs = positions.map((pos) => pos.x);
    return Math.max(...xs) - Math.min(...xs);
}

function _centerMobileMapScroll(mapContainer) {
    window.requestAnimationFrame(() => {
        const maxScrollLeft = mapContainer.scrollWidth - mapContainer.clientWidth;
        mapContainer.scrollLeft = maxScrollLeft > 0 ? Math.round(maxScrollLeft / 2) : 0;
    });
}

function _syncMobileMapViewBox(mapSvg) {
    const baseViewBox = mapSvg.dataset.baseViewBox || mapSvg.getAttribute('viewBox');
    if (!baseViewBox) return;

    if (!mapSvg.dataset.baseViewBox) {
        mapSvg.dataset.baseViewBox = baseViewBox;
    }

    if (!_isMobilePortraitViewport()) {
        mapSvg.setAttribute('viewBox', baseViewBox);
        return;
    }

    const values = baseViewBox.trim().split(/\s+/).map(Number);
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return;

    const [x, y, width, height] = values;
    const expandedWidth = width * MOBILE_MAP_VIEWBOX_EXPANSION;
    const expandedHeight = height * MOBILE_MAP_VIEWBOX_EXPANSION;
    const offsetX = (expandedWidth - width) / 2;
    const offsetY = (expandedHeight - height) / 2;

    mapSvg.setAttribute('viewBox', [
        (x - offsetX).toFixed(2),
        (y - offsetY).toFixed(2),
        expandedWidth.toFixed(2),
        expandedHeight.toFixed(2),
    ].join(' '));
}
