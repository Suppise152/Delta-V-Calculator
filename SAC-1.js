// map image change
function changeImage(branchId, nodeIndex) {
  const imagePath = 'images/maps/' + branchId + nodeIndex + '.png';
  const calculatorImage = document.getElementById('calculator-image');
  calculatorImage.src = imagePath;
}

// phase angle image change
function transferAnlgeImageChange(branchId, direction){
  const imagePath = 'images/transferAngles/' + branchId + direction + '.png';
  const transferAngleImage = document.getElementById('transferAngle' + direction);
  transferAngleImage.src = imagePath;
}

let prevBranch;
let prevNode;

  // Handle toggle checkbox change
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

  switch (checkbox) {
    case 'toggle1':
      if (toggle1.checked) {
        toggle4.checked = false;
        if (toggle2.disabled) {
          toggle2.disabled = false;
        }
        if(toggle3.disabled){
          toggle3.disabled = false;
        }
      } else {
        toggle5.disabled = false;
        toggle6.disabled = false;
        document.getElementById('departure_angle').value = '';
        break;
      }
    case 'toggle2':
      if (toggle2.checked) {
        toggle3.checked = false;
        aeroArriveLO.style.opacity = 1;
        aeroArrive.style.opacity = 0;
      }else {
        aeroArriveLO.style.opacity = 0;
      }
        break;
    case 'toggle3':
      if (toggle3.checked) {
        toggle2.checked = false;
        aeroArrive.style.opacity = 1;
        aeroArriveLO.style.opacity = 0;
      }else {
        aeroArrive.style.opacity = 0;
      }
      break;
    case 'toggle4':
      if (toggle4.checked) {
        toggle1.checked = false;
        toggle2.checked = false;
        toggle2.disabled = true;
        toggle3.checked = false;
        toggle3.disabled = true;
        toggle5.disabled = false;
        toggle6.disabled = false;
        aeroArrive.style.opacity = 0;
        aeroArriveLO.style.opacity = 0;
      } else {
        toggle2.disabled = false;
        toggle3.disabled = false;
        document.getElementById('departure_angle').value = '';
      }
      break;
    case 'toggle5':
      if (toggle5.checked) {
        toggle6.checked = false;
        aeroReturnLO.style.opacity = 1;
        aeroReturn.style.opacity = 0;
      } else {
        aeroReturnLO.style.opacity = 0;
      }
      break;
    case 'toggle6':
      if (toggle6.checked) {
        toggle5.checked = false;
        aeroReturn.style.opacity = 1;
        aeroReturnLO.style.opacity = 0;
      } else {
        aeroReturn.style.opacity = 0;
      }
      break;
    default:
      break;
    }
  calculateSum(prevBranch, prevNode);
}

