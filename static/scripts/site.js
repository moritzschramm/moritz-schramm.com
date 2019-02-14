document.addEventListener('DOMContentLoaded', function () {

	function toggleNavbar() {
		var button = document.getElementById('navButton');
		var target = document.getElementById(button.dataset.target);
		
		button.classList.toggle('is-active');
		target.classList.toggle('is-active');
	}

	document.getElementById('navButton').addEventListener('click', toggleNavbar);

	var navItems = Array.prototype.slice.call(document.querySelectorAll('.item-scroll'), 0);

	if(navItems.length > 0) {

		navItems.forEach(function(elem) {
			elem.addEventListener('click', toggleNavbar);
		});
	}
});