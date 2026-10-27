// Nicolás Kent — Sitio de autor
// Navegación móvil + validación del formulario de contacto

document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initContactForm();
  initLightbox();
});

function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function initContactForm() {
  const form = document.querySelector(".contact-form");
  if (!form) return;

  const successBox = document.querySelector(".form-success");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    let valid = true;

    const fields = [
      { name: "name", message: "Por favor ingresa tu nombre." },
      { name: "email", message: "Ingresa un correo electrónico válido.", isEmail: true },
      { name: "message", message: "Escribe tu mensaje." },
    ];

    fields.forEach(({ name, message, isEmail }) => {
      const field = form.querySelector(`[name="${name}"]`);
      const wrapper = field.closest(".form-field");
      const errorEl = wrapper.querySelector(".error-msg");
      const value = field.value.trim();

      let fieldValid = value.length > 0;
      if (fieldValid && isEmail) {
        fieldValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      }

      wrapper.classList.toggle("error", !fieldValid);
      errorEl.textContent = fieldValid ? "" : message;

      if (!fieldValid) valid = false;
    });

    if (!valid) return;

    if (successBox) {
      successBox.textContent = "Gracias por tu mensaje. Te responderé lo antes posible.";
      successBox.classList.add("visible");
    }
    form.reset();
  });
}

function initLightbox() {
  const galleries = document.querySelectorAll(".news-gallery");
  if (!galleries.length) return;

  const lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-label", "Visor de imágenes");
  lightbox.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Cerrar">&times;</button>
    <button type="button" class="lightbox-prev" aria-label="Imagen anterior">&lsaquo;</button>
    <figure class="lightbox-figure">
      <img class="lightbox-img" src="" alt="" />
    </figure>
    <button type="button" class="lightbox-next" aria-label="Imagen siguiente">&rsaquo;</button>
    <p class="lightbox-counter" aria-live="polite"></p>
  `;
  document.body.appendChild(lightbox);

  const img = lightbox.querySelector(".lightbox-img");
  const counter = lightbox.querySelector(".lightbox-counter");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  const prevBtn = lightbox.querySelector(".lightbox-prev");
  const nextBtn = lightbox.querySelector(".lightbox-next");
  const focusable = [closeBtn, prevBtn, nextBtn];

  let currentImages = [];
  let currentIndex = 0;
  let triggerEl = null;

  function show(index) {
    currentIndex = (index + currentImages.length) % currentImages.length;
    const target = currentImages[currentIndex];
    img.src = target.src;
    img.alt = target.alt;
    counter.textContent = `${currentIndex + 1} / ${currentImages.length}`;
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      close();
    } else if (event.key === "ArrowRight") {
      show(currentIndex + 1);
    } else if (event.key === "ArrowLeft") {
      show(currentIndex - 1);
    } else if (event.key === "Tab") {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function open(images, index, trigger) {
    currentImages = images;
    triggerEl = trigger;
    show(index);
    lightbox.classList.add("is-open");
    document.body.classList.add("lightbox-open");
    document.addEventListener("keydown", onKeydown);
    closeBtn.focus();
  }

  function close() {
    lightbox.classList.remove("is-open");
    document.body.classList.remove("lightbox-open");
    document.removeEventListener("keydown", onKeydown);
    if (triggerEl) triggerEl.focus();
  }

  // Permite que otros efectos (p. ej. DriftWall) abran el visor
  window.openLightbox = open;

  galleries.forEach((gallery) => {
    if (gallery.hasAttribute("data-drift-wall")) return;
    const images = Array.from(gallery.querySelectorAll("img"));
    images.forEach((thumb, index) => {
      thumb.setAttribute("tabindex", "0");
      thumb.addEventListener("click", () => open(images, index, thumb));
      thumb.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(images, index, thumb);
        }
      });
    });
  });

  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", () => show(currentIndex - 1));
  nextBtn.addEventListener("click", () => show(currentIndex + 1));
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) close();
  });
}
