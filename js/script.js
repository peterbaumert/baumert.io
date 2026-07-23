function currentTime() {
    var date = new Date(); /* creating object of Date class */
    document.getElementById("time").innerText = date.toLocaleTimeString(); /* adding time to the div */
    document.getElementById("date").innerText = date.toLocaleDateString(); /* adding date to the div */
    var t = setTimeout(function () { currentTime() }, 1000); /* setting timer */
}

currentTime(); /* calling currentTime() function to initiate the process */


$(document).ready(function () {

    $('#footer a').click((e) => {
        $('#footer a').removeClass('active');
        $(e.target).addClass('active');
    });
    if (window.location.hash != "") {
        $('#footer a').removeClass('active');
        $('#footer a[href="'+window.location.hash+'"]').addClass('active');
    }

});
