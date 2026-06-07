(function attachDeltaVDropdown(global) {
    document.addEventListener('DOMContentLoaded', () => {
        const dvDisplay = document.getElementById('dV_display');
        const breakdownToggle = document.getElementById('toggle8');
        const dropdown = document.getElementById('dv-dropdown');
        const controlsBar = document.querySelector('.controls-bar');

        if (dvDisplay) {
            dvDisplay.addEventListener('click', (event) => {
                event.stopPropagation();
                toggleDropdown();
            });
        }

        if (breakdownToggle) {
            breakdownToggle.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        }

        if (dropdown) {
            dropdown.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        }

        if (controlsBar) {
            ['click', 'input', 'change'].forEach((eventName) => {
                controlsBar.addEventListener(eventName, (event) => {
                    event.stopPropagation();
                });
            });
        }

        document.addEventListener('click', () => {
            closeDropdown();
        });
    });

    /**
     * Inputs: breakdown entries.
     * Outputs: renders the delta-v breakdown dropdown.
     */
    function renderBreakdown(breakdown = []) {
        const dropdown = document.getElementById('dv-dropdown');
        if (!dropdown) return;

        dropdown.innerHTML = '';
        if (!breakdown.length) return;

        const multiplier = _getRedundancyMultiplier();
        dropdown.appendChild(_createSentinelEntry(' - End - ', 'dropdown-entry--end'));
        [...breakdown].reverse().forEach((entry) => {
            dropdown.appendChild(_createBreakdownEntry(entry, multiplier));
        });
        dropdown.appendChild(_createSentinelEntry(' - Start - ', 'dropdown-entry--start'));

        if (dropdown.classList.contains('is-open')) {
            _positionDropdown();
        }
    }

    /**
     * Inputs: none.
     * Outputs: toggles breakdown dropdown visibility.
     */
    function toggleDropdown() {
        const dropdown = document.getElementById('dv-dropdown');
        const toggle = document.getElementById('toggle8');
        if (!dropdown || !toggle) return;

        const isOpen = dropdown.classList.toggle('is-open');
        toggle.checked = isOpen;
        if (isOpen) {
            _positionDropdown();
        }
    }

    /**
     * Inputs: none.
     * Outputs: hides the breakdown dropdown.
     */
    function closeDropdown() {
        const dropdown = document.getElementById('dv-dropdown');
        const toggle = document.getElementById('toggle8');
        if (!dropdown || !toggle) return;

        dropdown.classList.remove('is-open');
        toggle.checked = false;
    }

    /**
     * Inputs: sentinel text and optional extra class.
     * Outputs: dropdown row element.
     */
    function _createSentinelEntry(text, extraClass = '') {
        const entry = document.createElement('div');
        entry.className = `dropdown-entry ${extraClass}`.trim();
        entry.textContent = text;
        return entry;
    }

    /**
     * Inputs: breakdown item and redundancy multiplier.
     * Outputs: dropdown row element for one delta-v entry.
     */
    function _createBreakdownEntry(item, multiplier) {
        const entry = document.createElement('div');
        const classes = ['dropdown-entry'];
        if (item.type === 'land') classes.push('dropdown-entry--surface');
        if (item.zeroed) classes.push('dropdown-entry--zeroed');

        entry.className = classes.join(' ');
        const marker = document.createElement('span');
        marker.className = 'dropdown-entry-marker';

        const markerColour = _getMarkerColour(item.markerBodyId);
        if (markerColour) {
            marker.style.backgroundColor = markerColour;
        } else {
            marker.classList.add('is-empty');
        }

        const text = document.createElement('span');
        text.className = 'dropdown-entry-text';
        text.appendChild(document.createTextNode(`${item.label}: `));
        text.appendChild(_createDvValue(item, multiplier));

        entry.appendChild(marker);
        if (item.zeroed) {
            const aerobrakeMarker = document.createElement('span');
            aerobrakeMarker.className = 'dropdown-entry-aerobrake';
            aerobrakeMarker.setAttribute('aria-hidden', 'true');
            entry.appendChild(aerobrakeMarker);
        }
        entry.appendChild(text);
        return entry;
    }

    /**
     * Inputs: breakdown item and redundancy multiplier.
     * Outputs: delta-v value element with raw value styling when needed.
     */
    function _createDvValue(item, multiplier) {
        const value = document.createElement('span');
        const adjustedValue = _formatEntryDv(item.dv, multiplier);

        if (!item.zeroed) {
            value.textContent = adjustedValue;
            return value;
        }

        value.className = 'dropdown-entry-value';

        const strike = document.createElement('span');
        strike.className = 'dropdown-entry-value--discounted';
        strike.textContent = _formatEntryDv(item.rawDv ?? item.dv, multiplier);
        value.appendChild(strike);

        return value;
    }

    /**
     * Inputs: raw delta-v and redundancy multiplier.
     * Outputs: rounded formatted delta-v string.
     */
    function _formatEntryDv(dv, multiplier) {
        const adjustedDv = Math.round(((Number(dv) * multiplier) || 0) / 10) * 10;
        return `${adjustedDv.toLocaleString()} m/s`;
    }

    /**
     * Inputs: none.
     * Outputs: current redundancy multiplier from shared state or UI.
     */
    function _getRedundancyMultiplier() {
        const options = typeof getCalculationOptions === 'function' ? getCalculationOptions() : null;
        return Number.isFinite(options?.redundancyMultiplier) ? options.redundancyMultiplier : 1;
    }

    /**
     * Inputs: body id.
     * Outputs: map marker color for that body, or fallback null.
     */
    function _getMarkerColour(bodyId) {
        if (!bodyId) return null;

        const bodies = typeof getBodies === 'function' ? getBodies() : null;
        return bodies?.[bodyId]?.mapColour || null;
    }

    /**
     * Inputs: none.
     * Outputs: positions dropdown relative to the delta-v display.
     */
    function _positionDropdown() {
        const dropdown = document.getElementById('dv-dropdown');
        const dvDisplay = document.getElementById('dV_display');
        const resultGroup = dropdown?.closest('.result-group--dv');
        if (!dropdown || !dvDisplay || !resultGroup) return;

        const displayRect = dvDisplay.getBoundingClientRect();
        const groupRect = resultGroup.getBoundingClientRect();
        const left = displayRect.right - groupRect.left + 12;
        const top = displayRect.bottom - groupRect.top - dropdown.offsetHeight;

        dropdown.style.left = `${Math.round(left)}px`;
        dropdown.style.top = `${Math.round(top)}px`;
    }

    global.renderBreakdown = renderBreakdown;
    global.toggleDropdown = toggleDropdown;
    global.closeDropdown = closeDropdown;
})(typeof window !== 'undefined' ? window : globalThis);
