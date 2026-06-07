const TRANSFER_SVG_NS = 'http://www.w3.org/2000/svg';
const TRANSFER_PLACEHOLDER = '\u2014';
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
let transferSizingFrame = null;

TRANSFER_RESIZE_EVENTS.forEach((eventName) => window.addEventListener(eventName, _syncTransferDiagramSizes));

function refreshTransferDisplay() {
    const bodies = typeof getBodies === 'function' ? getBodies() : null;
    const selection = typeof getSelectedPoints === 'function' ? getSelectedPoints() : null;
    const meta = typeof getSystemMeta === 'function' ? getSystemMeta() : null;
    const calculationResult = typeof getCalculationResult === 'function' ? getCalculationResult() : null;
    const transferAngles = calculationResult?.transferAngles || null;

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

    const transferModel = transferAngles?.model
        || _buildTransferModel(selection.pointA.body, selection.pointB.body, bodies, meta.centralBody);

    if (!transferModel) {
        _clearTransferBlock(arriveAngle, arriveDiagram);
        _clearTransferBlock(departAngle, departDiagram);
        _syncTransferDiagramSizes();
        return;
    }

    const showArrive = !returnOnly;
    const showDepart = roundTrip || returnOnly;

    _renderTransferBlock(arriveBlock, arriveAngle, arriveDiagram, transferModel, 'depart', showArrive, bodies, transferAngles?.arrive);
    _renderTransferBlock(departBlock, departAngle, departDiagram, transferModel, 'arrive', showDepart, bodies, transferAngles?.depart);
    _syncTransferDiagramSizes();
}

function _renderTransferBlock(blockEl, angleEl, diagramEl, transferModel, mode, isVisible, bodies, phaseAngle) {
    if (!isVisible || !Number.isFinite(phaseAngle)) {
        _clearTransferBlock(angleEl, diagramEl);
        return;
    }

    angleEl.value = `${_formatPhaseAngle(phaseAngle)}\u00B0`;
    blockEl.dataset.state = 'active';
    diagramEl.classList.remove('is-empty');
    diagramEl.innerHTML = '';
    diagramEl.appendChild(_buildTransferDiagramSvg(transferModel, mode, bodies, phaseAngle));
}

function _clearTransferBlock(angleEl, diagramEl) {
    angleEl.value = TRANSFER_PLACEHOLDER;
    diagramEl.classList.add('is-empty');
    diagramEl.innerHTML = '';
}

