(function attachRssMapPositions(global) {
    const { _shiftBodyPositions } = global.DeltaVMapPositionHelpers;
    const OPM_POSITIONS = global.DeltaVMapPositionData.opm;

    const RSS_POSITIONS = {
        interplanetary: { x: OPM_POSITIONS.interplanetary.x, y: OPM_POSITIONS.interplanetary.y },

        sol_orbit: { x: 155, y: 490 },
        sol_land: { x: 5, y: 490 },
        sol_label: { x: -55, y: 490 },

        // ─── INNER PLANETS ─────────────────
        mercury_intercept: { x: 325, y: 420 },
        mercury_orbit: { x: 185, y: 420 },
        mercury_land: { x: 55, y: 420 },
        mercury_label: { x: -40, y: 420 },

        venus_intercept: { x: 360, y: 350 },
        venus_orbit: { x: 200, y: 350 },
        venus_land: { x: 55, y: 350 },
        venus_label: { x: -30, y: 350 },

        earth_flyby: { x: 493, y: 580 },
        earth_orbit: { x: 493, y: 650 },
        earth_land: { x: 493, y: 720 },
        earth_label: { x: 475, y: 770 },

        moon_intercept: { x: 370, y: 615 },
        moon_orbit: { x: 260, y: 615 },
        moon_land: { x: 150, y: 615 },
        moon_label: { x: 85, y: 615 },

        mars_intercept: { x: 370, y: 200 },
        mars_orbit: { x: 170, y: 200 },
        mars_land: { x: 55, y: 200 },
        mars_label: { x: -15, y: 200 },

        phobos_intercept: { x: 270, y: 130 },
        phobos_orbit: { x: 170, y: 130 },
        phobos_land: { x: 100, y: 130 },
        phobos_label: { x: 20, y: 130 },

        deimos_intercept: { x: 270, y: 270 },
        deimos_orbit: { x: 170, y: 270 },
        deimos_land: { x: 100, y: 270 },
        deimos_label: { x: 20, y: 270 },

        ceres_intercept: { x: 430, y: 160 },
        ceres_orbit: { x: 300, y: 70 },
        ceres_land: { x: 120, y: 70 },
        ceres_label: { x: 40, y: 70 },

        vesta_intercept: { x: 510, y: 160 },
        vesta_orbit: { x: 300, y: 15 },
        vesta_land: { x: 120, y: 15 },
        vesta_label: { x: 40, y: 15 },

        jupiter_intercept: { x: 80, y: 256 },
        jupiter_orbit: { x: 330, y: 256 },
        jupiter_land: { x: 400, y: 180 },
        jupiter_label: { x: 385, y: 140 },

        io_intercept: { x: 330, y: 190 },
        io_orbit: { x: 330, y: 110 },
        io_land: { x: 330, y: 32 },
        io_label: { x: 320, y: -10 },

        europa_intercept: { x: 246, y: 180 },
        europa_orbit: { x: 246, y: 105 },
        europa_land: { x: 246, y: 32 },
        europa_label: { x: 226, y: -10 },

        ganymede_intercept: { x: 163, y: 180 },
        ganymede_orbit: { x: 163, y: 109 },
        ganymede_land: { x: 163, y: 32 },
        ganymede_label: { x: 135, y: -10 },

        callisto_intercept: { x: 80, y: 190 },
        callisto_orbit: { x: 80, y: 107 },
        callisto_land: { x: 80, y: 32 },
        callisto_label: { x: 50, y: -10 },

        saturn_intercept: { x: 470, y: 260 },
        saturn_orbit: { x: 720, y: 260 },
        saturn_land: { x: 800, y: 190 },
        saturn_label: { x: 780, y: 150 },

        titan_intercept: { x: 720, y: 190 },
        titan_orbit: { x: 720, y: 100 },
        titan_land: { x: 720, y: 30 },
        titan_label: { x: 700, y: -10 },

        rhea_intercept: { x: 637, y: 180 },
        rhea_orbit: { x: 637, y: 100 },
        rhea_land: { x: 637, y: 30 },
        rhea_label: { x: 617, y: -10 },

        dione_intercept: { x: 554, y: 180 },
        dione_orbit: { x: 554, y: 100 },
        dione_land: { x: 554, y: 30 },
        dione_label: { x: 534, y: -10 },

        enceladus_intercept: { x: 470, y: 180 },
        enceladus_orbit: { x: 470, y: 100 },
        enceladus_land: { x: 470, y: 30 },
        enceladus_label: { x: 435, y: -10 },

        uranus_intercept: { x: 730, y: 360 },
        uranus_orbit: { x: 1080, y: 360 },
        uranus_land: { x: 1150, y: 470 },
        uranus_label: { x: 1130, y: 510 },

        miranda_intercept: { x: 740, y: 430 },
        miranda_orbit: { x: 740, y: 520 },
        miranda_land: { x: 740, y: 590 },
        miranda_label: { x: 715, y: 630 },

        ariel_intercept: { x: 823, y: 430 },
        ariel_orbit: { x: 823, y: 520 },
        ariel_land: { x: 823, y: 590 },
        ariel_label: { x: 807, y: 630 },

        umbriel_intercept: { x: 905, y: 430 },
        umbriel_orbit: { x: 905, y: 520 },
        umbriel_land: { x: 905, y: 590 },
        umbriel_label: { x: 880, y: 630 },

        titania_intercept: { x: 988, y: 430 },
        titania_orbit: { x: 988, y: 520 },
        titania_land: { x: 988, y: 590 },
        titania_label: { x: 965, y: 630 },

        oberon_intercept: { x: 1070, y: 430 },
        oberon_orbit: { x: 1070, y: 520 },
        oberon_land: { x: 1070, y: 590 },
        oberon_label: { x: 1048, y: 630 },

        neptune_intercept: { x: 430, y: 520 },
        neptune_orbit: { x: 570, y: 520 },
        neptune_land: { x: 640, y: 620 },
        neptune_label: { x: 630, y: 660 },

        triton_intercept: { x: 500, y: 590 },
        triton_orbit: { x: 500, y: 660 },
        triton_land: { x: 560, y: 710 },
        triton_label: { x: 550, y: 750 },

        pluto_intercept: { x: 140, y: 600 },
        pluto_orbit: { x: 260, y: 600 },
        pluto_land: { x: 370, y: 600 },
        pluto_label: { x: 400, y: 600 },

        charon_intercept: { x: 205, y: 680 },
        charon_orbit: { x: 310, y: 680 },
        charon_land: { x: 390, y: 680 },
        charon_label: { x: 420, y: 680 },
    };

    _shiftBodyPositions(RSS_POSITIONS, [
        'sol',
        'mercury',
        'venus',
        'earth',
        'moon',
        'mars',
        'phobos',
        'deimos',
        'ceres',
        'vesta',
    ], -500);

    global.DeltaVMapPositionData.rss = RSS_POSITIONS;
})(window);
