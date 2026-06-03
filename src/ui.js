/**
 * ui.js bootstraps the app and wires the main DOM interactions.
 * Calculation logic lives in pure functions under calculator.js.
 */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof initAnalytics === 'function') {
        initAnalytics();
    }
    _activePackId = _getStoredPackId();
    initMapVersionControls();
    loadPack(_activePackId);
    initSlider();
    initThemeToggle();
    initDescriptionPanelToggle();
    initPlanetInfoCard();
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
const PLANET_INFO_HOVER_DELAY_MS = 1000;
const THEME_STORAGE_KEY = 'deltaVTheme';
const DESCRIPTION_PANEL_STORAGE_KEY = 'deltaVDescriptionPanel';
const MAP_PACK_STORAGE_KEY = 'deltaVMapPack';

function _getStoredPackId() {
    const storedPackId = window.localStorage.getItem(MAP_PACK_STORAGE_KEY);
    return PACK_CONFIG[storedPackId] ? storedPackId : 'stock';
}

function initThemeToggle() {
    const buttons = Array.from(document.querySelectorAll('.theme-toggle'));
    if (!buttons.length) return;

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    _setLightMode(storedTheme === 'light', buttons);

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            const isLightMode = !document.body.classList.contains('is-light-mode');
            _setLightMode(isLightMode, buttons);
            window.localStorage.setItem(THEME_STORAGE_KEY, isLightMode ? 'light' : 'dark');
        });
    });
}

function _setLightMode(isLightMode, buttons) {
    document.body.classList.toggle('is-light-mode', isLightMode);
    buttons.forEach((button) => {
        button.setAttribute('aria-pressed', String(isLightMode));
        button.textContent = isLightMode ? 'Dark Mode' : 'Light Mode';
    });
}

function initDescriptionPanelToggle() {
    const content = document.querySelector('.content');
    const button = document.getElementById('description-toggle');
    if (!content || !button) return;

    const storedState = window.localStorage.getItem(DESCRIPTION_PANEL_STORAGE_KEY);
    _setDescriptionPanelCollapsed(storedState === 'collapsed', content, button);

    button.addEventListener('click', () => {
        const isCollapsed = !content.classList.contains('is-description-collapsed');
        _setDescriptionPanelCollapsed(isCollapsed, content, button);
        window.localStorage.setItem(DESCRIPTION_PANEL_STORAGE_KEY, isCollapsed ? 'collapsed' : 'expanded');
    });

    content.addEventListener('transitionend', (event) => {
        if (event.target !== document.getElementById('description-panel')) return;
        if (event.propertyName !== 'flex-basis') return;

        _syncMobileMapViewport();
        _refreshTransferUi();
    });
}

function _setDescriptionPanelCollapsed(isCollapsed, content, button) {
    content.classList.toggle('is-description-collapsed', isCollapsed);
    button.setAttribute('aria-expanded', String(!isCollapsed));
    button.setAttribute('aria-label', isCollapsed ? 'Show description panel' : 'Hide description panel');
    button.title = isCollapsed ? 'Show description panel' : 'Hide description panel';
}

function initPlanetInfoCard() {
    const mapContainer = document.getElementById('map-container');
    const card = document.getElementById('planet-info-card');
    if (!mapContainer || !card) return;

    let hoverTimer = null;
    let activeNode = null;

    const clearHoverTimer = () => {
        if (!hoverTimer) return;
        window.clearTimeout(hoverTimer);
        hoverTimer = null;
    };

    const hideCard = () => {
        clearHoverTimer();
        activeNode = null;
        card.classList.remove('is-open');
        card.setAttribute('aria-hidden', 'true');
    };

    mapContainer.addEventListener('pointerover', (event) => {
        if (!_canShowPlanetInfoCard()) return;

        const node = event.target.closest?.('.map-node');
        if (!node || !mapContainer.contains(node) || node.dataset.nodeKey !== 'land') return;
        if (node === activeNode) return;

        clearHoverTimer();
        card.classList.remove('is-open');
        activeNode = node;

        hoverTimer = window.setTimeout(() => {
            if (activeNode !== node) return;
            _showPlanetInfoCard(card, mapContainer, node);
        }, PLANET_INFO_HOVER_DELAY_MS);
    });

    mapContainer.addEventListener('pointerout', (event) => {
        const node = event.target.closest?.('.map-node');
        if (!node || node !== activeNode) return;
        if (event.relatedTarget && node.contains(event.relatedTarget)) return;
        hideCard();
    });

    mapContainer.addEventListener('scroll', hideCard);
    window.addEventListener('resize', hideCard);
}

function _showPlanetInfoCard(card, mapContainer, node) {
    if (!_canShowPlanetInfoCard()) return;

    const body = _loadedSystemData?.bodies?.find((candidate) => candidate.id === node.dataset.bodyId);
    if (!body) return;

    card.replaceChildren(_createPlanetInfoContent(body));
    card.classList.add('is-open');
    card.setAttribute('aria-hidden', 'false');
    _positionPlanetInfoCard(card, mapContainer, node);
}

