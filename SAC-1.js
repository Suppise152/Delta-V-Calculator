function changeImage(imagePath) {
    const calculatorImage = document.getElementById('calculator-image');
    calculatorImage.src = imagePath;
  }

// Toggle the selected state of a node within a branch
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

  display.value = sum; // Update the display with the calculated sum
}
