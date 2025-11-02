// ANIMATED BACKGROUND - PARTICLES
// Only initialize particles on desktop for better mobile performance
const canvas = document.getElementById('particles');
let particles = [];
let animationId = null;

function initParticles() {
    // Check if mobile device or prefers reduced motion
    const isMobile = window.innerWidth <= 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (isMobile || prefersReducedMotion || !canvas) {
        return;
    }
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particleCount = 80;

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = Math.random() * 0.5 - 0.25;
            this.speedY = Math.random() * 0.5 - 0.25;
            this.opacity = Math.random() * 0.5 + 0.2;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            
            if (this.x > canvas.width) this.x = 0;
            if (this.x < 0) this.x = canvas.width;
            if (this.y > canvas.height) this.y = 0;
            if (this.y < 0) this.y = canvas.height;
        }
        
        draw() {
            ctx.fillStyle = `rgba(168, 85, 247, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    function connectParticles() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 120) {
                    ctx.strokeStyle = `rgba(168, 85, 247, ${0.2 * (1 - distance / 120)})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        connectParticles();
        animationId = requestAnimationFrame(animate);
    }

    animate();
}

// Initialize particles on load
initParticles();

// Handle resize (only on desktop)
window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        particles = [];
        return;
    }
    
    if (canvas && particles.length > 0) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
});

// TYPING CODE ANIMATION
const codeText = `class DrapeIDE {
  final AIEngine ai;
  final GitManager git;
  
  Future<void> develop() async {
    await ai.generateCode();
    await git.commit();
    print('🚀 App deployed!');
  }
}`;

let codeIndex = 0;
const typingElement = document.getElementById('typing-code');

function typeCode() {
    if (codeIndex < codeText.length) {
        typingElement.textContent += codeText.charAt(codeIndex);
        codeIndex++;
        setTimeout(typeCode, 50);
    }
}

setTimeout(typeCode, 1000);

// COUNTER ANIMATION
function animateCounter(element, target, duration = 2000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target.toFixed(1);
            clearInterval(timer);
        } else {
            element.textContent = current.toFixed(1);
        }
    }, 16);
}

const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px'
};

const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const stat = entry.target;
            const counter = stat.querySelector('.counter');
            const target = parseFloat(stat.dataset.target);
            animateCounter(counter, target);
            statsObserver.unobserve(stat);
        }
    });
}, observerOptions);

document.querySelectorAll('.stat').forEach(stat => {
    statsObserver.observe(stat);
});

// SCROLL REVEAL ANIMATIONS
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const delay = entry.target.dataset.delay || 0;
            setTimeout(() => {
                entry.target.classList.add('revealed');
            }, delay);
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => {
    revealObserver.observe(el);
});

// SMOOTH SCROLL
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// NAVBAR SCROLL EFFECT
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
        navbar.style.background = 'rgba(0, 0, 0, 0.95)';
        navbar.style.borderBottom = '1px solid rgba(168, 85, 247, 0.2)';
    } else {
        navbar.style.background = 'rgba(0, 0, 0, 0.8)';
        navbar.style.borderBottom = '1px solid rgba(168, 85, 247, 0.1)';
    }
    
    lastScroll = currentScroll;
});

// SCORE BARS ANIMATION
const scoreBars = document.querySelectorAll('.score-fill');

const scoreObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const bar = entry.target;
            const score = bar.style.getPropertyValue('--score');
            setTimeout(() => {
                bar.style.width = score;
            }, 300);
            scoreObserver.unobserve(bar);
        }
    });
}, { threshold: 0.5 });

scoreBars.forEach(bar => {
    bar.style.width = '0%';
    scoreObserver.observe(bar);
});

// GLITCH EFFECT ON HOVER
const glitchTitle = document.querySelector('.glitch');

glitchTitle.addEventListener('mouseenter', () => {
    glitchTitle.classList.add('glitch-active');
    setTimeout(() => {
        glitchTitle.classList.remove('glitch-active');
    }, 500);
});

// PRICING CARD HOVER EFFECT
const pricingCards = document.querySelectorAll('.pricing-card');

pricingCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
});

// ROADMAP PROGRESS ANIMATION
const roadmapItems = document.querySelectorAll('.roadmap-item');

const roadmapObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateX(0)';
            }, index * 100);
        }
    });
}, { threshold: 0.2 });

roadmapItems.forEach(item => {
    item.style.opacity = '0';
    item.style.transform = 'translateX(-50px)';
    item.style.transition = 'all 0.6s ease';
    roadmapObserver.observe(item);
});

// TABLE ROW HOVER EFFECT
const tableRows = document.querySelectorAll('tbody tr');

tableRows.forEach(row => {
    row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(168, 85, 247, 0.1)';
        row.style.transform = 'scale(1.02)';
    });
    
    row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent';
        row.style.transform = 'scale(1)';
    });
});

