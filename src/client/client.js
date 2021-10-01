/*
 * Updates file label after upload
 */
function selectFile(input, labelText) {
    document.getElementById(labelText).innerHTML = input.files[0].name;
}