// calculates the sum of the nodes in the branch
function calculateSum(branchId, nodeIndex) {
  const branch = document.getElementById(branchId);
  const nodes = branch.getElementsByClassName('node');
  let sum = getBaseValue(branchId);
  changeImage(branchId, nodeIndex);

  prevBranch = branchId;
  prevNode = nodeIndex;

  // sums all the nodes in the branch
  for (let i = 0; i <= nodeIndex; i++) {
    const node = nodes[i];
    const nodeValue = parseInt(node.dataset.value);
    sum += nodeValue;
  }

  //checkbox checks
  if (toggle1.checked) {
    sum *= 2; // Double the sum if Toggle 2 is checked
  }
  sum -= calculateAerobrake(branchId, nodeIndex);
  if (toggle7.checked) {
    sum *= 1.1; // apply 10% redundancy
    sum = Math.round(sum);
  }

  sum = sum.toLocaleString();

  // Display the sum
  document.getElementById('dV_display').value = sum + ' m/s';
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

/* calcultes the base value for traveling to the target
* e.g. 3400 + 950 for all interplanetary transfers, in addition to their respective intercept values
*/
function getBaseValue(branchId) {
  switch (branchId) {
    case 'kerbin':
      return 0;
    case 'mun':
      return 3400;
    case 'minmus':
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
      case 'duna':
        aerobrake += 1450;
        break;
      case 'laythe':
        aerobrake += 2900;
        break;
      case 'eve':
        aerobrake += 8000;
        break;
    }
  }
  if (toggle3.checked){ //intercept arrive
    switch (branchId) {
      case 'duna':
        for (let i = 0; i <= nodeIndex; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        break;
      case 'laythe':
        for (let i = 0; i <= nodeIndex; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        break;
      case 'eve':
        for (let i = 0; i <= nodeIndex; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        break;
    }
  }
  if(toggle5.checked && (toggle1.checked || toggle4.checked)){ //low orbit depart
    aerobrake += 3400;
  }
  if(toggle6.checked && (toggle1.checked || toggle4.checked)){ //intercept depart
    switch (branchId) {
      case 'kerbin':
        for (let i = 0; i <= 0; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        break;
      case 'mun':
        for (let i = 0; i <= 0; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        aerobrake += 3400;
        break;
      case 'minmus':
        for (let i = 0; i <= 0; i++) {
          const node = nodes[i];
          const nodeValue = parseInt(node.dataset.value);
          aerobrake += nodeValue;
        }
        aerobrake += 3400;
        break;
      case 'gilly':
        aerobrake += 1470;
        aerobrake += 3400;
        break;
      case 'ike':
        aerobrake += 1090;
        aerobrake += 3400;
        break;
      case 'laythe':
        aerobrake += 2200;
        aerobrake += 3400;
        break;
      case 'vall':
        aerobrake += 2200;
        aerobrake += 3400;
        break;
      case 'tylo':
        aerobrake += 2200;
        aerobrake += 3400;
        break;
      case 'bop':
        aerobrake += 2200;
        aerobrake += 3400;
        break;
      case 'pol':
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

function phaseAngleArrive(branchId) {
  switch (branchId) {
    case 'kerbin':
      document.getElementById('arrival_angle').value;
      transferAnlgeImageChange('emptyPhaseAngle', 'Arrive');
      break;
    case 'mun':
      document.getElementById('arrival_angle').value = '90';
      transferAnlgeImageChange('emptyPhaseAngle', 'Arrive');
      break;
    case 'minmus':
      document.getElementById('arrival_angle').value = '90';
      transferAnlgeImageChange('emptyPhaseAngle', 'Arrive');
      break;
    case 'moho':
      document.getElementById('arrival_angle').value = '108.2';
      transferAnlgeImageChange(branchId, 'Arrive');
      break;
    case 'eve':
      document.getElementById('arrival_angle').value = '-54.1';
      transferAnlgeImageChange(branchId, 'Arrive');
      break;
    case 'gilly':
      document.getElementById('arrival_angle').value = '-54.1';
      transferAnlgeImageChange('eve', 'Arrive');
      break;
    case 'duna':
      document.getElementById('arrival_angle').value = '44.4';
      transferAnlgeImageChange(branchId, 'Arrive');
      break;
    case 'ike':
      document.getElementById('arrival_angle').value = '44.4';
      transferAnlgeImageChange('duna', 'Arrive');
      break;
    case 'dres':
      document.getElementById('arrival_angle').value = '82.1';
      transferAnlgeImageChange(branchId, 'Arrive');
      break;
    case 'jool':
      document.getElementById('arrival_angle').value = '96.6';
      transferAnlgeImageChange(branchId, 'Arrive');
      break;
    case 'laythe':
      document.getElementById('arrival_angle').value = '96.6';
      transferAnlgeImageChange('jool', 'Arrive');
      break;
    case 'vall':
      document.getElementById('arrival_angle').value = '96.6';
      transferAnlgeImageChange('jool', 'Arrive');
      break;
    case 'tylo':
      document.getElementById('arrival_angle').value = '96.6';
      transferAnlgeImageChange('jool', 'Arrive');
      break;
    case 'bop':
      document.getElementById('arrival_angle').value = '96.6';
      transferAnlgeImageChange('jool', 'Arrive');
      break;
    case 'pol':
      document.getElementById('arrival_angle').value = '96.6';
      transferAnlgeImageChange('jool', 'Arrive');
      break;
    case 'eeloo':
      document.getElementById('arrival_angle').value = '101.4';
      transferAnlgeImageChange(branchId, 'Arrive');
      break;
    default:
      document.getElementById('arrival_angle').value = '';
      transferAnlgeImageChange('emptyPhaseAngle', 'Arrive');
      break;
  }
}

function phaseAngleDepart(branchId) {
  switch (branchId) {
    case 'kerbin':
      document.getElementById('departure_angle').value;
      transferAnlgeImageChange('emptyPhaseAngle', 'Depart');
      break;
    case 'mun':
      document.getElementById('departure_angle').value = '';
      transferAnlgeImageChange('emptyPhaseAngle', 'Depart');
      break;
    case 'minmus':
      document.getElementById('departure_angle').value = '';
      transferAnlgeImageChange('emptyPhaseAngle', 'Depart');
      break;
    case 'moho':
      document.getElementById('departure_angle').value = '-76.1';
      transferAnlgeImageChange(branchId, 'Depart');
      break;
    case 'eve':
      document.getElementById('departure_angle').value = '-36.1';
      transferAnlgeImageChange(branchId, 'Depart');
      break;
    case 'gilly':
      document.getElementById('departure_angle').value = '-36.1';
      transferAnlgeImageChange('eve', 'Depart');
      break;
    case 'duna':
      document.getElementById('departure_angle').value = '75.2';
      transferAnlgeImageChange(branchId, 'Depart');
      break;
    case 'ike':
      document.getElementById('departure_angle').value = '75.2';
      transferAnlgeImageChange('duna', 'Depart');
      break;
    case 'dres':
      document.getElementById('departure_angle').value = '-30.3';
      transferAnlgeImageChange(branchId, 'Depart');
      break;
    case 'jool':
      document.getElementById('departure_angle').value = '48.7';
      transferAnlgeImageChange(branchId, 'Depart');
      break;
    case 'laythe':
      document.getElementById('departure_angle').value = '48.7';
      transferAnlgeImageChange('jool', 'Depart');
      break;
    case 'vall':
      document.getElementById('departure_angle').value = '48.7';
      transferAnlgeImageChange('jool', 'Depart');
      break;
    case 'tylo':
      document.getElementById('departure_angle').value = '48.7';
      transferAnlgeImageChange('jool', 'Depart');
      break;
    case 'bop':
      document.getElementById('departure_angle').value = '48.7';
      transferAnlgeImageChange('jool', 'Depart');
      break;
    case 'pol':
      document.getElementById('departure_angle').value = '48.7';
      transferAnlgeImageChange('jool', 'Depart');
      break;
    case 'eeloo':
      document.getElementById('departure_angle').value = '-80.3';
      transferAnlgeImageChange(branchId, 'Depart');
      break;
    default:
      document.getElementById('departure_angle').value = '';
      transferAnlgeImageChange('emptyPhaseAngle', 'Depart');
      break;
  }
}