// PARALLAX EFFECT
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.hero-content');
    
    parallaxElements.forEach(el => {
        const speed = 0.5;
        el.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// FAQ ACCORDION
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    
    question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        
        // Close all other items
        faqItems.forEach(otherItem => {
            otherItem.classList.remove('active');
        });
        
        // Toggle current item
        if (!isActive) {
            item.classList.add('active');
        }
    });
});

// CONTACT FORM HANDLING
const contactForm = document.querySelector('.cta-form');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(contactForm);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            message: formData.get('message')
        };
        
        // Show loading state
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Invio in corso...';
        submitBtn.disabled = true;
        
        // Simulate form submission (replace with actual endpoint)
        setTimeout(() => {
            alert('Grazie per il tuo interesse! Ti contatteremo presto.');
            contactForm.reset();
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 1000);
        
        // For production, use:
        // try {
        //     const response = await fetch('/api/contact', {
        //         method: 'POST',
        //         headers: { 'Content-Type': 'application/json' },
        //         body: JSON.stringify(data)
        //     });
        //     if (response.ok) {
        //         alert('Messaggio inviato con successo!');
        //         contactForm.reset();
        //     }
        // } catch (error) {
        //     alert('Errore nell\'invio. Riprova più tardi.');
        // }
    });
}

// MOBILE MENU TOGGLE
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const navLinks = document.querySelector('.nav-links');

function closeMobileMenu() {
    if (mobileMenuToggle && navLinks) {
        mobileMenuToggle.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function openMobileMenu() {
    if (mobileMenuToggle && navLinks) {
        mobileMenuToggle.classList.add('active');
        navLinks.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// AUTO LANGUAGE DETECTION
function detectLanguage() {
    // Get browser language
    const browserLang = navigator.language || navigator.userLanguage;
    
    // Check if it's Italian, otherwise default to English
    if (browserLang.startsWith('it')) {
        return 'it';
    }
    return 'en';
}

function translatePage(lang) {
    // Translate all elements with data-translate attribute
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.dataset.translate;
        if (translations[lang] && translations[lang][key]) {
            if (element.tagName === 'INPUT') {
                element.placeholder = translations[lang][key];
            } else {
                element.textContent = translations[lang][key];
            }
        }
    });
}

// Auto-detect and translate on page load
const detectedLang = detectLanguage();
translatePage(detectedLang);

if (mobileMenuToggle && navLinks) {
    // Toggle menu on button click
    mobileMenuToggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const isActive = navLinks.classList.contains('active');
        
        if (isActive) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });
    
    // Close menu when clicking on a link
    const navLinksItems = document.querySelectorAll('.nav-links a');
    navLinksItems.forEach(function(link) {
        link.addEventListener('click', function() {
            closeMobileMenu();
        });
    });
    
    // Close menu when clicking backdrop (outside menu)
    navLinks.addEventListener('click', function(e) {
        if (e.target === navLinks) {
            closeMobileMenu();
        }
    });
    
    // Swipe to close functionality
    let touchStartX = 0;
    let touchEndX = 0;
    
    navLinks.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    navLinks.addEventListener('touchmove', function(e) {
        // Prevent scrolling when swiping on menu
        if (navLinks.classList.contains('active')) {
            const currentX = e.changedTouches[0].screenX;
            const diff = touchStartX - currentX;
            
            // Only prevent default if swiping horizontally more than vertically
            if (Math.abs(diff) > 10) {
                e.preventDefault();
            }
        }
    }, { passive: false });
    
    navLinks.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const swipeDistance = touchStartX - touchEndX;
        
        // Swipe right to close (swipe from left to right, positive distance)
        if (swipeDistance > swipeThreshold && navLinks.classList.contains('active')) {
            closeMobileMenu();
        }
    }
    
    // Close menu on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && navLinks.classList.contains('active')) {
            closeMobileMenu();
        }
    });
}

// COOKIE BANNER
const cookieBanner = document.getElementById('cookie-banner');
const acceptCookies = document.getElementById('accept-cookies');

if (cookieBanner && acceptCookies) {
    // Check if user already accepted
    if (!localStorage.getItem('cookiesAccepted')) {
        setTimeout(() => {
            cookieBanner.classList.add('show');
        }, 1000);
    }
    
    acceptCookies.addEventListener('click', () => {
        localStorage.setItem('cookiesAccepted', 'true');
        cookieBanner.classList.remove('show');
    });
}

// NEWSLETTER FORM
const newsletterForm = document.getElementById('newsletter-form');

if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = newsletterForm.querySelector('input[type="email"]').value;
        const button = newsletterForm.querySelector('button');
        const originalText = button.textContent;
        
        button.textContent = 'Iscrizione...';
        button.disabled = true;
        
        // Simulate submission (replace with actual API call)
        setTimeout(() => {
            alert('Grazie per esserti iscritto! Ti contatteremo presto.');
            newsletterForm.reset();
            button.textContent = originalText;
            button.disabled = false;
        }, 1000);
    });
}

// Initialization complete
