(function attachOpmMapPositions(global) {
    const { _shiftPositions } = global.DeltaVMapPositionHelpers;
    const STOCK_POSITIONS = global.DeltaVMapPositionData.stock;

    const OPM_POSITIONS = {
        ..._shiftPositions(STOCK_POSITIONS, -500),

        jool_intercept: { x: 80, y: 256 },
        jool_orbit: { x: 330, y: 256 },
        jool_land: { x: 400, y: 180 },
        jool_label: { x: 385, y: 140 },

        laythe_intercept: { x: 330, y: 190 },
        laythe_orbit: { x: 330, y: 110 },
        laythe_land: { x: 330, y: 32 },
        laythe_label: { x: 330, y: -10 },

        vall_intercept: { x: 268, y: 180 },
        vall_orbit: { x: 268, y: 105 },
        vall_land: { x: 268, y: 32 },
        vall_label: { x: 268, y: -10 },

        tylo_intercept: { x: 206, y: 180 },
        tylo_orbit: { x: 206, y: 109 },
        tylo_land: { x: 206, y: 32 },
        tylo_label: { x: 206, y: -10 },

        bop_intercept: { x: 144, y: 180 },
        bop_orbit: { x: 144, y: 107 },
        bop_land: { x: 144, y: 32 },
        bop_label: { x: 144, y: -10 },

        pol_intercept: { x: 80, y: 190 },
        pol_orbit: { x: 80, y: 108 },
        pol_land: { x: 80, y: 32 },
        pol_label: { x: 80, y: -10 },

        sarnus_intercept: { x: 470, y: 260 },
        sarnus_orbit: { x: 720, y: 260 },
        sarnus_land: { x: 800, y: 190 },
        sarnus_label: { x: 780, y: 150 },

        tekto_intercept: { x: 720, y: 190 },
        tekto_orbit: { x: 720, y: 100 },
        tekto_land: { x: 720, y: 30 },
        tekto_label: { x: 705, y: -5 },

        slate_intercept: { x: 658, y: 180 },
        slate_orbit: { x: 658, y: 100 },
        slate_land: { x: 658, y: 30 },
        slate_label: { x: 640, y: -5 },

        eeloo_intercept: { x: 596, y: 180 },
        eeloo_orbit: { x: 596, y: 100 },
        eeloo_land: { x: 596, y: 30 },
        eeloo_label: { x: 580, y: -5 },

        ovok_intercept: { x: 534, y: 180 },
        ovok_orbit: { x: 534, y: 100 },
        ovok_land: { x: 534, y: 30 },
        ovok_label: { x: 525, y: -5 },

        hale_intercept: { x: 472, y: 190 },
        hale_orbit: { x: 472, y: 100 },
        hale_land: { x: 472, y: 30 },
        hale_label: { x: 455, y: -5 },

        urlum_intercept: { x: 710, y: 360 },
        urlum_orbit: { x: 910, y: 360 },
        urlum_land: { x: 1050, y: 360 },
        urlum_label: { x: 1080, y: 360 },

        polta_intercept: { x: 776, y: 300 },
        polta_orbit: { x: 842, y: 240 },
        polta_land: { x: 940, y: 240 },
        polta_label: { x: 970, y: 240 },

        priax_intercept: { x: 842, y: 300 },
        priax_orbit: { x: 930, y: 300 },
        priax_land: { x: 1020, y: 300 },
        priax_label: { x: 1050, y: 300 },

        wal_intercept: { x: 810, y: 430 },
        wal_orbit: { x: 930, y: 430 },
        wal_land: { x: 1070, y: 430 },
        wal_label: { x: 1100, y: 430 },

        tal_intercept: { x: 870, y: 490 },
        tal_orbit: { x: 970, y: 490 },
        tal_land: { x: 1070, y: 490 },
        tal_label: { x: 1100, y: 490 },

        neidon_intercept: { x: 540, y: 460 },
        neidon_orbit: { x: 720, y: 460 },
        neidon_land: { x: 820, y: 570 },
        neidon_label: { x: 850, y: 570 },

        nissee_intercept: { x: 600, y: 550 },
        nissee_orbit: { x: 650, y: 670 },
        nissee_land: { x: 730, y: 710 },
        nissee_label: { x: 765, y: 710 },

        thatmo_intercept: { x: 660, y: 550 },
        thatmo_orbit: { x: 720, y: 620 },
        thatmo_land: { x: 800, y: 660 },
        thatmo_label: { x: 835, y: 660 },

        plock_intercept: { x: 500, y: 540 },
        plock_orbit: { x: 550, y: 630 },
        plock_land: { x: 550, y: 720 },
        plock_label: { x: 530, y: 760 },

        karen_intercept: { x: 465, y: 605 },
        karen_orbit: { x: 465, y: 685 },
        karen_land: { x: 465, y: 765 },
        karen_label: { x: 385, y: 765 },
    };

    global.DeltaVMapPositionData.opm = OPM_POSITIONS;
})(window);
