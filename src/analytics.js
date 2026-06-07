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
     * Inputs: clicked body id, node key, and UI context.
     * Outputs: queues or sends one analytics pageview payload.
     */
    function trackNodeInteraction(bodyId, nodeKey, context = {}) {
        const path = _buildNodeInteractionPath(bodyId, nodeKey, context.packId);
        if (!path) return;

        const payload = {
            path,
            title: _buildNodeInteractionTitle(bodyId, nodeKey, context),
            event: true,
        };

        _sendOrQueue(payload);
    }

    /**
     * Inputs: body id, node key, and active pack id.
     * Outputs: normalized analytics path for a node interaction.
     */
    function _buildNodeInteractionPath(bodyId, nodeKey, packId) {
        const bodyPart = _sanitizePathSegment(bodyId);
        const nodePart = _sanitizePathSegment(nodeKey);
        const packPart = _sanitizePathSegment(packId || 'unknown');

        if (!bodyPart || !nodePart || !packPart) return null;
        return `${bodyPart}-${nodePart}-${packPart}`;
    }

    /**
     * Inputs: body id, node key, and interaction context.
     * Outputs: human-readable analytics title.
     */
    function _buildNodeInteractionTitle(bodyId, nodeKey, context) {
        const bodyLabel = context.bodyLabel || bodyId;
        const nodeLabel = _nodeLabel(nodeKey);
        const packLabel = String(context.packId || 'unknown').toUpperCase();
        return `${bodyLabel} ${nodeLabel} on ${packLabel}`;
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