function _createPlanetInfoContent(body) {
    const fragment = document.createDocumentFragment();

    const header = document.createElement('div');
    header.className = 'planet-info-card__header';

    const title = document.createElement('div');
    title.className = 'planet-info-card__title';
    title.textContent = body.label || body.id;
    header.appendChild(title);

    const swatches = _createPlanetInfoSwatches(body);
    if (swatches) header.appendChild(swatches);

    fragment.appendChild(header);

    const rows = document.createElement('div');
    rows.className = 'planet-info-card__rows';

    [
        ['Atmosphere', _formatAtmosphere(body)],
        ['DV to orbit', _formatDv(body.surface?.dvToOrbit)],
        ['Satellites', _formatSatellites(body)],
        ['Host body', _formatHostBody(body)],
        ['Radius', _formatDistance(body.physics?.radius)],
    ].forEach(([label, value]) => {
        const labelEl = document.createElement('div');
        labelEl.className = 'planet-info-card__label';
        labelEl.textContent = label;

        const valueEl = document.createElement('div');
        valueEl.className = 'planet-info-card__value';
        valueEl.textContent = value;

        rows.append(labelEl, valueEl);
    });

    fragment.appendChild(rows);
    return fragment;
}

function _createPlanetInfoSwatches(body) {
    const swatches = document.createElement('div');
    swatches.className = 'planet-info-card__swatches';

    swatches.appendChild(_createBodySwatch(body, 'planet-info-card__swatch--body'));

    const satellites = Array.isArray(body.moons) ? body.moons : [];
    if (satellites.length) {
        const satelliteSwatches = document.createElement('div');
        satelliteSwatches.className = 'planet-info-card__satellite-swatches';

        satellites.forEach((satelliteId) => {
            const satellite = _getBodyById(satelliteId);
            if (satellite) {
                satelliteSwatches.appendChild(_createBodySwatch(satellite, 'planet-info-card__swatch--satellite'));
            }
        });

        if (satelliteSwatches.children.length) {
            swatches.appendChild(satelliteSwatches);
        }
    }

    return swatches;
}

function _createBodySwatch(body, extraClass) {
    const swatch = document.createElement('span');
    swatch.className = `planet-info-card__swatch ${extraClass}`;
    swatch.style.backgroundColor = body.mapColour || '#888888';
    swatch.title = body.label || body.id;
    swatch.setAttribute('aria-label', body.label || body.id);
    return swatch;
}

function _positionPlanetInfoCard(card, mapContainer, node) {
    const nodeRect = node.getBoundingClientRect();
    const containerRect = mapContainer.getBoundingClientRect();
    const gap = 12;

    let left = nodeRect.right - containerRect.left + gap + mapContainer.scrollLeft;
    let top = nodeRect.top - containerRect.top + mapContainer.scrollTop;

    const maxLeft = Math.max(gap, mapContainer.clientWidth - card.offsetWidth - gap);
    const maxTop = Math.max(gap, mapContainer.clientHeight - card.offsetHeight - gap);

    if (left > maxLeft) {
        left = nodeRect.left - containerRect.left - card.offsetWidth - gap + mapContainer.scrollLeft;
    }

    card.style.left = `${Math.round(Math.max(gap, Math.min(left, maxLeft)))}px`;
    card.style.top = `${Math.round(Math.max(gap, Math.min(top, maxTop)))}px`;
}

function _formatAtmosphere(body) {
    const height = Number(body.physics?.atmosphereHeight);
    if (!Number.isFinite(height) || height <= 0) return 'None';
    return _formatDistance(height);
}

function _formatDistance(meters) {
    const value = Number(meters);
    if (!Number.isFinite(value)) return 'Unknown';
    if (value === 0) return '0 m';
    if (Math.abs(value) >= 1000) return `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
    return `${value.toLocaleString()} m`;
}

function _formatDv(dv) {
    const value = Number(dv);
    return Number.isFinite(value) ? `${value.toLocaleString()} m/s` : 'Unknown';
}

function _formatSatellites(body) {
    const satellites = Array.isArray(body.moons) ? body.moons : [];
    if (!satellites.length) return 'None';

    return satellites
        .map((satelliteId) => _getBodyById(satelliteId)?.label || satelliteId)
        .join(', ');
}

function _formatHostBody(body) {
    if (!body.parent) return 'None';
    return _getBodyById(body.parent)?.label || body.parent;
}

function _getBodyById(bodyId) {
    return _loadedSystemData?.bodies?.find((candidate) => candidate.id === bodyId) || null;
}

function _canShowPlanetInfoCard() {
    if (_isMobilePortraitViewport()) return false;
    return !window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

function initMapVersionControls() {
    _setActivePackToggle(_activePackId);
}

async function loadPack(packId) {
    const nextPackId = PACK_CONFIG[packId] ? packId : 'stock';
    const config = PACK_CONFIG[nextPackId];

    try {
        if (_loadedSystemData && _loadedDataPackId === config.dataPackId) {
            _activePackId = nextPackId;
            _originBodyId = _loadedSystemData.meta?.originBody ?? null;
            setMapLayout(config.mapId);
            _setActivePackToggle(nextPackId);
            window.localStorage.setItem(MAP_PACK_STORAGE_KEY, nextPackId);
            _syncMobileMapViewport();
            _refreshOutputs();
            return;
        }

        const res = await fetch(`data/${config.dataPackId}.json`, { cache: 'no-store' });
        const data = _normalizeLoadedPackData(await res.json());
        _loadedDataPackId = config.dataPackId;
        _loadedSystemData = data;
        _activePackId = nextPackId;
        _originBodyId = data.meta?.originBody ?? null;
        initMap(data, { mapId: config.mapId });
        _setActivePackToggle(nextPackId);
        window.localStorage.setItem(MAP_PACK_STORAGE_KEY, nextPackId);
        _syncMobileMapViewport();
        _refreshOutputs();
    } catch (e) {
        console.error('Failed to load pack:', nextPackId, e);
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
