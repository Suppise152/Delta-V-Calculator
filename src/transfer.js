const TRANSFER_SVG_NS = 'http://www.w3.org/2000/svg';
const TRANSFER_PLACEHOLDER = '—';
const TRANSFER_FIXED_ANGLE = 45;
const TRANSFER_BODY_A_COLOUR = '#4A90D9';
const TRANSFER_BODY_B_COLOUR = '#E53528';

// center body radius in phase diagrams; reduce this to make the central sun smaller.
const TRANSFER_CENTER_BODY_RADIUS = 12;
const TRANSFER_KERBOL_CENTER_BODY_RADIUS = 20;
const TRANSFER_BLOCK_IDS = ['transfer-block-arrive', 'transfer-block-depart'];
const TRANSFER_DIAGRAM_SELECTOR = '.phase-diagram';
const TRANSFER_LABEL_SELECTOR = '.result-label';
const TRANSFER_RESULTS_LAYOUT_SELECTOR = '.results-layout';
const TRANSFER_ROW_SELECTOR = '.transfer-row';
const TRANSFER_DV_GROUP_SELECTOR = '.result-group--dv';
const TRANSFER_RESIZE_EVENTS = ['load', 'resize'];

TRANSFER_RESIZE_EVENTS.forEach((eventName) => window.addEventListener(eventName, _syncTransferDiagramSizes));

function refreshTransferDisplay() {
    const bodies = typeof getBodies === 'function' ? getBodies() : null;
    const selection = typeof getSelectedPoints === 'function' ? getSelectedPoints() : null;
    const meta = typeof getSystemMeta === 'function' ? getSystemMeta() : null;

    const arriveBlock = document.getElementById('transfer-block-arrive');
    const departBlock = document.getElementById('transfer-block-depart');
    const arriveAngle = document.getElementById('arrival_angle');
    const departAngle = document.getElementById('departure_angle');
    const arriveDiagram = document.getElementById('phase-arrive');
    const departDiagram = document.getElementById('phase-depart');

    if (!arriveBlock || !departBlock || !arriveAngle || !departAngle || !arriveDiagram || !departDiagram) return;

    const roundTrip = document.getElementById('roundTripToggle')?.checked ?? false;
    const returnOnly = document.getElementById('returnOnlyToggle')?.checked ?? false;

    if (!bodies || !selection?.pointA?.body || !selection?.pointB?.body || !meta?.centralBody) {
        _clearTransferBlock(arriveAngle, arriveDiagram);
        _clearTransferBlock(departAngle, departDiagram);
        _syncTransferDiagramSizes();
        return;
    }

    const transferModel = _buildTransferModel(selection.pointA.body, selection.pointB.body, bodies, meta.centralBody);

    if (!transferModel) {
        _clearTransferBlock(arriveAngle, arriveDiagram);
        _clearTransferBlock(departAngle, departDiagram);
        _syncTransferDiagramSizes();
        return;
    }

    const showArrive = !returnOnly;
    const showDepart = roundTrip || returnOnly;

    _renderTransferBlock(arriveBlock, arriveAngle, arriveDiagram, transferModel, 'depart', showArrive, bodies);
    _renderTransferBlock(departBlock, departAngle, departDiagram, transferModel, 'arrive', showDepart, bodies);
    _syncTransferDiagramSizes();
}

function _renderTransferBlock(blockEl, angleEl, diagramEl, transferModel, mode, isVisible, bodies) {
    if (!isVisible) {
        _clearTransferBlock(angleEl, diagramEl);
        return;
    }

    angleEl.value = `${TRANSFER_FIXED_ANGLE}°`;
    blockEl.dataset.state = 'active';
    diagramEl.classList.remove('is-empty');
    diagramEl.innerHTML = '';
    diagramEl.appendChild(_buildTransferDiagramSvg(transferModel, mode, bodies));
}

function _clearTransferBlock(angleEl, diagramEl) {
    angleEl.value = TRANSFER_PLACEHOLDER;
    diagramEl.classList.add('is-empty');
    diagramEl.innerHTML = '';
}

