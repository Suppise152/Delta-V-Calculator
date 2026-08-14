(function attachMapPositions(global) {
    const data = global.DeltaVMapPositionData;

    const DEFAULT_VIEW_BOX = '0 -25 1000 810';
    const MAP_LAYOUTS = {
        stock: {
            id: 'stock',
            label: 'Stock',
            viewBox: DEFAULT_VIEW_BOX,
            positions: data.stock,
        },
        opm: {
            id: 'opm',
            label: 'OPM',
            viewBox: '-550 -25 1700 820',
            positions: data.opm,
        },
        rss: {
            id: 'rss',
            label: 'RSS',
            viewBox: '-610 -25 1780 820',
            positions: data.rss,
        },
        ksrss: {
            id: 'ksrss',
            label: 'KSRSS',
            viewBox: '-635 -90 1865 940',
            positions: data.ksrss,
        },
        jnsq: {
            id: 'jnsq',
            label: 'JNSQ',
            viewBox: '-550 -90 1700 935',
            positions: data.jnsq,
        },
        kerbol: {
            id: 'kerbol',
            label: 'Kerbol',
            viewBox: DEFAULT_VIEW_BOX,
            positions: data.kerbol,
        },
    };

    /**
     * Inputs: map pack/layout id.
     * Outputs: matching layout descriptor, falling back to stock.
     */
    function getMapLayout(mapId) {
        return MAP_LAYOUTS[mapId] || MAP_LAYOUTS.stock;
    }

    /**
     * Inputs: none.
     * Outputs: all map layout descriptors as an array.
     */
    function getMapLayouts() {
        return Object.values(MAP_LAYOUTS);
    }

    global.DeltaVMapPositions = {
        STOCK_POSITIONS: data.stock,
        OPM_POSITIONS: data.opm,
        RSS_POSITIONS: data.rss,
        KSRSS_POSITIONS: data.ksrss,
        JNSQ_POSITIONS: data.jnsq,
        KERBOL_POSITIONS: data.kerbol,
        getMapLayout,
        getMapLayouts,
    };
})(window);
