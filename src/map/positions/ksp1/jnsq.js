(function attachJnsqMapPositions(global) {
    const JNSQ_POSITIONS = {
        interplanetary: { x: -7, y: 488 },

        kerbol_orbit: { x: -285, y: 490 },
        kerbol_land: { x: -445, y: 490 },
        kerbol_label: { x: -525, y: 488 },

        sun_orbit: { x: -285, y: 490 },
        sun_land: { x: -445, y: 490 },
        sun_label: { x: -525, y: 488 },

        moho_intercept: { x: -175, y: 401 },
        moho_orbit: { x: -315, y: 401 },
        moho_land: { x: -445, y: 401 },
        moho_label: { x: -510, y: 401 },

        eve_intercept: { x: -140, y: 333 },
        eve_orbit: { x: -300, y: 333 },
        eve_land: { x: -445, y: 333 },
        eve_label: { x: -505, y: 333 },

        gilly_intercept: { x: -220, y: 251 },
        gilly_orbit: { x: -335, y: 251 },
        gilly_land: { x: -425, y: 251 },
        gilly_label: { x: -500, y: 251 },

        kerbin_flyby: { x: -7, y: 570 },
        kerbin_orbit: { x: -7, y: 641 },
        kerbin_land: { x: -7, y: 712 },
        kerbin_label: { x: -30, y: 765 },

        mun_intercept: { x: -130, y: 606 },
        mun_orbit: { x: -240, y: 606 },
        mun_land: { x: -350, y: 606 },
        mun_label: { x: -405, y: 606 },

        minmus_intercept: { x: 116, y: 606 },
        minmus_orbit: { x: 225, y: 606 },
        minmus_land: { x: 335, y: 606 },
        minmus_label: { x: 370, y: 606 },

        duna_intercept: { x: -190, y: 171 },
        duna_orbit: { x: -330, y: 171 },
        duna_land: { x: -445, y: 171 },
        duna_label: { x: -515, y: 171 },

        ike_intercept: { x: -270, y: 115 },
        ike_orbit: { x: -345, y: 115 },
        ike_land: { x: -425, y: 115 },
        ike_label: { x: -490, y: 115 },

        edna_intercept: { x: 20, y: 189 },
        edna_orbit: { x: -260, y: 6 },
        edna_land: { x: -445, y: 6 },
        edna_label: { x: -510, y: 6 },

        dak_intercept: { x: 20, y: 100 },
        dak_orbit: { x: -60, y: 50 },
        dak_land: { x: -140, y: 6 },
        dak_label: { x: -200, y: 6 },

        dres_intercept: { x: -60, y: 189 },
        dres_orbit: { x: -260, y: 65 },
        dres_land: { x: -445, y: 65 },
        dres_label: { x: -510, y: 65 },

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

        lindor_intercept: { x: 470, y: 260 },
        lindor_orbit: { x: 720, y: 260 },
        lindor_land: { x: 800, y: 190 },
        lindor_label: { x: 780, y: 150 },

        huygen_intercept: { x: 472, y: 190 },
        huygen_orbit: { x: 472, y: 100 },
        huygen_land: { x: 472, y: 30 },
        huygen_label: { x: 455, y: -5 },

        krel_intercept: { x: 534, y: 180 },
        krel_orbit: { x: 534, y: 100 },
        krel_land: { x: 534, y: 30 },
        krel_label: { x: 525, y: -5 },

        aden_intercept: { x: 596, y: 180 },
        aden_orbit: { x: 596, y: 100 },
        aden_land: { x: 596, y: 30 },
        aden_label: { x: 580, y: -5 },

        riga_intercept: { x: 658, y: 180 },
        riga_orbit: { x: 658, y: 100 },
        riga_land: { x: 658, y: 30 },
        riga_label: { x: 640, y: -5 },

        talos_intercept: { x: 720, y: 190 },
        talos_orbit: { x: 720, y: 100 },
        talos_land: { x: 720, y: 30 },
        talos_label: { x: 705, y: -5 },

        eeloo_intercept: { x: 500, y: 540 },
        eeloo_orbit: { x: 660, y: 540 },
        eeloo_land: { x: 720, y: 620 },
        eeloo_label: { x: 720, y: 660 },

        celes_intercept: { x: 553, y: 600 },
        celes_orbit: { x: 553, y: 670 },
        celes_land: { x: 553, y: 750 },
        celes_label: { x: 530, y: 790 },

        tam_intercept: { x: 606, y: 600 },
        tam_orbit: { x: 606, y: 670 },
        tam_land: { x: 606, y: 750 },
        tam_label: { x: 595, y: 790 },

        hamek_intercept: { x: 540, y: 460 },
        hamek_orbit: { x: 720, y: 460 },
        hamek_land: { x: 820, y: 570 },
        hamek_label: { x: 850, y: 570 },

        nara_intercept: { x: 710, y: 360 },
        nara_orbit: { x: 910, y: 360 },
        nara_land: { x: 1050, y: 360 },
        nara_label: { x: 1080, y: 360 },

        amos_intercept: { x: 776, y: 300 },
        amos_orbit: { x: 842, y: 240 },
        amos_land: { x: 940, y: 240 },
        amos_label: { x: 970, y: 240 },

        enon_intercept: { x: 842, y: 300 },
        enon_orbit: { x: 930, y: 300 },
        enon_land: { x: 1020, y: 300 },
        enon_label: { x: 1050, y: 300 },

        prax_intercept: { x: 810, y: 430 },
        prax_orbit: { x: 930, y: 430 },
        prax_land: { x: 1070, y: 430 },
        prax_label: { x: 1100, y: 430 },
    };

    global.DeltaVMapPositionData = global.DeltaVMapPositionData || {};
    global.DeltaVMapPositionData.jnsq = JNSQ_POSITIONS;
})(window);
