function changeImage(imageFileName) {
  const imagePath = 'images/' + imageFileName;
  const calculatorImage = document.getElementById('calculator-image');
  calculatorImage.src = imagePath;
}

  // Handle toggle checkbox change
function handleToggleChange(checkbox) {
  const toggle1 = document.getElementById('toggle1');
  const toggle2 = document.getElementById('toggle2');
  const toggle3 = document.getElementById('toggle3');
  const toggle4 = document.getElementById('toggle4');
  const toggle5 = document.getElementById('toggle5');
  const toggle6 = document.getElementById('toggle6');

  switch (checkbox.id) {
    case 'toggle1':
      if (checkbox.checked) {
        toggle4.checked = false;
        toggle2.disabled = false;
        toggle3.disabled = false;
      } else {
        toggle5.disabled = false;
        toggle6.disabled = false;
        break;
      }
    case 'toggle2':
      if (checkbox.checked) {
        toggle3.checked = false;
      }
        break;
    case 'toggle3':
      if (checkbox.checked) {
        toggle2.checked = false;
      }
      break;
    case 'toggle4':
      if (checkbox.checked) {
        toggle1.checked = false;
        toggle2.checked = false;
        toggle2.disabled = true;
        toggle3.checked = false;
        toggle3.disabled = true;
        toggle5.disabled = false;
        toggle6.disabled = false;
      } else {
        toggle2.disabled = false;
        toggle3.disabled = false;
      }
      break;
    case 'toggle5':
      if (checkbox.checked) {
        toggle6.checked = false;
      }
      break;
    case 'toggle6':
      if (checkbox.checked) {
        toggle5.checked = false;
      }
      break;
    default:
      break;
    }
}

// calculates the sum of the nodes in the branch
function calculateSum(branchId, nodeIndex) {
  const branch = document.getElementById(branchId);
  const nodes = branch.getElementsByClassName('node');
  let sum = 10;

  // sums all the nodes in the branch
  for (let i = 0; i <= nodeIndex; i++) {
    if (toggle1.checked && i === nodes.length - 1) {
      break;
    }
    const node = nodes[i];
    const nodeValue = parseInt(node.dataset.value);
    sum += nodeValue;
  }

  if (toggle2.checked) {
    sum *= 2; // Double the sum if Toggle 2 is checked
    if (toggle1.checked) {
      sum -= 10; // Subtract base value if Toggle 2 is checked
    }
  }

  dV_display.value = sum; // Update the display with the calculated sum
  phaseAngleArrive(branchId);
  phaseAngleDepart(branchId);
   
}

function phaseAngleArrive(branchId) {
  switch (branchId) {
    case 'branchA':
      document.getElementById('arrival_angle').value = 15;
      break;
    case 'branchB':
      document.getElementById('arrival_angle').value = 30;
      break;
    default:
      document.getElementById('arrival_angle') = 'N/A';
      break;
  }
}

function phaseAngleDepart(branchId) {
  switch (branchId) {
    case 'branchA':
      document.getElementById('departure_angle').value = 10;
      break;
    case 'branchB':
      document.getElementById('departure_angle').value = 45;
      break;
    default:
      document.getElementById('departure_angle') = 'N/A';
      break;
  }
}