function _syncTransferDiagramSizes() {
    window.requestAnimationFrame(() => {
        const resultsLayoutEl = document.querySelector(TRANSFER_RESULTS_LAYOUT_SELECTOR);
        const transferRowEl = resultsLayoutEl?.querySelector(TRANSFER_ROW_SELECTOR);
        const dvGroupEl = resultsLayoutEl?.querySelector(TRANSFER_DV_GROUP_SELECTOR);
        const transferBlocks = [];

        TRANSFER_BLOCK_IDS.forEach((blockId) => {
            const blockEl = document.getElementById(blockId);
            const diagramEl = blockEl?.querySelector(TRANSFER_DIAGRAM_SELECTOR);
            const angleEl = blockEl?.querySelector('.result-display--angle');
            const labelEl = blockEl?.querySelector(TRANSFER_LABEL_SELECTOR);
            if (!blockEl || !diagramEl) return;
            if (!angleEl) return;

            const blockWidth = blockEl.clientWidth;
            if (!blockWidth) return;

            const blockRect = blockEl.getBoundingClientRect();
            const angleRect = angleEl.getBoundingClientRect();
            const blockStyles = window.getComputedStyle(blockEl);
            const gap = Number.parseFloat(blockStyles.rowGap || blockStyles.gap || '0') || 0;
            const availableHeight = Math.floor(Math.max(0, blockRect.bottom - angleRect.bottom - gap));
            const labelWidth = Math.ceil(labelEl?.scrollWidth ?? 0);
            const angleWidth = Math.ceil(angleEl.getBoundingClientRect().width);
            const stackedWidth = Math.max(labelWidth, angleWidth);
            const horizontalWidth = Math.max(stackedWidth, availableHeight);

            transferBlocks.push({
                availableHeight,
                blockEl,
                diagramEl,
                horizontalWidth,
                stackedWidth,
            });
        });

        if (!resultsLayoutEl || !transferRowEl || !dvGroupEl || transferBlocks.length !== TRANSFER_BLOCK_IDS.length) return;

        const resultsWidth = resultsLayoutEl.clientWidth;
        const layoutStyles = window.getComputedStyle(resultsLayoutEl);
        const transferRowStyles = window.getComputedStyle(transferRowEl);
        const layoutGap = Number.parseFloat(layoutStyles.columnGap || layoutStyles.gap || '0') || 0;
        const transferGap = Number.parseFloat(transferRowStyles.columnGap || transferRowStyles.gap || '0') || 0;
        const pairWidth = transferBlocks.reduce((sum, block) => sum + block.horizontalWidth, 0) + (transferGap * (transferBlocks.length - 1));
        const dvWidth = Math.ceil(dvGroupEl.getBoundingClientRect().width);

        const nextLayout = resultsWidth >= dvWidth + layoutGap + pairWidth
            ? 'wide'
            : resultsWidth >= pairWidth
                ? 'pair'
                : 'stacked';

        if (resultsLayoutEl.dataset.layout !== nextLayout) {
            resultsLayoutEl.dataset.layout = nextLayout;
            _syncTransferDiagramSizes();
            return;
        }

        resultsLayoutEl.dataset.layout = nextLayout;

        transferBlocks.forEach(({ availableHeight, blockEl, diagramEl, horizontalWidth, stackedWidth }) => {
            const size = nextLayout === 'stacked' ? stackedWidth : availableHeight;
            const minWidth = nextLayout === 'stacked' ? stackedWidth : horizontalWidth;

            diagramEl.style.setProperty('--phase-diagram-size', `${size}px`);
            blockEl.style.setProperty('--transfer-block-min-width', `${minWidth}px`);
        });
    });
}

function _buildTransferModel(pointABodyId, pointBBodyId, bodies, centralBodyId) {
    const pointABody = bodies[pointABodyId];
    const pointBBody = bodies[pointBBodyId];
    if (!pointABody || !pointBBody) return null;

    if (pointABodyId === pointBBodyId) return null;
    if (_isAncestorBody(pointABodyId, pointBBodyId, bodies) || _isAncestorBody(pointBBodyId, pointABodyId, bodies)) {
        return null;
    }

    const sharedHost = _findSharedHost(pointABodyId, pointBBodyId, bodies, centralBodyId);
    const centerBodyId = sharedHost ?? centralBodyId;
    const fromBodyId = _resolveDiagramBody(pointABodyId, centerBodyId, bodies);
    const toBodyId = _resolveDiagramBody(pointBBodyId, centerBodyId, bodies);

    if (!fromBodyId || !toBodyId || fromBodyId === toBodyId) return null;

    const centerBody = bodies[centerBodyId];
    const fromBody = bodies[fromBodyId];
    const toBody = bodies[toBodyId];
    if (!centerBody || !fromBody || !toBody) return null;

    return {
        centerBodyId,
        fromBodyId,
        toBodyId,
        centerLabel: centerBody.label,
        fromLabel: fromBody.label,
        toLabel: toBody.label,
        fromOrbitRadius: fromBody.orbit?.sma ?? 0,
        toOrbitRadius: toBody.orbit?.sma ?? 0,
    };
}

function _findSharedHost(bodyAId, bodyBId, bodies, centralBodyId) {
    const bodyA = bodies[bodyAId];
    const bodyB = bodies[bodyBId];
    if (!bodyA?.parent || !bodyB?.parent) return null;
    if (bodyA.parent !== bodyB.parent) return null;
    if (bodyA.parent === centralBodyId) return null;
    return bodyA.parent;
}

function _resolveDiagramBody(bodyId, centerBodyId, bodies) {
    let currentId = bodyId;

    while (currentId) {
        const body = bodies[currentId];
        if (!body) return null;
        if (body.parent === centerBodyId) return currentId;
        if (!body.parent) return null;
        currentId = body.transferAngleDiagram || body.parent;
    }

    return null;
}

function _isAncestorBody(ancestorId, bodyId, bodies) {
    let currentId = bodies[bodyId]?.parent ?? null;
    while (currentId) {
        if (currentId === ancestorId) return true;
        currentId = bodies[currentId]?.parent ?? null;
    }
    return false;
}

