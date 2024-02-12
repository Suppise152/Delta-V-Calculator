let prevPhaseArrive;
let prevPhaseDepart;

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