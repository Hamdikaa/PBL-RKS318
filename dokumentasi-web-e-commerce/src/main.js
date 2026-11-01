import './style.css';
import { gsap } from 'gsap';

// Animasi Awal Masuk Web ala Game F1
window.addEventListener('DOMContentLoaded', () => {
    gsap.from("aside", { x: -100, opacity: 0, duration: 0.8, ease: "power4.out" });
    gsap.from("header h1", { y: 50, opacity: 0, duration: 1, delay: 0.2, ease: "power4.out" });
    gsap.from(".f1-card", { y: 60, opacity: 0, duration: 0.8, stagger: 0.1, delay: 0.4, ease: "back.out(1.7)" });
});

const lightbox = document.getElementById('lightbox');
const lightboxContent = document.getElementById('lightbox-content');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxTitle = document.getElementById('lightbox-title');
const lightboxDesc = document.getElementById('lightbox-desc');
const closeBtn = document.getElementById('close-btn');
const backActionBtn = document.getElementById('back-action-btn');

// Logika Klik Gambar Membesar dengan Animasi Smooth Overlay
document.querySelectorAll('.f1-card').forEach(card => {
    card.addEventListener('click', () => {
        const title = card.getAttribute('data-title');
        const desc = card.getAttribute('data-desc');
        const img = card.getAttribute('data-img');

        lightboxImg.src = img;
        lightboxTitle.innerText = title;
        lightboxDesc.innerText = desc;

        lightbox.classList.remove('hidden');
        lightbox.classList.add('flex');
        
        // GSAP Motion untuk pembesaran pop-up
        gsap.to(lightbox, { opacity: 1, duration: 0.3 });
        gsap.fromTo(lightboxContent, { scale: 0.9, y: 30 }, { scale: 1, y: 0, duration: 0.4, ease: "power3.out" });
        
        document.body.style.overflow = 'hidden'; // Kunci layar utama
    });
});

// Fungsi Menutup Pop-up (Back/Close)
function closeTelemetry() {
    gsap.to(lightboxContent, { scale: 0.9, y: 30, duration: 0.3, ease: "power3.in" });
    gsap.to(lightbox, { opacity: 0, duration: 0.3, onComplete: () => {
        lightbox.classList.remove('flex');
        lightbox.classList.add('hidden');
        document.body.style.overflow = 'auto'; // Aktifkan scroll utama
    }});
}

closeBtn.addEventListener('click', closeTelemetry);
backActionBtn.addEventListener('click', closeTelemetry);
lightbox.addEventListener('click', (e) => {
    if(e.target === lightbox) closeTelemetry();
});
