/*
This script enables image comparison functionality by providing an interactive
way to compare two images side by side. 


You don't need to call this function. Just set the "enableImageComparisonSliders"
property to true in the config.js file. Then main.js will call this function.


Users can click and drag a splitter to reveal more or less of each image.
*/

/**
 * Initializes image comparison sliders found within the document. Each image comparison slider allows
 * users to interactively compare two images by clicking and dragging a central splitter. This function
 * identifies all elements with a specific class designating them as image comparison splitters and sets
 * up the necessary event listeners to handle user interactions, such as dragging the splitter.
 *
 * 
 * The initialization process includes setting up mouse and touch event listeners to handle the dragging
 * action, adjusting the position of the splitter based on user input, and updating the visible portion
 * of the images based on the splitter's position. It also ensures that the splitter's position is correctly
 * reset when the browser window is resized.
 */
export function initImageComparisons() {

    function initializeSplitter(mover) {
        var parent = mover.parentElement;
        var imgLeft = mover.nextElementSibling;

        function setMoverPosition(X, Y) {
            var parentRect = parent.getBoundingClientRect();

            if (Y < parentRect.top || Y > parentRect.bottom) {
                return;
            }

            var topBoundary = parentRect.top + (parentRect.height * 0.34);
            var bottomBoundary = parentRect.bottom - (parentRect.height * 0.34);

            if (Y <= topBoundary) {
                mover.classList.remove("bottom");
                mover.classList.add("top");
            }
            else if (Y > topBoundary && Y < bottomBoundary) {
                mover.classList.remove("top");
                mover.classList.remove("bottom");
            }
            else if (Y >= bottomBoundary) {
                mover.classList.remove("top");
                mover.classList.add("bottom");
            }

            var newX = X - parentRect.left - mover.getBoundingClientRect().width / 2;

            newX = Math.max(- mover.getBoundingClientRect().width / 2, Math.min(parentRect.width - mover.getBoundingClientRect().width / 2, newX));

            mover.style.left = newX + "px";
            imgLeft.style.clip = "rect(0px, " + (newX + mover.getBoundingClientRect().width / 2) + "px, 999px, 0px)";
        }

        setMoverPosition(parent.getBoundingClientRect().left + parent.getBoundingClientRect().width / 2);

        var mouseDownX = 0;
        var X, Y;

        parent.addEventListener("mousedown", function (e) {
            mouseDownX = 1;
            X = e.clientX;
            Y = e.clientY;
            mover.classList.add("stop-animation");
            parent.classList.add("active");
            setMoverPosition(X, Y);
        }, { passive: true });

        document.addEventListener("mouseup", function () {
            mouseDownX = 0;
            elsH.forEach(el => el.parentNode.classList.remove("active"));
        }, { passive: true });

        document.addEventListener("touchend", function () {
            mouseDownX = 0;
            elsH.forEach(el => el.parentNode.classList.remove("active"));
        }, { passive: true });

        document.addEventListener("mousemove", function (e) {
            if (mouseDownX) {
                X = e.clientX;
                Y = e.clientY;
                parent.classList.add("active");
                setMoverPosition(X, Y);
            }
        }, { passive: true });

        parent.addEventListener("touchstart", function (e) {
            e.preventDefault();
            mouseDownX = 1;
            X = e.touches[0].clientX;
            Y = e.touches[0].clientY;
            mover.classList.add("stop-animation");
            parent.classList.add("active");
            setMoverPosition(X, Y);
        }, { passive: true });

        mover.addEventListener("touchstart", function (e) {
            e.preventDefault();
            mouseDownX = 1;
            X = e.touches[0].clientX;
            Y = e.touches[0].clientY;
            mover.classList.add("stop-animation");
            parent.classList.add("active");
            setMoverPosition(X, Y);
        }, { passive: true });

        document.addEventListener("touchmove", function (e) {
            if (mouseDownX) {
                e.preventDefault();
                X = e.touches[0].clientX;
                Y = e.touches[0].clientY;
                parent.classList.add("active");
                setMoverPosition(X, Y);
            }
        }, { passive: true });
    }

    var elsH = document.querySelectorAll(".image-spliter .mover");
    elsH.forEach(initializeSplitter);

    window.addEventListener("resize", function () {
        var elsHre = document.querySelectorAll(".image-spliter .mover");
        var ii = elsHre.length;
        while (ii--) {
            var mover = elsHre[ii];
            var parentWidth = mover.parentElement.getBoundingClientRect().width;
            var moverWidth = mover.getBoundingClientRect().width;
            var imgLeft = mover.nextElementSibling;

            mover.style.left = (parentWidth / 2) - (moverWidth / 2) + 'px';
            imgLeft.style.clip = "rect(0px, " + (parentWidth / 2) + "px, 999px, 0px)";
        }
    }, { passive: true });
}