function _buildTransferDiagramSvg(transferModel, mode, bodies) {
    const svg = document.createElementNS(TRANSFER_SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 220 220');
    svg.setAttribute('class', 'transfer-diagram-svg');
    svg.setAttribute('aria-label', `${transferModel.centerLabel} transfer diagram`);

    const defs = document.createElementNS(TRANSFER_SVG_NS, 'defs');
    const gradient = document.createElementNS(TRANSFER_SVG_NS, 'radialGradient');
    gradient.setAttribute('id', `transfer-core-${mode}`);
    gradient.setAttribute('cx', '40%');
    gradient.setAttribute('cy', '35%');
    gradient.setAttribute('r', '65%');

    gradient.appendChild(_svgNode('stop', { offset: '0%', 'stop-color': '#fffa86' }));
    gradient.appendChild(_svgNode('stop', { offset: '65%', 'stop-color': '#ffb321' }));
    gradient.appendChild(_svgNode('stop', { offset: '100%', 'stop-color': '#ef6515' }));
    defs.appendChild(gradient);
    svg.appendChild(defs);

    const center = { x: 110, y: 110 };
    const radii = _resolveOrbitRadii();
    const fromIsInner = transferModel.fromOrbitRadius <= transferModel.toOrbitRadius;
    const fromRadius = fromIsInner ? radii.inner : radii.outer;
    const toRadius = fromIsInner ? radii.outer : radii.inner;

    const isDepart = mode === 'depart';
    const fixedPhaseAngle = -45;
    const transferStartRadius = isDepart ? fromRadius : toRadius;
    const transferEndRadius = isDepart ? toRadius : fromRadius;
    const transferStartAngle = isDepart ? 0 : fixedPhaseAngle;
    const transferEndAngle = 180;
    const bodyAPosition = _polarPoint(center, fromRadius, 0);
    const bodyBPosition = _polarPoint(center, toRadius, fixedPhaseAngle);
    const interceptPoint = _polarPoint(center, transferEndRadius, transferStartAngle + 180);

    svg.appendChild(_svgNode('circle', {
        cx: center.x,
        cy: center.y,
        r: radii.inner,
        class: 'transfer-orbit-ring',
    }));
    svg.appendChild(_svgNode('circle', {
        cx: center.x,
        cy: center.y,
        r: radii.outer,
        class: 'transfer-orbit-ring',
    }));

    svg.appendChild(_svgNode('path', {
        d: _buildTransferArcPath(center, transferStartRadius, transferEndRadius, transferStartAngle, transferEndAngle),
        class: 'transfer-trajectory',
    }));

    svg.appendChild(_svgNode('circle', {
        cx: interceptPoint.x.toFixed(2),
        cy: interceptPoint.y.toFixed(2),
        r: 3.5,
        class: 'transfer-intercept-point',
    }));

    svg.appendChild(_svgNode('circle', {
        cx: center.x,
        cy: center.y,
        r: transferModel.centerBodyId === 'kerbol' ? TRANSFER_KERBOL_CENTER_BODY_RADIUS : TRANSFER_CENTER_BODY_RADIUS,
        fill: `url(#transfer-core-${mode})`,
        class: 'transfer-center-body',
    }));

    svg.appendChild(_svgNode('circle', {
        cx: bodyAPosition.x,
        cy: bodyAPosition.y,
        r: 14,
        fill: bodies[transferModel.fromBodyId]?.mapColour || TRANSFER_BODY_A_COLOUR,
        class: 'transfer-body transfer-body-a',
    }));

    svg.appendChild(_svgNode('circle', {
        cx: bodyBPosition.x,
        cy: bodyBPosition.y,
        r: 14,
        fill: bodies[transferModel.toBodyId]?.mapColour || TRANSFER_BODY_B_COLOUR,
        class: 'transfer-body transfer-body-b',
    }));

    return svg;
}

function _resolveOrbitRadii() {
    return { inner: 48, outer: 78 };
}

function _buildTransferArcPath(center, startRadius, endRadius, startAngleDeg, endAngleDeg) {
    const a = (startRadius + endRadius) / 2;
    const b = Math.sqrt(startRadius * endRadius);
    const offsetX = (startRadius - endRadius) / 2;
    const steps = 40;
    const points = [];
    const rotation = (startAngleDeg * Math.PI) / 180;

    for (let i = 0; i <= steps; i += 1) {
        const t = (Math.PI * i) / steps;
        const baseX = offsetX + a * Math.cos(t);
        const baseY = -b * Math.sin(t);
        const x = center.x + (baseX * Math.cos(rotation)) - (baseY * Math.sin(rotation));
        const y = center.y + (baseX * Math.sin(rotation)) + (baseY * Math.cos(rotation));
        points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
    }

    return `M ${points.join(' L ')}`;
}

function _polarPoint(center, radius, angleDeg) {
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
        x: center.x + Math.cos(angleRad) * radius,
        y: center.y + Math.sin(angleRad) * radius,
    };
}

function _svgNode(tag, attrs) {
    const node = document.createElementNS(TRANSFER_SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
}
