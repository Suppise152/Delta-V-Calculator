let firstCall = true;

/**
 * Handles the dropdown menu
 **/
document.addEventListener('DOMContentLoaded', function () {

    // Add a click event listener to toggle the dropdown when clicking on the display text box
    document.getElementById('dV_display').addEventListener('click', function (event) {
        event.stopPropagation(); // Prevent the click event from reaching the document
        toggleDropdown();
    });

    document.getElementById('toggle8').addEventListener('click', function (event) {
        event.stopPropagation(); // Prevent the click event from reaching the document
        return;
    });

    // Add a click event listener to close the dropdown when clicking outside
    document.addEventListener('click', function () {
        closeDropdown();
    });
});

function populateDropdown() {
    let dropdown = document.getElementById('dv-dropdown');

    let atmo;

    // Clear the dropdown of existing entries
    dropdown.innerHTML = '';

    let entry = document.createElement('div');
    entry.textContent = ' - End - ';
    entry.style.color = 'red';
    dropdown.appendChild(entry);


    // Populate the dropdown with entries
    switch (prevBranch) {
        case 'Kerbin': // Kerbin------------------------------------------------------------------------
            atmo = true;
            if (toggle1.checked) { // Round trip
                switch (prevNode) {
                    case 0:
                        kerbinDescent();
                        break;
                    case 1:
                        kerbinDescent();
                        kerbinLowOrbit();
                        let entry = document.createElement('div');
                        entry.textContent = prevBranch + ' encounter: ' + 0;
                        dropdown.appendChild(entry);
                        entry = document.createElement('div');
                        entry.textContent = prevBranch + ' escape: ' + Math.round(950 * redundancy);
                        dropdown.appendChild(entry);
                        break;
                }
            } else if (toggle4.checked) { // Return only
                switch (prevNode) {
                    case 0:
                        kerbinDescent();
                        break;
                    case 1:
                        let entry = document.createElement('div');
                        entry.textContent = prevBranch + ' escape: ' + Math.round(950 * redundancy);
                        dropdown.appendChild(entry);
                        break;
                }
            } else { // One way
                switch (prevNode) {
                    case 0:
                        break;
                    case 1:
                        let entry = document.createElement('div');
                        entry.textContent = prevBranch + ' escape: ' + Math.round(950 * redundancy);
                        dropdown.appendChild(entry);
                        break;
                }
            }
            break;
        case 'Mun': // Mun------------------------------------------------------------------------------
            atmo = false;
            if (toggle1.checked) { // Round trip
                switch (prevNode) {
                    case 0:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(860 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        encounter(atmo);
                        break;
                    case 1:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(860 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        lowOrbit(atmo);
                        encounter(atmo);
                        break;
                    case 2:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(860 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        escape(atmo);
                        ascent();
                        descent(atmo);
                        lowOrbit(atmo);
                        encounter(atmo);
                        break;
                }
            } else if (toggle4.checked) { // Return only
                switch (prevNode) {
                    case 0:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(860 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        break;
                    case 1:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(860 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        escape(atmo);
                        break;
                    case 2:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(860 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        escape(atmo);
                        ascent();
                        break;
                }
            } else { // One way
                switch (prevNode) {
                    case 0:
                        encounter(atmo);
                        break;
                    case 1:
                        lowOrbit(atmo);
                        encounter(atmo);
                        break;
                    case 2:
                        descent(atmo);
                        lowOrbit(atmo);
                        encounter(atmo);
                        break;
                }
            }
            break;
        case 'Minmus': // Minmus------------------------------------------------------------------------
            atmo = false;
            if (toggle1.checked) { // Round trip
                switch (prevNode) {
                    case 0:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(1170 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        encounter(atmo);
                        break;
                    case 1:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(1170 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        lowOrbit(atmo);
                        encounter(atmo);
                        break;
                    case 2:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(1170 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        escape(atmo);
                        ascent();
                        descent(atmo);
                        lowOrbit(atmo);
                        encounter(atmo);
                        break;
                }
            } else if (toggle4.checked) { // Return only
                switch (prevNode) {
                    case 0:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(1170 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        break;
                    case 1:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(1170 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        escape(atmo);
                        break;
                    case 2:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(1170 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        escape(atmo);
                        ascent();
                        break;
                }
            } else { // One way
                switch (prevNode) {
                    case 0:
                        encounter(atmo);
                        break;
                    case 1:
                        lowOrbit(atmo);
                        encounter(atmo);
                        break;
                    case 2:
                        descent(atmo);
                        lowOrbit(atmo);
                        encounter(atmo);
                        break;
                }
            }
            break;
        case 'Sun': // Sun------------------------------------------------------------------------------
            atmo = false;
            if (toggle1.checked) { // Round trip
                let entry = document.createElement('div');
                switch (prevNode) {
                    case 0:
                        kerbinDescent();
                        kerbinLowOrbit();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Kerbin encounter: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Kerbin encounter: ' + Math.round(19700 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        entry.textContent = ' Low Kerbol orbit: ' + Math.round(19700 * redundancy);
                        dropdown.appendChild(entry);
                        entry = document.createElement('div');
                        entry.textContent = 'Kerbin escape: ' + Math.round(950 * redundancy);
                        dropdown.appendChild(entry);
                        break;
                    case 1:
                        kerbinDescent();
                        kerbinLowOrbit();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Kerbin encounter: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Kerbin encounter: ' + Math.round(19700 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        entry.textContent = ' Low Kerbol orbit: ' + Math.round(67000 * redundancy);
                        dropdown.appendChild(entry);
                        entry = document.createElement('div');
                        entry.textContent = ' Kerbol descent: ' + Math.round(67000 * redundancy);
                        dropdown.appendChild(entry);
                        entry = document.createElement('div');
                        entry.textContent = ' Low Kerbol orbit: ' + Math.round(19700 * redundancy);
                        dropdown.appendChild(entry);
                        entry = document.createElement('div');
                        entry.textContent = 'Kerbin escape: ' + Math.round(950 * redundancy);
                        dropdown.appendChild(entry);
                        break;
                }
            } else if (toggle4.checked) { // Return only
                switch (prevNode) {
                    case 0:
                        kerbinDescent();
                        kerbinLowOrbit();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Kerbin encounter: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Kerbin encounter: ' + Math.round(19700 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        break;
                    case 1:
                        kerbinDescent();
                        kerbinLowOrbit();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Kerbin encounter: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Kerbin encounter: ' + Math.round(19700 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        entry = document.createElement('div');
                        entry.textContent = ' Low Kerbol orbit: ' + Math.round(67000 * redundancy);
                        dropdown.appendChild(entry);

                        break;
                }
            } else { // One way
                let entry = document.createElement('div');
                switch (prevNode) {
                    case 0:
                        entry.textContent = ' Low Kerbol orbit: ' + Math.round(19700 * redundancy);
                        dropdown.appendChild(entry);
                        entry = document.createElement('div');
                        entry.textContent = 'Kerbin escape: ' + Math.round(950 * redundancy);
                        dropdown.appendChild(entry);
                        break;
                    case 1:
                        entry.textContent = ' Kerbol descent: ' + Math.round(67000 * redundancy);
                        dropdown.appendChild(entry);
                        entry = document.createElement('div');
                        entry.textContent = ' Low Kerbol orbit: ' + Math.round(19700 * redundancy);
                        dropdown.appendChild(entry);
                        entry = document.createElement('div');
                        entry.textContent = 'Kerbin escape: ' + Math.round(950 * redundancy);
                        dropdown.appendChild(entry);
                        break;
                }
            }
            break;
        default: // Interplanetary ---------------------------------------------------------------------
            switch (prevBranch) {
                case 'Eve':
                    atmo = true;
                    break;
                case 'Duna':
                    atmo = true;
                    break;
                case 'Jool':
                    atmo = true;
                    break;
                case 'Laythe':
                    atmo = true;
                    break;
                default:
                    atmo = false;
                    break;
            }
            if (toggle1.checked) { // Round trip
                switch (prevNode) {
                    case 0:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(950 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        encounter(atmo);
                        break;
                    case 1:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(950 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        lowOrbit(atmo);
                        encounter(atmo);
                        break;
                    case 2:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(950 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        escape(atmo);
                        ascent();
                        descent(atmo);
                        lowOrbit(atmo);
                        encounter(atmo);
                        break;
                }
                let entry = document.createElement('div');
                entry.textContent = 'Kerbin escape: ' + Math.round(950 * redundancy);
                dropdown.appendChild(entry);
            } else if (toggle4.checked) { // Return only
                switch (prevNode) {
                    case 0:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(950 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        break;
                    case 1:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(950 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        escape(atmo);
                        break;
                    case 2:
                        kerbinDescent();
                        if (toggle6.checked) {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + 0;
                            dropdown.appendChild(entry);
                        } else {
                            let entry = document.createElement('div');
                            entry.textContent = 'Low Kerbin orbit: ' + Math.round(950 * redundancy);
                            dropdown.appendChild(entry);
                        }
                        escape(atmo);
                        ascent();
                        break;
                }
            } else { // One way
                switch (prevNode) {
                    case 0:
                        encounter(atmo);
                        break;
                    case 1:
                        lowOrbit(atmo);
                        encounter(atmo);
                        break;
                    case 2:
                        descent(atmo);
                        lowOrbit(atmo);
                        encounter(atmo);
                        break;
                }
                let entry = document.createElement('div');
                entry.textContent = 'Kerbin escape: ' + Math.round(950 * redundancy);
                dropdown.appendChild(entry);
            }

            break;
    }
    if (!toggle4.checked && !toggle7.checked) {
        entry = document.createElement('div');
        entry.textContent = 'Low Kerbin orbit: ' + Math.round(3400 * redundancy);
        entry.style.color = 'white';
        dropdown.appendChild(entry);
    }

    entry = document.createElement('div');
    entry.textContent = ' - Start - ';
    entry.style.color = 'rgb(50, 255, 50)';
    dropdown.appendChild(entry);
}

// LKO to surface
function kerbinDescent() {
    let dropdown = document.getElementById('dv-dropdown');

    if (toggle5.checked || toggle6.checked) {
        let entry = document.createElement('div');
        entry.textContent = 'Kerbin descent: ' + 0;
        entry.style.color = 'white';
        dropdown.appendChild(entry);
        return;
    }
    let entry = document.createElement('div');
    entry.textContent = 'Kerbin descent: ' + Math.round(3400 * redundancy);
    entry.style.color = 'white';
    dropdown.appendChild(entry);
}

// Interplanetary to LKO
function kerbinLowOrbit() {
    let dropdown = document.getElementById('dv-dropdown');

    if (toggle6.checked) {
        let entry = document.createElement('div');
        entry.textContent = 'Low Kerbin orbit: ' + 0;
        dropdown.appendChild(entry);
        return;
    }
    let entry = document.createElement('div');
    entry.textContent = 'Low Kerbin orbit: ' + Math.round(950 * redundancy);
    dropdown.appendChild(entry);
}

// Encounter target
function encounter(atmo) {
    let dropdown = document.getElementById('dv-dropdown');

    const branch = document.getElementById(prevBranch);
    const nodes = branch.getElementsByClassName('node');
    const node = nodes[0];
    const nodeValue = parseInt(node.dataset.value);

    // Edge cases for moons of atmospheric planets (60 line switch statement lol)
    switch (prevBranch) {
        case 'Gilly':
            if (toggle3.checked) {
                let entry = document.createElement('div');
                entry.textContent = prevBranch + ' ' + 'encounter: ' + Math.round((nodeValue - 1470) * redundancy);
                dropdown.appendChild(entry);
                return;
            }
            break;
        case 'Ike':
            if (toggle3.checked) {
                let entry = document.createElement('div');
                entry.textContent = prevBranch + ' ' + 'encounter: ' + Math.round((nodeValue - 1090) * redundancy);
                dropdown.appendChild(entry);
                return;
            }
            break;
        case 'Laythe':
            if (toggle3.checked) {
                let entry = document.createElement('div');
                entry.textContent = prevBranch + ' ' + 'encounter: ' + Math.round((nodeValue - 2200) * redundancy);
                dropdown.appendChild(entry);
                return;
            }
            break;
        case 'Vall':
            if (toggle3.checked) {
                let entry = document.createElement('div');
                entry.textContent = prevBranch + ' ' + 'encounter: ' + Math.round((nodeValue - 2200) * redundancy);
                dropdown.appendChild(entry);
                return;
            }
            break;
        case 'Tylo':
            if (toggle3.checked) {
                let entry = document.createElement('div');
                entry.textContent = prevBranch + ' ' + 'encounter: ' + Math.round((nodeValue - 2200) * redundancy);
                dropdown.appendChild(entry);
                return;
            }
            break;
        case 'Bop':
            if (toggle3.checked) {
                let entry = document.createElement('div');
                entry.textContent = prevBranch + ' ' + 'encounter: ' + Math.round((nodeValue - 2200) * redundancy);
                dropdown.appendChild(entry);
                return;
            }
            break;
        case 'Pol':
            if (toggle3.checked) {
                let entry = document.createElement('div');
                entry.textContent = prevBranch + ' ' + 'encounter: ' + Math.round((nodeValue - 2200) * redundancy);
                dropdown.appendChild(entry);
                return;
            }
            break;
    }

    if (atmo) {
        if (toggle3.checked) {
            let entry = document.createElement('div');
            entry.textContent = prevBranch + ' ' + 'encounter: ' + 0;
            dropdown.appendChild(entry);
            return;
        }
    }
    let entry = document.createElement('div');
    entry.textContent = prevBranch + ' ' + 'encounter: ' + Math.round(nodeValue * redundancy);
    dropdown.appendChild(entry);
}

// Intercept to low orbit
function lowOrbit(atmo) {
    let dropdown = document.getElementById('dv-dropdown');

    const branch = document.getElementById(prevBranch);
    const nodes = branch.getElementsByClassName('node');
    const node = nodes[1];
    const nodeValue = parseInt(node.dataset.value);

    if (atmo) {
        if (toggle3.checked) {
            let entry = document.createElement('div');
            entry.textContent = prevBranch + ' ' + 'low orbit: ' + 0;
            dropdown.appendChild(entry);
            return;
        }
    }
    let entry = document.createElement('div');
    entry.textContent = 'Low ' + prevBranch + ' orbit: ' + Math.round(nodeValue * redundancy);
    dropdown.appendChild(entry);
}

// Low orbit to surface
function descent(atmo) {
    let dropdown = document.getElementById('dv-dropdown');

    const branch = document.getElementById(prevBranch);
    const nodes = branch.getElementsByClassName('node');
    const node = nodes[2];
    const nodeValue = parseInt(node.dataset.value);

    if (atmo) {
        if (toggle2.checked || toggle3.checked) {
            let entry = document.createElement('div');
            entry.textContent = prevBranch + ' ' + 'descent: ' + 0;
            entry.style.color = 'white';
            dropdown.appendChild(entry);
            return;
        }
    }
    let entry = document.createElement('div');
    entry.textContent = prevBranch + ' ' + 'descent: ' + Math.round(nodeValue * redundancy);
    entry.style.color = 'white';
    dropdown.appendChild(entry);
}

// Surface to low orbit
function ascent() {
    let dropdown = document.getElementById('dv-dropdown');

    const branch = document.getElementById(prevBranch);
    const nodes = branch.getElementsByClassName('node');
    const node = nodes[2];
    const nodeValue = parseInt(node.dataset.value);
    let entry = document.createElement('div');
    entry.textContent = 'Low ' + prevBranch + ' ' + 'orbit: ' + Math.round(nodeValue * redundancy);
    entry.style.color = 'white';
    dropdown.appendChild(entry);
}

// Low orbit to escape
function escape(atmo) {
    let dropdown = document.getElementById('dv-dropdown');

    const branch = document.getElementById(prevBranch);
    const nodes = branch.getElementsByClassName('node');
    const node = nodes[1];
    const nodeValue = parseInt(node.dataset.value);

    if (atmo) {
        if (toggle6.checked && 0) {
            let entry = document.createElement('div');
            entry.textContent = prevBranch + ' ' + 'escape: ' + 0;
            dropdown.appendChild(entry);
            return;
        }
    }
    let entry = document.createElement('div');
    entry.textContent = prevBranch + ' ' + 'escape: ' + Math.round(nodeValue * redundancy);
    dropdown.appendChild(entry);
}

/**
 * Toggles the dropdown menu when clicking on the dv display text box
 * 
 **/
function toggleDropdown() {
    let dropdownContent = document.getElementById('dv-dropdown');
    if (dropdownContent.style.display === 'block') {
        dropdownContent.style.display = 'none';
        toggle8.checked = false;
    } else {
        dropdownContent.style.display = 'block';
        toggle8.checked = true;
    }
    // dropdownContent.style.display = (dropdownContent.style.display === 'block') ? 'none' : 'block';
}

/**
 * Closes the dropdown menu when clicking outside of the dropdown
 * 
 **/
function closeDropdown() {
    let dropdownContent = document.getElementById('dv-dropdown');
    const toggle8 = document.getElementById('toggle8');
    dropdownContent.style.display = 'none';
    toggle8.checked = false;
}