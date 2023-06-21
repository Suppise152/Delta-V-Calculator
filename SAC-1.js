function changeImage(imagePath) {
    const calculatorImage = document.getElementById('calculator-image');
    calculatorImage.src = imagePath;
  }
  
  // Calculate the sum based on branch and node selection
function calculateSum() {
  const display = document.getElementById('display');
  const toggle1 = document.getElementById('toggle1');
  const toggle2 = document.getElementById('toggle2');

  const branches = document.getElementsByClassName('branch');

  let sum = 0;

  // Calculate sum for each branch
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    const activeNodes = branch.getElementsByClassName('active');

    // Calculate sum for active nodes in the branch
    for (let j = 0; j < activeNodes.length; j++) {
      const node = activeNodes[j];
      const nodeValue = parseInt(node.dataset.value);
      sum += nodeValue;
    }
  }

  if (toggle2.checked) {
    sum *= 2; // Double the sum if Toggle 2 is checked
  }

  display.value = sum; // Update the display with the calculated sum
}

// Toggle the selected state of a node within a branch
function toggleNode(branchId, nodeIndex) {

  const branch = document.getElementById(branchId);
  const nodes = branch.getElementsByClassName('node');

  for (let i = 0; i < nodes.length; i++) {
    if (i <= nodeIndex) {
      nodes[i].classList.add('active'); // Add the "active" class to selected node
    } else {
      nodes[i].classList.remove('active'); // Remove the "active" class from remaining nodes
    }
    if (toggle1.checked && i == nodes.length - 1) {
      nodes[i].classList.remove('active'); // Remove the "active" class from the last node if Toggle 1 is checked
    }
  }

  calculateSum(); // Recalculate the sum based on the updated node selection
}

  