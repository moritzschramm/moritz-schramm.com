var isOpen = false;
var mouseInDropdown = false;

$(document).ready(function() {


  $("#creation-dropdown button").on("click", function() {


    if(isOpen) {

      closeDropdown();

    } else {

      openDropdown();
    }
  });

  $("#creation-dropdown button").on("blur", function() {

    if(!mouseInDropdown)
      closeDropdown();
  });

  $("#creation-dropdown-modal").on("click", function() {
      $("#creation-dropdown button").focus();
  });

  $("#creation-dropdown-modal").hover(function() {

    mouseInDropdown = true;
  },
  function() {

    mouseInDropdown = false;
  });

});

function openDropdown() {

  $("#creation-dropdown-modal").removeClass("dropdown-hidden");
  isOpen = true;
}
function closeDropdown() {

  $("#creation-dropdown-modal").addClass("dropdown-hidden");
  isOpen = false;
}
