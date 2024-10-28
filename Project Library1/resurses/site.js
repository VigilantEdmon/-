let scale = 1;

document.addEventListener('wheel', function(event) {
    if (event.ctrlKey) {
        event.preventDefault();
        if (event.deltaY < 0) {
            scale += 0.1;
        } else {
            scale -= 0.1;
        }
        applyScale();
    }
}, { passive: false });

function applyScale() {
    document.body.style.transform = `scale(${scale})`;
    centerContent();
}

function centerContent() {
    const container = document.querySelector('.container');
    const containerRect = container.getBoundingClientRect();
    const bodyRect = document.body.getBoundingClientRect();

    const offsetX = (bodyRect.width - containerRect.width * scale) / 2;
    const offsetY = (bodyRect.height - containerRect.height * scale) / 2;

    container.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
}
window.onload = centerContent