/**
 * journey.js — "Advanced Mode" multi-stop journey builder.
 *
 * UI only for now: this module owns the journey data model (an ordered list of
 * stops p0..pN) and renders/wires the left-panel builder. It reuses the existing
 * single-leg map/route rendering (setPointA/setPointB from src/map/render.js) to
 * display whichever leg is currently selected, but does not run any delta-v
 * calculation against the journey yet — that hookup is a later phase.
 */
(function attachDeltaVJourney(global) {
    // Hard cap on total stops (p0..pN). Bump this to raise the limit.
    const MAX_JOURNEY_STOPS = 15;

    const ADVANCED_MODE_STORAGE_KEY = 'deltaVAdvancedMode';
    const JOURNEY_EMPTY_COLOUR = '#6f7580';
    const JOURNEY_PLACEHOLDER_GLOW = '#4a90ff';

    // Per-leg aerobrake toggles: only the destination-side ones apply in advanced
    // mode, since each leg's "origin" is just the previous stop, not a mission start.
    const AEROBRAKE_TOGGLE_IDS = [
        'aeroInterceptDest',
        'aeroLowOrbitDest',
    ];
    const LOCKED_SINGLE_TRIP_TOGGLE_IDS = [
        'roundTripToggle', 'returnOnlyToggle', 'fromLO',
        'aeroInterceptOrigin', 'aeroLowOrbitOrigin',
    ];
    const MAP_CONTROL_INPUT_IDS = [
        'ksp1Check', 'ksp2Check',
        'stockCheck', 'opmCheck', 'rssCheck', 'ksrssCheck', 'jnsqCheck',
        'kerbolCheck',
    ];

    const NODE_WORD_LABELS = {
        land: 'Surface',
        orbit: 'Orbit',
        flyby: 'Fly-by',
        intercept: 'Intercept',
        escape: 'Escape',
    };

    let _advancedModeActive = false;
    let _journeyStops = [];
    let _activeStopIndex = 1;
    let _dragFromIndex = null;
    let _isJourneyModifierActive = false;

    /**
     * Inputs: none.
     * Outputs: wires the advanced-mode toggle button and restores persisted state.
     */
    function initAdvancedModeToggle() {
        const button = document.getElementById('advanced-mode-toggle');
        if (!button) return;

        const storedState = window.localStorage.getItem(ADVANCED_MODE_STORAGE_KEY);
        _advancedModeActive = storedState === 'active';
        _syncAdvancedModeButtonVisual();
        _applyAdvancedModeLayout(_advancedModeActive);
        if (_advancedModeActive) _resetJourney();

        button.addEventListener('click', () => {
            _setAdvancedMode(!_advancedModeActive, { persist: true });
        });

        window.addEventListener('keydown', _handleJourneyModifierState);
        window.addEventListener('keyup', _handleJourneyModifierState);
        window.addEventListener('blur', _clearJourneyModifierState);
    }

    /**
     * Inputs: keyboard event.
     * Outputs: previews the next stop as active while Ctrl/Cmd is held, reverting on release.
     * Purpose: mirrors the origin/destination Ctrl-preview in src/ui.js (_handleEndpointModifierState) —
     * lets a Ctrl+click on the map assign straight to the next leg without losing the current selection.
     */
    function _handleJourneyModifierState(event) {
        if (!_advancedModeActive) return;

        const isActive = Boolean(event.ctrlKey || event.metaKey);
        if (_isJourneyModifierActive === isActive) return;

        _isJourneyModifierActive = isActive;
        renderJourneyPanel();
    }

    /**
     * Inputs: none.
     * Outputs: clears a stuck modifier preview after focus loss.
     */
    function _clearJourneyModifierState() {
        if (!_isJourneyModifierActive) return;
        _isJourneyModifierActive = false;
        renderJourneyPanel();
    }

    /**
     * Inputs: whether the next-stop preview should apply.
     * Outputs: the stop index that should currently read as "active" — the real
     * active stop normally, or the trailing "select next stop" placeholder while
     * the Ctrl/Cmd preview is held (always the frontier, not just +1 from wherever
     * the real selection happens to be).
     */
    function _getPreviewStopIndex(useNextStop) {
        if (!useNextStop) return _activeStopIndex;
        return _journeyStops.length - 1;
    }

    /**
     * Inputs: none.
     * Outputs: true once the map/body data referenced by setPointA/setPointB has loaded.
     * Purpose: guards against touching src/map/render.js state before loadPack()'s
     * async fetch resolves (relevant when advanced mode was persisted active across a reload).
     */
    function _isMapReady() {
        const bodies = typeof getBodies === 'function' ? getBodies() : null;
        return Boolean(bodies && Object.keys(bodies).length);
    }

    /**
     * Inputs: none.
     * Outputs: re-derives p0's default origin once map data finishes loading.
     * Purpose: called from loadPack() (src/ui.js) so a page reload with advanced mode
     * already persisted active still gets a real default origin for p0.
     */
    function syncJourneyMapReady() {
        if (!_advancedModeActive) return;
        const isPristine = _journeyStops.length <= 2 && !_journeyStops[0]?.body && !_journeyStops[1]?.body;
        if (isPristine) _resetJourney();
    }

    /**
     * Inputs: none.
     * Outputs: syncs the toggle button's visual pressed/active state.
     */
    function _syncAdvancedModeButtonVisual() {
        const button = document.getElementById('advanced-mode-toggle');
        if (!button) return;
        button.classList.toggle('is-active', _advancedModeActive);
        button.setAttribute('aria-pressed', String(_advancedModeActive));
    }

    /**
     * Inputs: none.
     * Outputs: whether advanced mode is currently active.
     */
    function isAdvancedModeActive() {
        return _advancedModeActive;
    }

    /**
     * Inputs: none.
     * Outputs: whether map/game-version pack switching should be blocked because
     * the journey already has a real stop beyond the origin.
     */
    function isJourneyPackLocked() {
        return _advancedModeActive && _journeyStops.some((stop, index) => index > 0 && stop.body);
    }

    /**
     * Inputs: desired active state and persistence flag.
     * Outputs: applies advanced-mode UI state, optionally persisting the choice.
     */
    function _setAdvancedMode(active, { persist }) {
        _advancedModeActive = Boolean(active);
        _syncAdvancedModeButtonVisual();

        if (persist) {
            window.localStorage.setItem(ADVANCED_MODE_STORAGE_KEY, _advancedModeActive ? 'active' : 'inactive');
        }

        _applyAdvancedModeLayout(_advancedModeActive);

        if (_advancedModeActive) {
            _resetJourney();
        } else {
            _setAerobrakeCheckboxesEnabled(true);
            _syncMapControlsLockUI();

            if (_isMapReady()) {
                if (typeof resetSelection === 'function') resetSelection();
                if (typeof _refreshEndpointSelectorUi === 'function') _refreshEndpointSelectorUi();
                if (typeof _refreshOutputs === 'function') _refreshOutputs();
            }
        }
    }

    /**
     * Inputs: desired active flag.
     * Outputs: pure DOM/attribute layout changes for entering/leaving advanced mode.
     * Purpose: safe to call at any time, including before map data has loaded.
     */
    function _applyAdvancedModeLayout(active) {
        document.querySelector('.content')?.classList.toggle('is-advanced-mode', active);

        const staticContent = document.getElementById('description-static-content');
        if (staticContent) staticContent.hidden = active;

        const journeyPanel = document.getElementById('journey-panel');
        if (journeyPanel) journeyPanel.hidden = !active;

        document.getElementById('endpoint-selector')?.classList.toggle('is-hidden', active);

        _setToggleGroupLocked(LOCKED_SINGLE_TRIP_TOGGLE_IDS, active);
        _setElementDisabled('clear-selection', active);
    }

    /**
     * Inputs: none.
     * Outputs: default origin stop for p0, matching the app's normal default origin.
     */
    function _getDefaultOriginStop() {
        const originBodyId = typeof _getCurrentOriginBodyId === 'function' ? _getCurrentOriginBodyId() : null;
        return { body: originBodyId || null, node: originBodyId ? 'land' : null };
    }

    /**
     * Inputs: none.
     * Outputs: resets the journey to its empty state [origin, placeholder] and re-renders.
     */
    function _resetJourney() {
        _journeyStops = [_getDefaultOriginStop(), { body: null, node: null }];
        _activeStopIndex = 1;

        _setAerobrakeCheckboxesEnabled(true);
        _syncMapControlsLockUI();
        selectJourneyStop(_activeStopIndex);
    }

    /**
     * Inputs: stop index to select.
     * Outputs: updates the active stop, syncs the map/checkboxes to that leg, and re-renders.
     */
    function selectJourneyStop(index) {
        if (index < 0 || index >= _journeyStops.length) return;
        _activeStopIndex = index;

        _setAerobrakeCheckboxesEnabled(index > 0);

        if (_isMapReady()) {
            if (index === 0) {
                const origin = _journeyStops[0];
                if (origin.body) setPointA(origin.body, origin.node);
                setPointB(null, null);
            } else {
                const from = _journeyStops[index - 1];
                const to = _journeyStops[index];
                if (from.body) setPointA(from.body, from.node);
                setPointB(to.body, to.node);
            }

            if (typeof _refreshEndpointSelectorUi === 'function') _refreshEndpointSelectorUi();
            if (typeof _refreshOutputs === 'function') _refreshOutputs();
        }

        renderJourneyPanel();
    }

    /**
     * Inputs: clicked map body id/node key, and whether the Ctrl/Cmd "next stop" preview applied.
     * Outputs: assigns the node to the target journey stop, grows the journey, and re-renders.
     * Purpose: called from onNodeClick (src/ui.js) instead of the normal origin/destination write.
     * A Ctrl/Cmd-held click writes to the trailing placeholder (the frontier) and advances the
     * active selection onto it — so holding Ctrl and clicking repeatedly rapid-builds consecutive
     * legs. Releasing Ctrl afterwards reflects wherever that left the active selection.
     */
    function assignActiveJourneyStopNode(bodyId, nodeKey, options = {}) {
        if (!_journeyStops.length) return;

        const useNextStop = Boolean(options.useNextStop);
        const targetIndex = _getPreviewStopIndex(useNextStop);
        _journeyStops[targetIndex] = { body: bodyId, node: nodeKey };

        // p0 (the origin) never grows the list — only assigning a trailing stop does.
        const isLastStop = targetIndex === _journeyStops.length - 1;
        if (targetIndex > 0 && isLastStop && _journeyStops.length < MAX_JOURNEY_STOPS) {
            _journeyStops.push({ body: null, node: null });
        }

        if (useNextStop) {
            _activeStopIndex = targetIndex;
        }

        _syncMapControlsLockUI();
        selectJourneyStop(_activeStopIndex);
    }

    /**
     * Inputs: stop index to remove (must be >= 1).
     * Outputs: removes that stop/leg, re-adds a trailing placeholder if needed, and re-renders.
     */
    function removeJourneyStop(index) {
        if (index <= 0 || index >= _journeyStops.length) return;

        _journeyStops.splice(index, 1);
        if (!_journeyStops.length || _journeyStops[_journeyStops.length - 1].body) {
            _journeyStops.push({ body: null, node: null });
        }

        const nextActiveIndex = Math.min(index, _journeyStops.length - 1);
        _syncMapControlsLockUI();
        selectJourneyStop(nextActiveIndex);
    }

    /**
     * Inputs: source and destination stop indices (both >= 1).
     * Outputs: moves the stop to its new position and re-renders.
     */
    function reorderJourneyStop(fromIndex, toIndex) {
        if (fromIndex <= 0 || toIndex <= 0) return;
        if (fromIndex >= _journeyStops.length || toIndex >= _journeyStops.length) return;
        if (fromIndex === toIndex) return;

        const [moved] = _journeyStops.splice(fromIndex, 1);
        _journeyStops.splice(toIndex, 0, moved);

        const activeStop = _activeStopIndex;
        if (activeStop === fromIndex) {
            _activeStopIndex = toIndex;
        } else if (fromIndex < activeStop && toIndex >= activeStop) {
            _activeStopIndex -= 1;
        } else if (fromIndex > activeStop && toIndex <= activeStop) {
            _activeStopIndex += 1;
        }

        selectJourneyStop(_activeStopIndex);
    }

    /**
     * Inputs: toggle element ids and locked flag.
     * Outputs: unchecks and disables (or re-enables) the given checkboxes.
     */
    function _setToggleGroupLocked(ids, locked) {
        ids.forEach((id) => {
            const input = document.getElementById(id);
            if (!input) return;
            if (locked) input.checked = false;
            input.disabled = locked;
        });
    }

    /**
     * Inputs: enabled flag.
     * Outputs: enables/disables the four aerobrake checkboxes, always resetting them unchecked.
     */
    function _setAerobrakeCheckboxesEnabled(enabled) {
        AEROBRAKE_TOGGLE_IDS.forEach((id) => {
            const input = document.getElementById(id);
            if (!input) return;
            input.checked = false;
            input.disabled = !enabled;
        });

        const dropdown = document.getElementById('dv-dropdown');
        if (dropdown) dropdown.classList.remove('is-open');
    }

    /**
     * Inputs: element id and disabled flag.
     * Outputs: sets the element's disabled property when present.
     */
    function _setElementDisabled(id, disabled) {
        const element = document.getElementById(id);
        if (element) element.disabled = disabled;
    }

    /**
     * Inputs: none.
     * Outputs: locks/unlocks the map version and pack checkboxes to match journey state.
     */
    function _syncMapControlsLockUI() {
        const locked = isJourneyPackLocked();
        MAP_CONTROL_INPUT_IDS.forEach((id) => {
            const input = document.getElementById(id);
            if (input) input.disabled = locked;
        });
    }

    /**
     * Inputs: body data and node key.
     * Outputs: "{Body Label} - {Node Word}" display label for a stop.
     */
    function _formatStopLabel(body, nodeKey) {
        if (!body) return null;
        const word = NODE_WORD_LABELS[nodeKey] || nodeKey;
        return `${body.label} - ${word}`;
    }

    /**
     * Inputs: body id.
     * Outputs: loaded body data or null.
     */
    function _getJourneyBody(bodyId) {
        if (!bodyId) return null;
        const bodies = typeof getBodies === 'function' ? getBodies() : null;
        return bodies?.[bodyId] || null;
    }

    /**
     * Inputs: none.
     * Outputs: rebuilds the journey stop list, connectors, and footer.
     */
    function renderJourneyPanel() {
        const list = document.getElementById('journey-stop-list');
        if (!list) return;

        list.innerHTML = '';

        _journeyStops.forEach((stop, index) => {
            list.appendChild(_buildStopRow(stop, index));

            if (index < _journeyStops.length - 1) {
                const nextStop = _journeyStops[index + 1];
                list.appendChild(_buildConnector(index, stop, nextStop));
            }
        });

        _renderFooter();
    }

    /**
     * Inputs: stop data and its index.
     * Outputs: DOM row element for one journey stop.
     */
    function _buildStopRow(stop, index) {
        const body = _getJourneyBody(stop.body);
        const isPlaceholder = !stop.body;
        const isOrigin = index === 0;

        const row = document.createElement('div');
        row.className = 'journey-stop-row';
        row.classList.toggle('is-active', index === _getPreviewStopIndex(_isJourneyModifierActive));
        row.dataset.stopIndex = String(index);

        if (!isOrigin && !isPlaceholder) {
            row.draggable = true;
            row.addEventListener('dragstart', (event) => {
                _dragFromIndex = index;
                event.dataTransfer?.setData('text/plain', String(index));
            });
            row.addEventListener('dragover', (event) => {
                event.preventDefault();
            });
            row.addEventListener('drop', (event) => {
                event.preventDefault();
                if (_dragFromIndex != null) reorderJourneyStop(_dragFromIndex, index);
                _dragFromIndex = null;
            });
            row.addEventListener('dragend', () => {
                _dragFromIndex = null;
            });

            const handle = document.createElement('span');
            handle.className = 'journey-drag-handle';
            handle.setAttribute('aria-hidden', 'true');
            for (let dot = 0; dot < 6; dot += 1) {
                handle.appendChild(document.createElement('span'));
            }
            row.appendChild(handle);
        } else {
            const spacer = document.createElement('span');
            spacer.className = 'journey-drag-handle journey-drag-handle--spacer';
            row.appendChild(spacer);
        }

        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'journey-node';
        node.classList.toggle('is-placeholder', isPlaceholder);
        node.style.setProperty('--journey-colour', isPlaceholder ? JOURNEY_EMPTY_COLOUR : (body?.mapColour || JOURNEY_EMPTY_COLOUR));
        node.style.setProperty('--journey-glow', JOURNEY_PLACEHOLDER_GLOW);
        node.setAttribute('aria-label', isPlaceholder ? `Select point ${index}` : _formatStopLabel(body, stop.node));
        node.addEventListener('click', () => selectJourneyStop(index));
        row.appendChild(node);

        const label = document.createElement('span');
        label.className = 'journey-stop-label';
        if (isPlaceholder) {
            label.classList.add('is-placeholder');
            label.textContent = isOrigin ? 'Select origin' : 'Select next stop';
        } else {
            label.textContent = _formatStopLabel(body, stop.node);
        }
        row.appendChild(label);

        if (!isOrigin && !isPlaceholder) {
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'journey-remove-btn';
            removeButton.textContent = 'Remove';
            removeButton.setAttribute('aria-label', `Remove ${_formatStopLabel(body, stop.node)}`);
            removeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                removeJourneyStop(index);
            });
            row.appendChild(removeButton);
        }

        return row;
    }

    /**
     * Inputs: leg index (0-based, connecting stop[index] to stop[index+1]) and both endpoint stops.
     * Outputs: DOM connector element between two stop rows.
     */
    function _buildConnector(index, fromStop, toStop) {
        const isComplete = Boolean(fromStop.body && toStop.body);

        const connector = document.createElement('div');
        connector.className = 'journey-connector';
        connector.classList.toggle('is-complete', isComplete);

        const legLabel = document.createElement('span');
        legLabel.className = 'journey-connector-label';
        legLabel.textContent = `L${index + 1}`;
        connector.appendChild(legLabel);

        const line = document.createElement('span');
        line.className = 'journey-connector-line';
        connector.appendChild(line);

        if (isComplete) {
            const widget = document.createElement('div');
            widget.className = 'journey-leg-widget';
            widget.innerHTML = `
                <span class="journey-leg-widget-dv">&Delta;V: —</span>
                <span class="journey-leg-widget-transfer">Transfer: —&deg;</span>
            `;
            const diagram = _buildMiniTransferDiagram();
            if (diagram) widget.appendChild(diagram);
            connector.appendChild(widget);
        }

        return connector;
    }

    /**
     * Inputs: none.
     * Outputs: small transfer-diagram SVG sized to fit the leg widget, or null.
     * Purpose: reuses the exact same diagram renderer as the main transfer display
     * (buildTransferDiagramSvg in src/transfer.js) with a static placeholder model,
     * so it already matches the real diagram's look once per-leg data is wired in.
     */
    function _buildMiniTransferDiagram() {
        if (typeof buildTransferDiagramSvg !== 'function') return null;

        const placeholderModel = {
            centerLabel: 'Transfer',
            centerBodyId: null,
            fromBodyId: null,
            toBodyId: null,
            fromOrbitRadius: 1,
            toOrbitRadius: 1.6,
        };
        const svg = buildTransferDiagramSvg(placeholderModel, 'depart', {}, 90);
        svg.classList.add('journey-leg-widget-diagram');
        svg.setAttribute('aria-hidden', 'true');
        return svg;
    }

    /**
     * Inputs: none.
     * Outputs: updates the pinned footer total-dv placeholder and wires the clear-all button once.
     */
    function _renderFooter() {
        const clearButton = document.getElementById('journey-clear-all');
        if (clearButton && !clearButton.dataset.wired) {
            clearButton.dataset.wired = 'true';
            clearButton.addEventListener('click', () => _resetJourney());
        }
    }

    global.initAdvancedModeToggle = initAdvancedModeToggle;
    global.syncJourneyMapReady = syncJourneyMapReady;
    global.isAdvancedModeActive = isAdvancedModeActive;
    global.isJourneyPackLocked = isJourneyPackLocked;
    global.selectJourneyStop = selectJourneyStop;
    global.assignActiveJourneyStopNode = assignActiveJourneyStopNode;
    global.removeJourneyStop = removeJourneyStop;
    global.reorderJourneyStop = reorderJourneyStop;
    global.renderJourneyPanel = renderJourneyPanel;
})(typeof window !== 'undefined' ? window : globalThis);
