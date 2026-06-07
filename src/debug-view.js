(function attachDeltaVDebugView(global) {
    const DEBUG_VIEW_ENABLED = false;

    document.addEventListener('DOMContentLoaded', () => {
        const panel = document.getElementById('calc-debug-panel');
        if (!panel) return;
        panel.hidden = !DEBUG_VIEW_ENABLED;
    });

    /**
     * Inputs: calculation result or null.
     * Outputs: renders calculation debug details into the debug panel.
     */
    function renderDebugView(result = null) {
        const panel = document.getElementById('calc-debug-panel');
        const output = document.getElementById('calc-debug');
        if (!panel || !output) return;

        output.innerHTML = '';

        if (!DEBUG_VIEW_ENABLED) {
            panel.open = false;
            panel.hidden = true;
            return;
        }

        if (!result?.debug?.route) {
            panel.open = false;
            panel.hidden = true;
            return;
        }

        panel.hidden = false;
        _renderRouteDebug(output, result.debug.route, 'Route');
    }

    /**
     * Inputs: container element, route debug payload, and heading text.
     * Outputs: appends route debug DOM nodes.
     */
    function _renderRouteDebug(container, routeDebug, headingText) {
        const section = document.createElement('section');
        section.className = 'debug-section';

        const heading = document.createElement('div');
        heading.className = 'debug-section-title';
        heading.textContent = headingText;
        section.appendChild(heading);

        if (Array.isArray(routeDebug?.segments)) {
            routeDebug.segments.forEach((entry, index) => {
                section.appendChild(_createSegmentEntry(entry, index + 1));
            });
        } else {
            if (routeDebug?.forward) {
                _renderRouteDebug(section, routeDebug.forward, 'Forward');
            }
            if (routeDebug?.return) {
                _renderRouteDebug(section, routeDebug.return, 'Return');
            }
        }

        container.appendChild(section);
    }

    /**
     * Inputs: evaluated debug segment and index.
     * Outputs: DOM node describing that segment.
     */
    function _createSegmentEntry(entry, index) {
        const wrapper = document.createElement('div');
        wrapper.className = 'debug-entry';

        const title = document.createElement('div');
        title.className = 'debug-entry-title';
        title.textContent = `${index}. ${_formatSegment(entry.segment)} = ${_formatDv(entry.dv)}`;
        wrapper.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'debug-entry-meta';
        meta.textContent = `branch: ${entry.branchType}${entry.debug?.source ? ` | source: ${entry.debug.source}` : ''}`;
        wrapper.appendChild(meta);

        const detailLines = _collectDebugLines(entry.debug || {});
        if (detailLines.length) {
            const list = document.createElement('div');
            list.className = 'debug-entry-details';
            detailLines.forEach((line) => {
                const item = document.createElement('div');
                item.className = 'debug-entry-detail';
                item.textContent = line;
                list.appendChild(item);
            });
            wrapper.appendChild(list);
        }

        return wrapper;
    }

    /**
     * Inputs: branch debug object.
     * Outputs: ordered text detail lines.
     */
    function _collectDebugLines(debug) {
        const lines = [];
        const preferredKeys = [
            'coplanarExtra',
            'planeChange',
            'hostToMoonInsertion',
            'periapsis',
            'radiusMeters',
            'originLowOrbitRadiusMeters',
            'hostLowOrbitRadiusMeters',
            'targetEndpointRadiusMeters',
            'moonTransferTargetRadiusMeters',
            'altitudeMeters',
            'flybyAltitudeMeters',
            'originLowOrbitAltitudeMeters',
            'hostLowOrbitAltitudeMeters',
            'hostFlybyAltitudeMeters',
            'planeChangeSpeed',
        ];

        preferredKeys.forEach((key) => {
            if (debug[key] == null) return;
            lines.push(`${_labelForKey(key)}: ${_formatValue(debug[key], key)}`);
        });

        Object.keys(debug).forEach((key) => {
            if (preferredKeys.includes(key) || key === 'source' || key === 'unresolved') return;
            const value = debug[key];
            if (value == null || typeof value === 'object') return;
            lines.push(`${_labelForKey(key)}: ${_formatValue(value, key)}`);
        });

        return lines;
    }

    /**
     * Inputs: segment descriptor.
     * Outputs: compact from-to segment label.
     */
    function _formatSegment(segment) {
        const from = _formatNode(segment?.from);
        const to = _formatNode(segment?.to);
        return `${from} -> ${to}`;
    }

    /**
     * Inputs: parsed route node object.
     * Outputs: compact node label.
     */
    function _formatNode(node) {
        if (!node) return '?';
        if (node.bodyId === 'interplanetary') return 'Interplanetary';
        return `${node.bodyId}.${node.nodeKey}`;
    }

    /**
     * Inputs: delta-v value.
     * Outputs: formatted m/s string.
     */
    function _formatDv(value) {
        return `${Number(value || 0).toFixed(2)} m/s`;
    }

    /**
     * Inputs: debug value and key.
     * Outputs: display-formatted value.
     */
    function _formatValue(value, key) {
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') {
            if (key.toLowerCase().includes('altitude') || key.toLowerCase().includes('radius')) {
                return `${Math.round(value).toLocaleString()} m`;
            }
            if (key.toLowerCase().includes('speed') || key === 'coplanarExtra' || key === 'planeChange' || key === 'hostToMoonInsertion' || key === 'periapsis') {
                return `${value.toFixed(2)} m/s`;
            }
            return value.toFixed(2);
        }
        return String(value);
    }

    /**
     * Inputs: debug object key.
     * Outputs: human-readable label.
     */
    function _labelForKey(key) {
        return key
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/Meters/g, '')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    global.DEBUG_VIEW_ENABLED = DEBUG_VIEW_ENABLED;
    global.renderDebugView = renderDebugView;
})(typeof window !== 'undefined' ? window : globalThis);
