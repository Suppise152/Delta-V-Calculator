//test

// storage for vairables
let prevBranch;
let prevNode;
let prevImg;
let prevPhaseArrive;
let prevPhaseDepart;
let redundancy = 1;

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
 * Changes the transfer angle images, depending on the branch and direction
 * 
 * @param {*} branchId Target planet.
 * @param {*} direction Direction that the player will be traveling in.
 */
function transferAnlgeImageChange(branchId, direction) {

  if (branchId == 'emptyPhaseAngle') {
    let branch = String(branchId);
    phaseImg = document.getElementById(branch + direction);
    phaseImg.style.opacity = 1;
  } else {
    let branch = String(branchId).toLowerCase();
    phaseImg = document.getElementById(branch + direction);
    phaseImg.style.opacity = 1;
  }

  // //enables current image
  // phaseImg = document.getElementById(branch + direction);
  // phaseImg.style.opacity = 1;

  // if first change, sets previous image to emptyPhaseAngle
  if (prevPhaseArrive == null) {
    prevPhaseArrive = document.getElementById('emptyPhaseAngleArrive');
  }
  if (prevPhaseDepart == null) {
    prevPhaseDepart = document.getElementById('emptyPhaseAngleDepart');
  }

  // returns if same image is selected
  if (prevPhaseArrive == phaseImg || prevPhaseDepart == phaseImg) {
    return;
  }

  // clears previous image
  if (direction == 'Arrive') {
    prevPhaseArrive.style.opacity = 0;
    prevPhaseArrive = phaseImg;
  } else {
    prevPhaseDepart.style.opacity = 0;
    prevPhaseDepart = phaseImg;
  }
}

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
  const aeroArrive = document.getElementById('aeroArrive');
  const aeroReturn = document.getElementById('aeroReturn');
  const aeroArriveLO = document.getElementById('aeroArriveLO');
  const aeroReturnLO = document.getElementById('aeroReturnLO');
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
        break;
      }
    case 'toggle2': //aerobrake low orbit arrival
      if (toggle2.checked) {
        toggle3.checked = false;
        aeroArriveLO.style.opacity = 1;
        aeroArrive.style.opacity = 0;
      } else {
        aeroArriveLO.style.opacity = 0;
      }
      break;
    case 'toggle3': //aerobrake intercept arrival
      if (toggle3.checked) {
        toggle2.checked = false;
        aeroArrive.style.opacity = 1;
        aeroArriveLO.style.opacity = 0;
      } else {
        aeroArrive.style.opacity = 0;
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
        aeroArrive.style.opacity = 0;
        aeroArriveLO.style.opacity = 0;
        transferAnlgeImageChange('emptyPhaseAngle', 'Arrive');
      } else {
        toggle2.disabled = false;
        toggle3.disabled = false;
        toggle7.disabled = false;
        document.getElementById('departure_angle').value = '';
      }
      break;
    case 'toggle5': //aerobrake low orbit return
      if (toggle5.checked) {
        toggle6.checked = false;
        aeroReturnLO.style.opacity = 1;
        aeroReturn.style.opacity = 0;
      } else {
        aeroReturnLO.style.opacity = 0;
      }
      break;
    case 'toggle6': //aerobrake intercept return
      if (toggle6.checked) {
        toggle5.checked = false;
        aeroReturn.style.opacity = 1;
        aeroReturnLO.style.opacity = 0;
      } else {
        aeroReturn.style.opacity = 0;
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
    return;
  }
  if (toggle4.checked) {
    document.getElementById('arrival_angle').value = '';
    phaseAngleDepart(branchId);

    return;
  }

  phaseAngleArrive(branchId);
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
 *  Calculates all relavent aerobraking values
 * 
 * @param {*} branchId  The id of the branch
 * @param {*} nodeIndex Position of the node in the branch
 * @returns 
 */