function _syncTransferDiagramSizes() {
    if (transferSizingFrame !== null) {
        window.cancelAnimationFrame(transferSizingFrame);
    }

    transferSizingFrame = window.requestAnimationFrame(() => {
        transferSizingFrame = null;
        const resultsLayoutEl = document.querySelector(TRANSFER_RESULTS_LAYOUT_SELECTOR);
        const transferRowEl = resultsLayoutEl?.querySelector(TRANSFER_ROW_SELECTOR);
        const dvGroupEl = resultsLayoutEl?.querySelector(TRANSFER_DV_GROUP_SELECTOR);
        const transferBlocks = [];

        if (!resultsLayoutEl || !transferRowEl || !dvGroupEl) return;

        const resultsWidth = resultsLayoutEl.clientWidth;
        const resultsHeight = resultsLayoutEl.clientHeight;
        if (!resultsWidth || !resultsHeight) return;

        TRANSFER_BLOCK_IDS.forEach((blockId) => {
            const blockEl = document.getElementById(blockId);
            const diagramEl = blockEl?.querySelector(TRANSFER_DIAGRAM_SELECTOR);
            const angleEl = blockEl?.querySelector('.result-display--angle');
            const labelEl = blockEl?.querySelector(TRANSFER_LABEL_SELECTOR);
            if (!blockEl || !diagramEl) return;
            if (!angleEl) return;

            const angleRect = angleEl.getBoundingClientRect();
            const blockRect = blockEl.getBoundingClientRect();
            const labelWidth = Math.ceil(labelEl?.scrollWidth ?? 0);
            const angleBottomOffset = Math.ceil(angleRect.bottom - blockRect.top);
            const blockStyles = window.getComputedStyle(blockEl);
            const blockGap = Number.parseFloat(blockStyles.rowGap || blockStyles.gap || '0') || 0;

            transferBlocks.push({
                angleBottomOffset,
                blockGap,
                blockEl,
                diagramEl,
                labelWidth,
            });
        });

        if (transferBlocks.length !== TRANSFER_BLOCK_IDS.length) return;

        if (_isMobilePortraitLayout()) {
            resultsLayoutEl.dataset.layout = 'pair';
            transferBlocks.forEach((block) => {
                block.diagramEl.style.removeProperty('--phase-diagram-size');
                block.blockEl.style.setProperty('--transfer-block-min-width', '0px');
            });
            return;
        }

        const layoutStyles = window.getComputedStyle(resultsLayoutEl);
        const transferRowStyles = window.getComputedStyle(transferRowEl);
        const layoutGap = Number.parseFloat(layoutStyles.rowGap || layoutStyles.gap || '0') || 0;
        const transferGap = Number.parseFloat(transferRowStyles.columnGap || transferRowStyles.gap || '0') || 0;
        const stackedGap = Number.parseFloat(transferRowStyles.rowGap || transferRowStyles.gap || '0') || 0;
        const dvWidth = Math.ceil(dvGroupEl.getBoundingClientRect().width);
        const dvHeight = Math.ceil(dvGroupEl.getBoundingClientRect().height);
        const stackedBlockHeight = Math.max(
            0,
            Math.floor((resultsHeight - dvHeight - layoutGap - (stackedGap * (transferBlocks.length - 1))) / transferBlocks.length),
        );

        const wideWidths = transferBlocks.map((block) => {
            const size = Math.max(0, Math.floor(resultsHeight - block.angleBottomOffset - block.blockGap));
            return {
                minWidth: Math.max(block.labelWidth, size),
                size,
            };
        });

        const pairWidths = transferBlocks.map((block) => {
            const size = Math.max(0, Math.floor(resultsHeight - dvHeight - layoutGap - block.angleBottomOffset - block.blockGap));
            return {
                minWidth: Math.max(block.labelWidth, size),
                size,
            };
        });

        const stackedSizes = transferBlocks.map((block) => Math.max(
            0,
            stackedBlockHeight - block.angleBottomOffset - block.blockGap,
        ));

        const wideWidth = wideWidths.reduce((sum, block) => sum + block.minWidth, 0) + (transferGap * (wideWidths.length - 1));
        const pairWidth = pairWidths.reduce((sum, block) => sum + block.minWidth, 0) + (transferGap * (pairWidths.length - 1));

        const nextLayout = resultsWidth >= dvWidth + layoutGap + wideWidth
            ? 'wide'
            : resultsWidth >= pairWidth
                ? 'pair'
                : 'stacked';

        resultsLayoutEl.dataset.layout = nextLayout;

        transferBlocks.forEach((block, index) => {
            const horizontalMetrics = nextLayout === 'wide' ? wideWidths[index] : pairWidths[index];
            const size = nextLayout === 'stacked' ? stackedSizes[index] : horizontalMetrics.size;
            const minWidth = nextLayout === 'stacked' ? 0 : horizontalMetrics.minWidth;

            block.diagramEl.style.setProperty('--phase-diagram-size', `${size}px`);
            block.blockEl.style.setProperty('--transfer-block-min-width', `${minWidth}px`);
        });
    });
}

function _isMobilePortraitLayout() {
    return window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches;
}

function _buildTransferModel(pointABodyId, pointBBodyId, bodies, centralBodyId) {
    return window.DeltaVCalc?.resolveTransferWindowModel?.(pointABodyId, pointBBodyId, bodies, centralBodyId) || null;
}

function _buildTransferDiagramSvg(transferModel, mode, bodies, phaseAngle) {
    const svg = document.createElementNS(TRANSFER_SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 220 220');
    svg.setAttribute('class', 'transfer-diagram-svg');
    svg.setAttribute('aria-label', `${transferModel.centerLabel} transfer diagram`);

    const center = { x: 110, y: 110 };
    const radii = _resolveOrbitRadii();
    const fromIsInner = transferModel.fromOrbitRadius <= transferModel.toOrbitRadius;
    const fromRadius = fromIsInner ? radii.inner : radii.outer;
    const toRadius = fromIsInner ? radii.outer : radii.inner;

    const isDepart = mode === 'depart';
    const targetAngle = -phaseAngle;
    const transferStartRadius = isDepart ? fromRadius : toRadius;
    const transferEndRadius = isDepart ? toRadius : fromRadius;
    const transferStartAngle = isDepart ? 0 : targetAngle;
    const transferEndAngle = 180;
    const bodyAPosition = _polarPoint(center, fromRadius, 0);
    const bodyBPosition = _polarPoint(center, toRadius, targetAngle);
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
        fill: bodies[transferModel.centerBodyId]?.mapColour || TRANSFER_BODY_A_COLOUR,
        class: 'transfer-center-body transfer-body',
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

function _formatPhaseAngle(angle) {
    if (!Number.isFinite(angle)) return TRANSFER_PLACEHOLDER;

    const rounded = Math.round(angle * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
        return String(Math.round(rounded));
    }

    return rounded.toFixed(1);
}

function _svgNode(tag, attrs) {
    const node = document.createElementNS(TRANSFER_SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
}
