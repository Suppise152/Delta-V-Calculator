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
    updateAerobrakeDisplay();

    return aerobrake;
}

function updateAerobrakeDisplay() {
    if (firstCall) {
        document.getElementById('aeroArrive').style.opacity = 0.5;
        document.getElementById('aeroArriveLO').style.opacity = 0;
        document.getElementById('aeroReturn').style.opacity = 0.5;
        document.getElementById('aeroReturnLO').style.opacity = 0;
    }

    if (toggle2.checked) {
        document.getElementById('aeroArriveLO').style.opacity = 1;
    } else {
        document.getElementById('aeroArriveLO').style.opacity = 0;
    }
    if (toggle3.checked) {
        document.getElementById('aeroArrive').style.opacity = 1;
        document.getElementById('aeroArriveLO').style.opacity = 0;
    } else {
        document.getElementById('aeroArrive').style.opacity = 0.5;
    }
    if (toggle5.checked) {
        document.getElementById('aeroReturnLO').style.opacity = 1;
    } else {
        document.getElementById('aeroReturnLO').style.opacity = 0;
    }
    if (toggle6.checked) {
        document.getElementById('aeroReturn').style.opacity = 1;
        document.getElementById('aeroReturnLO').style.opacity = 0;
    } else {
        document.getElementById('aeroReturn').style.opacity = 0.5;
    }

}