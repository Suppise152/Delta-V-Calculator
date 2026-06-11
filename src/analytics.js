(function attachDeltaVAnalytics(global) {
    let _pendingEvents = [];
    let _flushTimerId = null;

    /**
     * Inputs: none.
     * Outputs: starts queued analytics dispatch when GoatCounter is available.
     */
    function initAnalytics() {
        if (_flushTimerId != null) return;
        _flushTimerId = global.setInterval(_flushPendingEvents, 250);
    }

    /**
     * Inputs: selected endpoints and UI context.
     * Outputs: queues or sends one analytics pageview payload.
     */
    function trackNodeInteraction(selection, context = {}) {
        const path = _buildNodeInteractionPath(selection, context);
        if (!path) return;

        const payload = {
            path,
            title: _buildNodeInteractionTitle(selection, context),
            event: true,
        };

        _sendOrQueue(payload);
    }

    /**
     * Inputs: selected endpoints and UI context.
     * Outputs: normalized analytics path for a route interaction.
     */
    function _buildNodeInteractionPath(selection, context) {
        const pointA = selection?.pointA || {};
        const pointB = selection?.pointB || {};
        const parts = [
            pointA.body,
            pointA.node,
            pointB.body,
            pointB.node,
            context.packId || 'unknown',
            context.uiMode || 'unknown',
        ].map(_sanitizePathSegment);

        if (parts.some((part) => !part)) return null;
        return parts.join('-');
    }

    /**
     * Inputs: selected endpoints and interaction context.
     * Outputs: human-readable analytics title.
     */
    function _buildNodeInteractionTitle(selection, context) {
        const pointA = selection?.pointA || {};
        const pointB = selection?.pointB || {};
        const pointALabel = _pointLabel(pointA, context.bodyLabels);
        const pointBLabel = _pointLabel(pointB, context.bodyLabels);
        const packLabel = String(context.packId || 'unknown').toUpperCase();
        const uiModeLabel = context.uiMode === 'light' ? 'Light' : 'Dark';
        return `${pointALabel} to ${pointBLabel} on ${packLabel} ${uiModeLabel}`;
    }

    /**
     * Inputs: raw path segment value.
     * Outputs: URL-safe lowercase segment.
     */
    function _sanitizePathSegment(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Inputs: node key.
     * Outputs: display label used in analytics titles.
     */
    function _nodeLabel(nodeKey) {
        return {
            land: 'Land',
            orbit: 'Orbit',
            flyby: 'Fly-by',
            intercept: 'Fly-by',
            escape: 'Escape',
        }[nodeKey] || nodeKey;
    }

    /**
     * Inputs: endpoint and body label lookup.
     * Outputs: display label for route analytics titles.
     */
    function _pointLabel(point, bodyLabels = {}) {
        const bodyLabel = bodyLabels[point?.body] || point?.body || 'Unknown';
        return `${bodyLabel} ${_nodeLabel(point?.node)}`;
    }

    /**
     * Inputs: analytics payload.
     * Outputs: sends immediately or stores until GoatCounter is ready.
     */
    function _sendOrQueue(payload) {
        if (global.goatcounter?.count) {
            global.goatcounter.count(payload);
            return;
        }

        _pendingEvents.push(payload);
    }

    /**
     * Inputs: none.
     * Outputs: sends all queued analytics payloads and stops the flush timer.
     */
    function _flushPendingEvents() {
        if (!global.goatcounter?.count || !_pendingEvents.length) return;

        _pendingEvents.forEach((payload) => {
            global.goatcounter.count(payload);
        });
        _pendingEvents = [];

        if (_flushTimerId != null) {
            global.clearInterval(_flushTimerId);
            _flushTimerId = null;
        }
    }

    global.initAnalytics = initAnalytics;
    global.trackNodeInteraction = trackNodeInteraction;
})(typeof window !== 'undefined' ? window : globalThis);