function calculateAerobrake(branchId, nodeIndex) {
  const branch = document.getElementById(branchId);
  const nodes = branch.getElementsByClassName('node');
  let aerobrake = 0;
  if (toggle2.checked && nodeIndex === 2) { //low orbit arrive
    switch (branchId) {
      case 'Duna':
        aerobrake += 1450;
        break;
      case 'Laythe':
        aerobrake += 2900;
        break;
      case 'Eve':
        aerobrake += 8000;
        break;
      case 'Jool':
        aerobrake += 14000;
        break;
    }
  }
  if (toggle3.checked) { //intercept arrive
    switch (branchId) {
      case 'Duna':
        for (let i = 1; i <= nodeIndex; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        aerobrake += 250;
        break;
      case 'Laythe':
        for (let i = 1; i <= nodeIndex; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        aerobrake += 160;
        break;
      case 'Eve':
        for (let i = 1; i <= nodeIndex; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        aerobrake += 80;
        break;
      case 'Jool':
        for (let i = 1; i <= nodeIndex; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        aerobrake += 160;
        break;
      case 'Gilly':
        aerobrake += 80;
        break;
      case 'Ike':
        aerobrake += 250;
        break;
      case 'Vall':
        aerobrake += 160;
        break;
      case 'Tylo':
        aerobrake += 160;
        break;
      case 'Bop':
        aerobrake += 160;
        break;
      case 'Pol':
        aerobrake += 160;
        break;
    }
  }
  if (toggle5.checked && (toggle1.checked || toggle4.checked)) { //low orbit depart
    aerobrake += 3400;
  }
  if (toggle6.checked && (toggle1.checked || toggle4.checked)) { //intercept depart
    switch (branchId) {
      case 'Kerbin':
        for (let i = 0; i <= 0; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        break;
      case 'Mun':
        for (let i = 0; i <= 0; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        aerobrake += 3400;
        break;
      case 'Minmus':
        for (let i = 0; i <= 0; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        aerobrake += 3400;
        break;
      case 'Gilly':
        aerobrake += 1470;
        aerobrake += 3400;
        break;
      case 'Ike':
        aerobrake += 1090;
        aerobrake += 3400;
        break;
      case 'Laythe':
        aerobrake += 2200;
        aerobrake += 3400;
        break;
      case 'Vall':
        aerobrake += 2200;
        aerobrake += 3400;
        break;
      case 'Tylo':
        aerobrake += 2200;
        aerobrake += 3400;
        break;
      case 'Bop':
        aerobrake += 2200;
        aerobrake += 3400;
        break;
      case 'Pol':
        aerobrake += 2200;
        aerobrake += 3400;
        break;
      default:
        const node = nodes[0];
        const nodeValue = parseInt(node.dataset.value);
        aerobrake += nodeValue;
        aerobrake += (3400 + 950);
        break;
    }
  }
  return aerobrake;
}

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



/**
 * Fetches the transfer window angle to the target from kerbin
 * 
 * @param {*} branchId Target planet.
 */
function phaseAngleArrive(branchId) {
  switch (branchId) {
    case 'Kerbin':
      document.getElementById('arrival_angle').value = '';
      transferAnlgeImageChange('emptyPhaseAngle', 'Arrive');
      break;
    case 'Mun':
      document.getElementById('arrival_angle').value = '90' + '°';
      transferAnlgeImageChange('emptyPhaseAngle', 'Arrive');
      break;
    case 'Minmus':
      document.getElementById('arrival_angle').value = '90' + '°';
      transferAnlgeImageChange('emptyPhaseAngle', 'Arrive');
      break;
    case 'Moho':
      document.getElementById('arrival_angle').value = '108.2' + '°';
      transferAnlgeImageChange(branchId, 'Arrive');
      break;
    case 'Eve':
      document.getElementById('arrival_angle').value = '-54.1' + '°';
      transferAnlgeImageChange(branchId, 'Arrive');
      break;
    case 'Gilly':
      document.getElementById('arrival_angle').value = '-54.1' + '°';
      transferAnlgeImageChange('eve', 'Arrive');
      break;
    case 'Duna':
      document.getElementById('arrival_angle').value = '44.4' + '°';
      transferAnlgeImageChange(branchId, 'Arrive');
      break;
    case 'Ike':
      document.getElementById('arrival_angle').value = '44.4' + '°';
      transferAnlgeImageChange('duna', 'Arrive');
      break;
    case 'Dres':
      document.getElementById('arrival_angle').value = '82.1' + '°';
      transferAnlgeImageChange(branchId, 'Arrive');
      break;
    case 'Jool':
      document.getElementById('arrival_angle').value = '96.6' + '°';
      transferAnlgeImageChange(branchId, 'Arrive');
      break;
    case 'Laythe':
      document.getElementById('arrival_angle').value = '96.6' + '°';
      transferAnlgeImageChange('jool', 'Arrive');
      break;
    case 'Vall':
      document.getElementById('arrival_angle').value = '96.6' + '°';
      transferAnlgeImageChange('jool', 'Arrive');
      break;
    case 'Tylo':
      document.getElementById('arrival_angle').value = '96.6' + '°';
      transferAnlgeImageChange('jool', 'Arrive');
      break;
    case 'Bop':
      document.getElementById('arrival_angle').value = '96.6' + '°';
      transferAnlgeImageChange('jool', 'Arrive');
      break;
    case 'Pol':
      document.getElementById('arrival_angle').value = '96.6' + '°';
      transferAnlgeImageChange('jool', 'Arrive');
      break;
    case 'Eeloo':
      document.getElementById('arrival_angle').value = '101.4' + '°';
      transferAnlgeImageChange(branchId, 'Arrive');
      break;
    default:
      document.getElementById('arrival_angle').value = '';
      transferAnlgeImageChange('emptyPhaseAngle', 'Arrive');
      break;
  }
}

/**
 * Fetches the transfer window angle from the trget planet, back to kerbin.
 * 
 * @param {*} branchId Target planet.
 */
function phaseAngleDepart(branchId) {
  switch (branchId) {
    case 'Kerbin':
      document.getElementById('departure_angle').value = '';
      transferAnlgeImageChange('emptyPhaseAngle', 'Depart');
      break;
    case 'Mun':
      document.getElementById('departure_angle').value = '';
      transferAnlgeImageChange('emptyPhaseAngle', 'Depart');
      break;
    case 'Minmus':
      document.getElementById('departure_angle').value = '';
      transferAnlgeImageChange('emptyPhaseAngle', 'Depart');
      break;
    case 'Moho':
      document.getElementById('departure_angle').value = '-76.1' + '°';
      transferAnlgeImageChange(branchId, 'Depart');
      break;
    case 'Eve':
      document.getElementById('departure_angle').value = '-36.1' + '°';
      transferAnlgeImageChange(branchId, 'Depart');
      break;
    case 'Gilly':
      document.getElementById('departure_angle').value = '-36.1' + '°';
      transferAnlgeImageChange('eve', 'Depart');
      break;
    case 'Duna':
      document.getElementById('departure_angle').value = '75.2' + '°';
      transferAnlgeImageChange(branchId, 'Depart');
      break;
    case 'Ike':
      document.getElementById('departure_angle').value = '75.2' + '°';
      transferAnlgeImageChange('duna', 'Depart');
      break;
    case 'Dres':
      document.getElementById('departure_angle').value = '-30.3' + '°';
      transferAnlgeImageChange(branchId, 'Depart');
      break;
    case 'Jool':
      document.getElementById('departure_angle').value = '48.7' + '°';
      transferAnlgeImageChange(branchId, 'Depart');
      break;
    case 'Laythe':
      document.getElementById('departure_angle').value = '48.7' + '°';
      transferAnlgeImageChange('jool', 'Depart');
      break;
    case 'Vall':
      document.getElementById('departure_angle').value = '48.7' + '°';
      transferAnlgeImageChange('jool', 'Depart');
      break;
    case 'Tylo':
      document.getElementById('departure_angle').value = '48.7' + '°';
      transferAnlgeImageChange('jool', 'Depart');
      break;
    case 'Bop':
      document.getElementById('departure_angle').value = '48.7' + '°';
      transferAnlgeImageChange('jool', 'Depart');
      break;
    case 'Pol':
      document.getElementById('departure_angle').value = '48.7' + '°';
      transferAnlgeImageChange('jool', 'Depart');
      break;
    case 'Eeloo':
      document.getElementById('departure_angle').value = '-80.3' + '°';
      transferAnlgeImageChange(branchId, 'Depart');
      break;
    default:
      document.getElementById('departure_angle').value = '';
      transferAnlgeImageChange('emptyPhaseAngle', 'Depart');
      break;
  }
}
