let prevBranch;
let prevNode;
let prevImg;

let redundancy = 1;

/**
 * Handles slider changes, and recalculates the sum.
 */
const slider = document.getElementById('slider');
const sliderValue = document.getElementById('slider-value');

// Set the initial value and update the value text
slider.value = 0;

// Add an input event listener to the slider
slider.addEventListener('input', function () {
    handleSliderChange(slider); // Call your calculation function here with the slider value
});


/**
 * Handles changes needed for the given slider, and recalculates the sum.
 * 
 * @param {*} slider 
 */
function handleSliderChange(slider) {
    const display = document.getElementById('slider-value');

    switch (slider.value) {
        case '0':
            redundancy = 1;
            display.textContent = `+  0% Redundancy`;
            break;
        case '1':
            redundancy = 1.1;
            display.textContent = `+  10% Redundancy`;
            break;
        case '2':
            redundancy = 1.15;
            display.textContent = `+  15% Redundancy`;
            break;
        case '3':
            redundancy = 1.25;
            display.textContent = `+  25% Redundancy`;
            break;
        case '4':
            redundancy = 1.35;
            display.textContent = `+  35% Redundancy`;
            break;
        case '5':
            redundancy = 1.5;
            display.textContent = `+  50% Redundancy`;
            break;
        default:
            redundancy = 1;
            display.textContent = `+  0% Redundancy`;
            break;
    }
    calculateSum(prevBranch, prevNode);
}

/**
 * Handles all changes needed for the given checkbox, and recalculates the sum.
 * 
 * @param {*} checkbox The checkbox that was changed.
 */
function handleToggleChange(checkbox) {
    const toggle1 = document.getElementById('toggle1');
    const toggle2 = document.getElementById('toggle2');
    const toggle3 = document.getElementById('toggle3');
    const toggle4 = document.getElementById('toggle4');
    const toggle5 = document.getElementById('toggle5');
    const toggle6 = document.getElementById('toggle6');
    const toggle7 = document.getElementById('toggle7');
    const toggle8 = document.getElementById('toggle8');

    switch (checkbox) {
        case 'toggle1': //round trip
            if (toggle1.checked) {
                toggle4.checked = false;
                if (toggle2.disabled) {
                    toggle2.disabled = false;
                }
                if (toggle3.disabled) {
                    toggle3.disabled = false;
                }
                if (toggle7.disabled) {
                    toggle7.disabled = false;
                }
            } else {
                toggle5.disabled = false;
                toggle6.disabled = false;
                document.getElementById('departure_angle').value = '';
                transferAnlgeImageChange('emptyPhaseAngle', 'Depart');
                break;
            }
        case 'toggle2': //aerobrake low orbit arrival
            if (toggle2.checked) {
                toggle3.checked = false;
            }
            break;
        case 'toggle3': //aerobrake intercept arrival
            if (toggle3.checked) {
                toggle2.checked = false;
            }
            break;
        case 'toggle4': //return only
            if (toggle4.checked) {
                toggle1.checked = false;
                toggle2.checked = false;
                toggle2.disabled = true;
                toggle3.checked = false;
                toggle3.disabled = true;
                toggle5.disabled = false;
                toggle6.disabled = false;
                toggle7.checked = false;
                toggle7.disabled = true;
                transferAnlgeImageChange('emptyPhaseAngle', 'Arrive');
            } else {
                toggle2.disabled = false;
                toggle3.disabled = false;
                toggle7.disabled = false;
                document.getElementById('departure_angle').value = '';
                transferAnlgeImageChange('emptyPhaseAngle', 'Depart');
            }
            break;
        case 'toggle5': //aerobrake low orbit return
            if (toggle5.checked) {
                toggle6.checked = false;
            }
            break;
        case 'toggle6': //aerobrake intercept return
            if (toggle6.checked) {
                toggle5.checked = false;
            }
            break;
        case 'toggle8': // dropdown
            if (toggle8.checked) {
                let dropdownContent = document.getElementById('dv-dropdown');
                dropdownContent.style.display = (dropdownContent.style.display === 'block') ? 'none' : 'block';
            }
            break;
    }

    //update the dV
    calculateSum(prevBranch, prevNode);
}

/**
 * Finds the base value for the target planet.
 * Used to help calculate the dV.
 * e.g. interplanetary transfers require 4350 m/s to escape kerbin's SOI, on top of the branches normal values
 * 
 * @param {*} branchId Target planet, only used for edge cases.
 * @returns 
 */
function getBaseValue(branchId) {
    switch (branchId) {
        case 'Kerbin':
            return 0;
        case 'Mun':
            return 3400;
        case 'Minmus':
            return 3400;
        default:
            return 4350;
    }
}

/**
 * Changes the map image to highlight the path for the target planet/node position.
 * 
 * Each image is named after the branchId and nodeIndex, which allows them to be correctly selected.
 * 
 * @param {*} branchId Target planet.
 * @param {*} nodeIndex Position of the node in the branch.
 */
function changeImage(branchId, nodeIndex) {

    let branch = branchId.toLowerCase();

    //enables current image
    calculatorImage = document.getElementById(branch + nodeIndex);
    calculatorImage.style.opacity = 1;

    // if first change, sets previous image to calculator-image
    if (prevImg == null) {
        prevImg = document.getElementById('calculator-image');
    }

    // returns if same image is selected
    if (prevImg == calculatorImage) {
        return;
    }

    // clears previous image
    prevImg.style.opacity = 0;
    prevImg = calculatorImage;
}

/**
 * Calculates the dV for the trip. 
 * Calls the functions to calculate the phase angles, and handle aerobraking.
 * 
 * @param {*} branchId The target planet.
 * @param {*} nodeIndex Position of the node in the branch.
 * @returns 
 */
function calculateSum(branchId, nodeIndex) {
    const branch = document.getElementById(branchId);
    const nodes = branch.getElementsByClassName('node');

    if (toggle4.checked) {
        document.getElementById('dV_display').value = 'hmm';
    }

    let sum = getBaseValue(branchId);
    changeImage(branchId, nodeIndex);

    //saves the branch and node position for use in other functions
    prevBranch = branchId;
    prevNode = nodeIndex;

    // sums all the nodes in the branch, up-to the chosen node
    for (let i = 0; i <= nodeIndex; i++) {
        const node = nodes[i];
        const nodeValue = parseInt(node.dataset.value);
        sum += nodeValue;
    }

    //checkbox checks and aerobraking
    if (toggle1.checked) {
        sum *= 2; // Double the sum if Toggle 2 is checked
    }
    if (toggle7.checked) {
        sum -= 3400;
    }
    sum -= calculateAerobrake(branchId, nodeIndex);

    //redundancy
    sum *= redundancy;
    sum = Math.round(sum);

    sum = sum.toLocaleString();

    // Displays the sum and phase angles
    document.getElementById('dV_display').value = sum + ' m/s';
    populateDropdown();
    if (toggle1.checked) {
        phaseAngleArrive(branchId);
        phaseAngleDepart(branchId);
        firstCall = false;

        return;
    }
    if (toggle4.checked) {
        document.getElementById('arrival_angle').value = '';
        phaseAngleDepart(branchId);
        firstCall = false;

        return;
    }

    firstCall = false;

    phaseAngleArrive(branchId);
}