let lenis;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Lenis Smooth Scroll Setup
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
        infinite: false,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Sync GSAP with Lenis
    gsap.registerPlugin(ScrollTrigger);

    // Header scroll handling
    lenis.on('scroll', handleHeaderTheme);
    window.addEventListener('scroll', handleHeaderTheme);
    handleHeaderTheme();

    // Initial loader
    const tlLoader = gsap.timeline({
        onComplete: () => {
            const loader = document.querySelector('.page-loader');
            if (loader) loader.style.display = 'none';
            initPageSpecific();
        }
    });

    const progressObj = { value: 0 };
    tlLoader.to(progressObj, {
        value: 100,
        duration: 1.2,
        ease: "power2.inOut",
        onUpdate: () => {
            const pct = document.querySelector('.loader-percentage');
            const fill = document.querySelector('.loader-progress-fill');
            if (pct) pct.innerText = Math.round(progressObj.value).toString().padStart(3, '0');
            if (fill) fill.style.width = `${progressObj.value}%`;
        }
    })
    .to('.page-loader', {
        yPercent: -100,
        duration: 0.8,
        ease: "power3.inOut"
    });

    // Navigation and Modals (Global)
    initGlobalUI();

    // SPA Router
    initRouter();
});

function initGlobalUI() {
    const menuTrigger = document.querySelector('.menu-trigger');
    const navClose = document.querySelector('.nav-close');
    const navMenu = document.querySelector('.nav-menu');
    
    function openMenu() {
        if(navMenu) {
            navMenu.classList.add('is-active');
            navMenu.setAttribute('aria-hidden', 'false');
            lenis.stop();
        }
    }
    
    function closeMenu() {
        if(navMenu) {
            navMenu.classList.remove('is-active');
            navMenu.setAttribute('aria-hidden', 'true');
            lenis.start();
        }
    }

    if (menuTrigger) menuTrigger.addEventListener('click', openMenu);
    if (navClose) navClose.addEventListener('click', closeMenu);
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    // Modals
    const modalTriggers = document.querySelectorAll('.cta-contact-trigger');
    const modalClose = document.querySelector('.modal-close');
    const requestModal = document.querySelector('.request-modal');
    const modalBackdrop = document.querySelector('.modal-backdrop');

    function openModal(e) {
        if(e) e.preventDefault();
        if(requestModal) {
            requestModal.classList.add('is-active');
            requestModal.setAttribute('aria-hidden', 'false');
            lenis.stop();
        }
    }

    function closeModal() {
        if(requestModal) {
            requestModal.classList.remove('is-active');
            requestModal.setAttribute('aria-hidden', 'true');
            lenis.start();
        }
    }

    modalTriggers.forEach(btn => btn.addEventListener('click', openModal));
    if(modalClose) modalClose.addEventListener('click', closeModal);
    if(modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (requestModal && requestModal.classList.contains('is-active')) closeModal();
            if (navMenu && navMenu.classList.contains('is-active')) closeMenu();
        }
    });

    const yearEl = document.getElementById('current-year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
}

function isFileProtocol() {
    return window.location.protocol === 'file:';
}

function normalizeRoutePath(pathname) {
    if (!pathname) return '/';
    let path = pathname.split('?')[0].split('#')[0];
    if (path.endsWith('/index.html')) path = path.slice(0, -10) || '/';
    else if (path.endsWith('index.html')) path = path.slice(0, -10) || '/';
    if (typeof views !== 'undefined') {
        if (views[path]) return path;
        if (!path.endsWith('/') && views[path + '/']) return path + '/';
        if (path.endsWith('/') && path !== '/' && views[path.slice(0, -1)]) return path.slice(0, -1);
    }
    return path || '/';
}

function getCurrentPath() {
    if (isFileProtocol()) {
        const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
        const path = hash.startsWith('/') ? hash : (hash ? '/' + hash : '/');
        return normalizeRoutePath(path);
    }
    return normalizeRoutePath(window.location.pathname);
}

function getLinkPath(link) {
    const href = link.getAttribute('href');
    if (!href || href === '#') return null;

    if (href.startsWith('#')) {
        const hash = href.slice(1);
        if (hash.startsWith('/') && typeof views !== 'undefined' && views[normalizeRoutePath(hash)]) {
            return normalizeRoutePath(hash);
        }
        return null;
    }

    try {
        const url = new URL(href, 'https://mexipay.local');
        return normalizeRoutePath(url.pathname);
    } catch (err) {
        return null;
    }
}

function updateActiveNav(path) {
    document.querySelectorAll('.desktop-nav a, .nav-menu-content a').forEach(link => {
        const linkPath = getLinkPath(link);
        if (linkPath && (path === linkPath || (path === '/' && linkPath === '/'))) {
            link.style.color = 'var(--mx-primary)';
            link.classList.add('is-active-route');
        } else {
            link.style.color = '';
            link.classList.remove('is-active-route');
        }
    });
}

let currentPageCleanup = null;

function handleHeaderTheme() {
    const header = document.querySelector('.header');
    if (!header) return;
    const currentPath = getCurrentPath();
    const isHome = (currentPath === '/');
    const isProcessing = (currentPath === '/procesamiento/' || currentPath === '/procesamiento');
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const isScrolled = scrollY > 40;

    if ((isHome || isProcessing) && !isScrolled) {
        header.classList.add('is-home-top');
    } else {
        header.classList.remove('is-home-top');
    }

    if (isScrolled) {
        header.classList.add('is-scrolled');
    } else {
        header.classList.remove('is-scrolled');
    }
}

function updateHeaderTheme(path) {
    handleHeaderTheme();
}

function initRouter() {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) return;

    const renderView = (path) => {
        const resolved = normalizeRoutePath(path);
        const viewHtml = typeof views !== 'undefined' ? (views[resolved] || views['/']) : '';
        
        if (currentPageCleanup) {
            currentPageCleanup();
            currentPageCleanup = null;
        }

        // Transition out
        appRoot.style.transition = 'opacity 250ms, transform 250ms';
        appRoot.style.opacity = 0;
        appRoot.style.transform = 'translateY(8px)';
        
        setTimeout(() => {
            // Kill old scroll triggers before replacing DOM
            ScrollTrigger.getAll().forEach(t => t.kill());

            appRoot.innerHTML = viewHtml;
            updateHeaderTheme(resolved);
            window.scrollTo(0, 0);
            
            // Re-init page logic immediately so DOM updates are in place
            initPageSpecific();

            // Transition in
            requestAnimationFrame(() => {
                appRoot.style.opacity = 1;
                appRoot.style.transform = 'translateY(0)';
            });
            
            updateActiveNav(resolved);
        }, 250);
    };

    const navigateTo = (path) => {
        const resolved = normalizeRoutePath(path);
        if (resolved === getCurrentPath()) return;

        if (isFileProtocol()) {
            window.location.hash = resolved;
            return;
        }

        history.pushState(null, '', resolved);
        renderView(resolved);
    };

    window.addEventListener('popstate', () => {
        renderView(getCurrentPath());
    });

    window.addEventListener('hashchange', () => {
        if (isFileProtocol()) renderView(getCurrentPath());
    });

    document.body.addEventListener('click', e => {
        const link = e.target.closest('a');
        if (link && link.getAttribute('data-link') !== null) {
            const path = getLinkPath(link);
            if (!path) return;

            e.preventDefault();
            navigateTo(path);

            const navMenu = document.querySelector('.nav-menu');
            if (navMenu && navMenu.classList.contains('is-active')) {
                navMenu.classList.remove('is-active');
                navMenu.setAttribute('aria-hidden', 'true');
                lenis.start();
            }
        }
    });

    const currentPath = getCurrentPath();
    appRoot.innerHTML = typeof views !== 'undefined' ? (views[currentPath] || views['/']) : appRoot.innerHTML;
    updateHeaderTheme(currentPath);
    updateActiveNav(currentPath);
}

function initPageSpecific() {
    // Processing Hero Reveal & WebGL Fluid Simulation
    const processingHero = document.querySelector('.processing-hero');
    if (processingHero) {
        const h1El = document.getElementById('processing-h1');
        if (h1El && !h1El.querySelector('.word-span')) {
            const text = h1El.textContent.trim();
            const words = text.split(/\s+/);
            h1El.innerHTML = words.map(w => `<span class="word-span">${w}</span>`).join(' ');
        }

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            gsap.set('.processing-title .word-span, .processing-copy-primary, .processing-copy-secondary, .processing-actions', {
                opacity: 1, y: 0
            });
        } else {
            gsap.to('.processing-title .word-span', {
                opacity: 1,
                y: 0,
                duration: 0.72,
                delay: 0.48,
                stagger: 0.085,
                ease: "cubic-bezier(0.215, 0.61, 0.355, 1)"
            });
            gsap.to('.processing-copy-primary', {
                opacity: 1,
                y: 0,
                duration: 0.6,
                delay: 1.1,
                ease: "cubic-bezier(0.215, 0.61, 0.355, 1)"
            });
            gsap.to('.processing-copy-secondary', {
                opacity: 1,
                y: 0,
                duration: 0.6,
                delay: 1.25,
                ease: "cubic-bezier(0.215, 0.61, 0.355, 1)"
            });
            gsap.to('.processing-actions', {
                opacity: 1,
                y: 0,
                duration: 0.7,
                delay: 1.45,
                ease: "cubic-bezier(0.215, 0.61, 0.355, 1)"
            });
        }

        if (currentPageCleanup) {
            currentPageCleanup();
            currentPageCleanup = null;
        }
        currentPageCleanup = initProcessingFluidHero();
    }

    const aggregatorSoffitCleanup = initAggregatorSoffit();
    if (aggregatorSoffitCleanup) {
        const previousCleanup = currentPageCleanup;
        currentPageCleanup = () => {
            aggregatorSoffitCleanup();
            if (previousCleanup) previousCleanup();
        };
    }

    // Text splitting
    document.querySelectorAll('.reveal-line').forEach(el => {
        if(el.querySelector('.reveal-line-inner')) return; // already split
        const text = el.innerText;
        el.innerHTML = '';
        const inner = document.createElement('span');
        inner.className = 'reveal-line-inner';
        inner.innerText = text;
        el.appendChild(inner);
    });

    // Hero anims
    gsap.to('.hero-title .reveal-line-inner', {
        y: '0%', opacity: 1, duration: 0.9, ease: "cubic-bezier(0.215, 0.610, 0.355, 1)", stagger: 0.1
    });
    gsap.to('.hero-primary .reveal-line-inner', {
        y: '0%', opacity: 1, duration: 0.9, delay: 0.2, ease: "cubic-bezier(0.215, 0.610, 0.355, 1)"
    });
    const heroSecondary = document.querySelector('.hero-secondary .reveal-line-inner');
    if (heroSecondary) {
        gsap.to(heroSecondary, {
            y: '0%', opacity: 1, duration: 0.9, delay: 0.3, ease: "cubic-bezier(0.215, 0.610, 0.355, 1)"
        });
    }
    gsap.to('.hero-actions', {
        y: 0, opacity: 1, duration: 0.8, delay: 0.5, ease: "power2.out"
    });

    // Scroll Reveals
    document.querySelectorAll('.scroll-reveal').forEach(el => {
        gsap.fromTo(el, 
            { y: 35, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power2.out",
              scrollTrigger: { trigger: el, start: "top 85%", once: true } }
        );
    });

    document.querySelectorAll('.scroll-scale').forEach(el => {
        gsap.fromTo(el, 
            { scale: 0.96, y: 20, opacity: 0 },
            { scale: 1, y: 0, opacity: 1, duration: 1, ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 85%", once: true } }
        );
    });

    document.querySelectorAll('.reveal-line').forEach(el => {
        if (el.closest('.hero')) return;
        gsap.fromTo(el.querySelector('.reveal-line-inner') || el,
            { y: '100%', opacity: 0 },
            { y: '0%', opacity: 1, duration: 0.8, ease: "cubic-bezier(0.215, 0.610, 0.355, 1)",
              scrollTrigger: { trigger: el, start: "top 90%", once: true } }
        );
    });

    // Payment flow
    const flowStages = document.querySelectorAll('.flow-stage');
    if (flowStages.length > 0) {
        ScrollTrigger.create({
            trigger: '.payment-flow-section',
            start: "top 60%", end: "bottom 80%",
            onUpdate: (self) => {
                const progress = self.progress;
                const activeIndex = Math.min(Math.floor(progress * flowStages.length), flowStages.length - 1);
                
                if (window.innerWidth >= 768) gsap.to('.flow-progress', { width: `${progress * 100}%`, duration: 0.1 });
                else gsap.to('.flow-progress', { height: `${progress * 100}%`, duration: 0.1 });

                flowStages.forEach((stage, idx) => {
                    if (idx <= activeIndex) stage.classList.add('is-active');
                    else stage.classList.remove('is-active');
                });
            }
        });
    }
    const terminalImg = document.querySelector('.terminal-img');
    if (terminalImg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.fromTo(terminalImg,
            { opacity: 0, x: 70, y: 25, scale: 0.96 },
            { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.9, ease: "cubic-bezier(.16,1,.3,1)",
              scrollTrigger: { trigger: '.terminal-composition', start: "top 85%", once: true } }
        );
    }
    // AGREGADOR PAGE LOGIC
    // 1. Terminal 2 Entrance
    const tHeroImg = document.querySelector('.terminal-hero-img');
    if (tHeroImg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.fromTo(tHeroImg,
            { opacity: 0, y: 50, scale: 0.95 },
            { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: "cubic-bezier(.16,1,.3,1)",
              scrollTrigger: { trigger: '.terminal-hero-section', start: "top 80%", once: true } }
        );
    }

    // 2. Model Steps Interaction
    const modelSteps = document.querySelectorAll('.model-step');
    const diagramLayers = document.querySelectorAll('.diagram-layer');
    const diagram = document.querySelector('.interactive-diagram');
    if (modelSteps.length > 0) {
        modelSteps.forEach(step => {
            step.addEventListener('mouseenter', () => {
                const targetId = step.getAttribute('data-target');
                modelSteps.forEach(s => s.classList.remove('is-active'));
                step.classList.add('is-active');
                if (diagram) {
                    diagram.classList.remove('active-dev', 'active-inc', 'active-op');
                    if(targetId === 'dev-node') diagram.classList.add('active-dev');
                    if(targetId === 'inc-node') diagram.classList.add('active-inc');
                    if(targetId === 'op-node') diagram.classList.add('active-op');
                }
            });
            // click for mobile
            step.addEventListener('click', () => {
                const targetId = step.getAttribute('data-target');
                modelSteps.forEach(s => s.classList.remove('is-active'));
                step.classList.add('is-active');
                if (diagram) {
                    diagram.classList.remove('active-dev', 'active-inc', 'active-op');
                    if(targetId === 'dev-node') diagram.classList.add('active-dev');
                    if(targetId === 'inc-node') diagram.classList.add('active-inc');
                    if(targetId === 'op-node') diagram.classList.add('active-op');
                }
            });
        });
        // Init first active
        modelSteps[0].dispatchEvent(new Event('mouseenter'));
    }

    // 3. Accordions
    const accPanels = document.querySelectorAll('.acc-panel');
    if (accPanels.length > 0) {
        accPanels.forEach(panel => {
            panel.addEventListener('click', () => {
                if (!panel.classList.contains('is-active')) {
                    accPanels.forEach(p => p.classList.remove('is-active'));
                    panel.classList.add('is-active');
                }
            });
        });
    }

    // 4. Scroll Storytelling
    const storySteps = document.querySelectorAll('.story-step');
    const dynamicNodesGroup = document.querySelector('.dynamic-nodes');
    const dynamicPulsesGroup = document.querySelector('.dynamic-pulses');
    const storyDashboards = document.querySelectorAll('.story-dashboard');
    
    if (storySteps.length > 0 && dynamicNodesGroup) {
        ScrollTrigger.create({
            trigger: '.story-section',
            start: "top 40%",
            end: "bottom 80%",
            onUpdate: (self) => {
                const progress = self.progress;
                const activeIndex = Math.min(Math.floor(progress * storySteps.length), storySteps.length - 1);
                
                storySteps.forEach((step, idx) => {
                    if (idx === activeIndex) step.classList.add('is-active');
                    else step.classList.remove('is-active');
                });
                
                const stepVal = activeIndex + 1;
                
                // Visual logic for each step
                dynamicNodesGroup.innerHTML = '';
                dynamicPulsesGroup.innerHTML = '';
                storyDashboards.forEach(d => d.setAttribute('opacity', '0'));
                
                if (stepVal >= 1) { // INCORPORACIÓN - 1 comercio
                    dynamicNodesGroup.innerHTML += '<circle cx="200" cy="40" r="20" fill="#f8fafc" stroke="var(--line)"/><text x="200" y="45" font-size="10" text-anchor="middle">COM</text>';
                }
                if (stepVal >= 2) { // CONFIG - conecta
                    dynamicNodesGroup.innerHTML += '<path d="M200,60 L200,100" stroke="var(--line)" stroke-dasharray="4 4"/>';
                }
                if (stepVal >= 3) { // ACEPTACION - flujo
                    dynamicPulsesGroup.innerHTML += '<circle cx="200" cy="80" r="4" fill="var(--mx-primary)"><animate attributeName="cy" values="40;100" dur="1s" repeatCount="indefinite"/></circle>';
                }
                if (stepVal >= 4) { // PROCESAMIENTO
                    dynamicPulsesGroup.innerHTML += '<circle cx="200" cy="155" r="4" fill="#fff"><animate attributeName="cy" values="100;200" dur="1s" repeatCount="indefinite"/></circle>';
                }
                if (stepVal >= 5) { // OPERACION - dashboard
                    storyDashboards.forEach(d => d.setAttribute('opacity', '1'));
                }
                if (stepVal >= 6) { // ESCALA - varios comercios
                    dynamicNodesGroup.innerHTML += '<circle cx="120" cy="40" r="20" fill="#f8fafc" stroke="var(--line)"/><text x="120" y="45" font-size="10" text-anchor="middle">COM</text>';
                    dynamicNodesGroup.innerHTML += '<path d="M120,60 L200,100" stroke="var(--line)" stroke-dasharray="4 4"/>';
                    dynamicNodesGroup.innerHTML += '<circle cx="280" cy="40" r="20" fill="#f8fafc" stroke="var(--line)"/><text x="280" y="45" font-size="10" text-anchor="middle">COM</text>';
                    dynamicNodesGroup.innerHTML += '<path d="M280,60 L200,100" stroke="var(--line)" stroke-dasharray="4 4"/>';
                }
            }
        });
    }
    // PROCESAMIENTO PAGE LOGIC
    // 1. Tri Nodes
    const triNodes = document.querySelectorAll('.tri-node');
    if (triNodes.length > 0) {
        triNodes.forEach(node => {
            node.addEventListener('mouseenter', () => {
                const lines = document.querySelectorAll('.tri-path');
                lines.forEach(l => l.style.stroke = 'rgba(12,71,114,0.1)');
                
                const id = node.getAttribute('data-node');
                if(id === 'tec') { document.getElementById('line-tp').style.stroke = 'var(--mx-primary)'; document.getElementById('line-pt').style.stroke = 'var(--mx-primary)'; }
                if(id === 'per') { document.getElementById('line-tp').style.stroke = 'var(--mx-primary)'; document.getElementById('line-pp').style.stroke = 'var(--mx-primary)'; }
                if(id === 'pro') { document.getElementById('line-pp').style.stroke = 'var(--mx-primary)'; document.getElementById('line-pt').style.stroke = 'var(--mx-primary)'; }
            });
        });
    }

    // 2. Timeline Sticky
    const tlSteps = document.querySelectorAll('.tl-step');
    if (tlSteps.length > 0) {
        ScrollTrigger.create({
            trigger: '.proc-story-section',
            start: "top 40%",
            end: "bottom 80%",
            onUpdate: (self) => {
                const progress = self.progress;
                gsap.to('.timeline-progress', { height: `${progress * 100}%`, duration: 0.1 });
                
                const activeIndex = Math.min(Math.floor(progress * tlSteps.length), tlSteps.length - 1);
                tlSteps.forEach((step, idx) => {
                    if (idx <= activeIndex) step.classList.add('is-active');
                    else step.classList.remove('is-active');
                });
            }
        });
    }

    // 3. Dashboard Visibility
    const procDash = document.querySelector('.proc-dash-visual-wrapper');
    const procDashboardImage = document.querySelector('.proc-dashboard-image');
    if (procDash && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.fromTo(procDashboardImage,
            { scale: 0.94, y: 40, opacity: 0 },
            { scale: 1, y: 0, opacity: 1, duration: 1, ease: "cubic-bezier(.16,1,.3,1)",
              scrollTrigger: { trigger: procDash, start: "top 80%", once: true } }
        );
        const callouts = document.querySelectorAll('.dash-callout');
        callouts.forEach((c, i) => {
            gsap.to(c, {
                scrollTrigger: { trigger: procDash, start: "top 70%", once: true },
                onStart: () => c.classList.add('is-visible'),
                delay: 0.5 + (i * 0.1)
            });
        });
    }

    // 4. Admin Services Tabs
    const srvItems = document.querySelectorAll('.srv-item');
    if (srvItems.length > 0) {
        srvItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                srvItems.forEach(s => s.classList.remove('is-active'));
                item.classList.add('is-active');
                const id = item.getAttribute('data-srv');
                document.querySelectorAll('.srv-vis-content').forEach(v => v.classList.remove('is-active'));
                document.getElementById('vis-' + id).classList.add('is-active');
            });
            item.addEventListener('click', () => {
                srvItems.forEach(s => s.classList.remove('is-active'));
                item.classList.add('is-active');
                const id = item.getAttribute('data-srv');
                document.querySelectorAll('.srv-vis-content').forEach(v => v.classList.remove('is-active'));
                document.getElementById('vis-' + id).classList.add('is-active');
            });
        });
    }

    // 5. Complexity Convergence
    const compVis = document.querySelector('.after-comp');
    if (compVis && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        ScrollTrigger.create({
            trigger: '.comp-grid',
            start: "top 80%",
            once: true,
            onEnter: () => compVis.classList.add('is-animated')
        });
    }

    // NOSOTROS PAGE LOGIC
    // 1. Timeline
    const nosTlItems = document.querySelectorAll('.nos-tl-item');
    if (nosTlItems.length > 0) {
        ScrollTrigger.create({
            trigger: '.nos-timeline-section',
            start: "top 50%",
            end: "bottom 80%",
            onUpdate: (self) => {
                const progress = self.progress;
                const activeIndex = Math.floor(progress * nosTlItems.length);
                nosTlItems.forEach((step, idx) => {
                    if (idx <= activeIndex) step.classList.add('is-active');
                    else step.classList.remove('is-active');
                });
            }
        });
    }

    // 2. Mision Vision
    const mvGrid = document.querySelector('.mv-grid');
    if (mvGrid && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        ScrollTrigger.create({
            trigger: '.nos-mv-section',
            start: "top 80%",
            once: true,
            onEnter: () => {
                mvGrid.classList.add('is-animated');
                gsap.fromTo('.mv-mision', { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 1.5, ease: "power2.out" });
                gsap.fromTo('.mv-vision', { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 1.5, ease: "power2.out" });
            }
        });
    }

    // 3. Define Words
    const defineBlocks = document.querySelectorAll('.define-word-block');
    if (defineBlocks.length > 0) {
        defineBlocks.forEach(block => {
            ScrollTrigger.create({
                trigger: block,
                start: "top 60%",
                end: "bottom 40%",
                onEnter: () => block.classList.add('is-active'),
                onLeaveBack: () => block.classList.remove('is-active')
            });
        });
    }

    // 4. CTA Shapes Parallax
    const nosCta = document.querySelector('.nos-cta-section');
    if (nosCta && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.to('.shape-bl', {
            x: 15, y: -15,
            scrollTrigger: { trigger: nosCta, start: "top bottom", end: "bottom top", scrub: 1 }
        });
        gsap.to('.shape-tr', {
            x: -15, y: 15,
            scrollTrigger: { trigger: nosCta, start: "top bottom", end: "bottom top", scrub: 1 }
        });
    }

    // Canvas
    initCanvas();
    
    // Logos Slider
    initLogosSlider();
    
    // Page specific forms/buttons
    const contactForm = document.getElementById('page-contact-form') || document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            console.warn('Form submission stubbed. Requires API endpoint.');
        });
    }
    
    // Route buttons inside pages (Contacto)
    const routeButtons = document.querySelectorAll('.btn-route');
    const selectInterest = document.getElementById('interest');
    if (routeButtons.length > 0 && selectInterest) {
        routeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const route = btn.getAttribute('data-route');
                selectInterest.value = route;
                routeButtons.forEach(b => b.style.borderColor = 'var(--line)');
                btn.style.borderColor = 'var(--mx-primary)';
            });
        });
    }
}

function initAggregatorSoffit() {
    const card = document.querySelector('#app-root > section.aggregator-continuity');
    const canvas = card && card.querySelector('.aggregator-soffit-canvas');
    if (!card || !canvas) return null;

    const CONFIG = {
        bgColor: '#062334',
        colorA: '#2b7be8',
        colorB: '#2bc8e8',
        colorC: '#4fe0d8',
        colorD: '#7fe8a0',
        ambient: 0.24,
        amount: 0.2,
        bounce: 0.38,
        bounceCurve: 4.25,
        breathe: 0.29,
        contrast: 2.45,
        cursor: 1,
        curve: 3.32,
        direct: 0.97,
        dither: 0.58,
        flow: 0.475,
        glow: 0.38,
        grain: 0,
        grainAnim: 0,
        horizon: 0.36,
        lacunarity: 1.99,
        lift: 0.11,
        maxDpr: 1,
        midpoint: 0.57,
        moteScale: 7,
        motes: 0.074,
        parallax: 0.0137,
        rock: 0.12,
        roughness: 0.29,
        scale: 1,
        sink: 0.24,
        speed: 0.33,
        spillCentre: 0.3,
        spillFloor: 0.26,
        spillWidth: 2.18,
        spread: 0.41,
        steer: -0.13,
        sweep: 0.5,
        tilt: 1.87,
        vignette: 0.21,
        warp: 2.58,
        warpScale: 0.78
    };

    let gl;
    let program;
    let vertexShader;
    let fragmentShader;
    let animationFrame;
    let resizeFrame;
    let resizeQueued = false;
    let visible = true;
    let resizeObserver;
    let visibilityObserver;

    try {
        gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            powerPreference: 'high-performance'
        });
        if (!gl) throw new Error('WebGL2 is not available in this browser.');

        const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

        const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  iResolution;
uniform float iTime;
uniform vec2  iMouse;          // aspect-corrected units, same space as uv
uniform float uScale;          // zoom of the whole picture — uv and the pointer together

uniform vec3  uBg, uColorA, uColorB, uColorC, uColorD;
uniform float uSpeed, uTilt, uRock, uHorizon, uBreathe, uSpread, uCurve, uDirect;
uniform float uBounce, uBounceCurve;
uniform float uSpillCentre, uSpillWidth, uSpillFloor;
uniform float uAmount, uWarp, uWarpScale, uFlow, uRoughness, uLacunarity, uMotes, uMoteScale;
uniform float uAmbient, uContrast, uMidpoint, uSink, uGlow;
uniform float uGrain, uDither, uVignette;
uniform float uSteer, uLift, uSweep, uParallax;
uniform float uGrainAnim;

#define OCTAVES 4

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float snoise(vec2 p) {
  const float K1 = 0.366025404, K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash2(i)), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));
  return dot(n, vec3(70.0));
}

float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    v += amp * snoise(p);
    p *= uLacunarity;
    amp *= uRoughness;
  }
  return v;
}

vec3 ramp4(float t) {
  vec3 c = mix(uColorA, uColorB, smoothstep(0.00, 0.36, t));
  c = mix(c, uColorC, smoothstep(0.32, 0.70, t));
  c = mix(c, uColorD, smoothstep(0.66, 1.00, t));
  return c;
}

float triDither(vec2 fc) {
  float a = fract(sin(dot(fc, vec2(12.9898, 78.233))) * 43758.5453);
  float b = fract(sin(dot(fc + 17.0, vec2(12.9898, 78.233))) * 43758.5453);
  return (a + b - 1.0) / 255.0;
}

// ---- house grain. ONE look across the collection: an integer hash (no sin() streaks),
// triangular so it reads as film rather than static, weighted into the midtones so it
// never crusts a black or a white. Static by default; uGrainAnim re-seeds it 24×/s.
float houseGrain(vec2 fc) {
  uvec2 q = uvec2(fc) * uvec2(1597334677u, 3812015801u)
          + uint(floor(iTime * 24.0 * uGrainAnim)) * 2654435769u;
  uint n = q.x ^ q.y; n = n * 1664525u + 1013904223u; n ^= n >> 16u; n *= 2246822519u; n ^= n >> 13u;
  float a = float(n & 0xffffu) / 65535.0;
  n *= 3266489917u; n ^= n >> 16u;
  float b = float(n & 0xffffu) / 65535.0;
  return a + b - 1.0;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution) / iResolution.y;
  uv *= uScale;                             // scale: zoom of the whole picture
  vec2 iM = iMouse * uScale;                // the pointer, in the same zoomed space
  float t = iTime * uSpeed;

  vec2 p = uv - iM * uParallax;

  // THE LIGHT HAS A DIRECTION and the picture is that direction, not a pattern. Everything
  // below is a function of ONE number: how far along the light axis this pixel is. The noise
  // is only allowed to perturb that number, which is the difference between a lit surface
  // and a noise field with a nice palette on it.
  float tilt = uTilt + sin(t * 0.13) * uRock + iM.x * uSteer;
  vec2 dir = vec2(cos(tilt), sin(tilt));
  float axis = dot(p, dir);
  float across = dot(p, vec2(-dir.y, dir.x));

  // the air the light crosses, as a domain-warped field. Held to uAmount: past about a third
  // it stops perturbing the light and starts being the subject, and the direction dissolves.
  vec2 q = vec2(fbm(p * uWarpScale + vec2(0.0, t * uFlow)),
                fbm(p * uWarpScale + vec2(5.2, 1.3) - t * uFlow * 0.7));
  float air = fbm(p + uWarp * q + vec2(t * 0.12, -t * 0.09)) * 0.5 + 0.5;

  float horizon = uHorizon + sin(t * 0.09 + 2.1) * uBreathe - iM.y * uLift;
  float alt = clamp(0.5 + (axis - horizon) * uSpread + (air - 0.5) * uAmount, 0.0, 1.0);

  // THE OPENING IS NOT INFINITELY WIDE. A band across the light axis — never a disc — so the
  // brightest part of the frame sits off to one side and the composition has a long empty end.
  float ac = (across - uSpillCentre - iM.x * uSweep) / max(0.05, uSpillWidth);
  float spill = mix(uSpillFloor, 1.0, exp(-ac * ac));

  float direct = pow(alt, max(0.05, uCurve)) * uDirect * spill;

  // THE BOUNCE. Light that has already been in the shade and come back out of it: it falls off
  // the OTHER way, so the deep end lifts off the floor instead of dying to a flat black. This
  // is the whole reason a shadow can be a subject rather than an absence.
  float bounce = uBounce * pow(1.0 - alt, max(0.05, uBounceCurve));

  float f = uAmbient + direct + bounce;
  f += uMotes * snoise(p * uMoteScale + vec2(-t * 0.5, t * 0.35)) * 0.5 * alt;

  f = clamp((f - uMidpoint) * uContrast + 0.5, 0.0, 1.0);

  vec3 col = ramp4(f);
  col += uColorD * uGlow * pow(f, 4.0);
  col = mix(uBg, col, smoothstep(0.0, max(0.01, uSink), f) * 0.90 + 0.10);

  col *= 1.0 - uVignette * dot(uv, uv);
  { float hgL = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    col += houseGrain(gl_FragCoord.xy) * uGrain * mix(1.0, 4.0 * hgL * (1.0 - hgL), 0.6); }
  col += triDither(gl_FragCoord.xy) * uDither;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

        function compile(type, source) {
            const shader = gl.createShader(type);
            if (!shader) throw new Error('Unable to create a WebGL2 shader.');
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const message = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                throw new Error(message || 'Unable to compile the Soffit shader.');
            }
            return shader;
        }

        vertexShader = compile(gl.VERTEX_SHADER, VERT);
        fragmentShader = compile(gl.FRAGMENT_SHADER, FRAG);
        program = gl.createProgram();
        if (!program) throw new Error('Unable to create the Soffit WebGL2 program.');
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program) || 'Unable to link the Soffit WebGL2 program.');
        }
        gl.useProgram(program);
        gl.bindVertexArray(gl.createVertexArray());

        const locations = {};
        const loc = name => {
            if (!(name in locations)) locations[name] = gl.getUniformLocation(program, name);
            return locations[name];
        };
        const u1f = (name, value) => gl.uniform1f(loc(name), value);
        const u2f = (name, x, y) => gl.uniform2f(loc(name), x, y);
        const hexToVec3 = hex => {
            const value = Number.parseInt(hex.slice(1), 16);
            return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
        };
        const u3c = (name, hex) => {
            const color = hexToVec3(hex);
            gl.uniform3f(loc(name), color[0], color[1], color[2]);
        };

        gl.useProgram(program);
        u3c('uBg', CONFIG.bgColor);
        u3c('uColorA', CONFIG.colorA);
        u3c('uColorB', CONFIG.colorB);
        u3c('uColorC', CONFIG.colorC);
        u3c('uColorD', CONFIG.colorD);
        u1f('uScale', CONFIG.scale);
        u1f('uSpeed', CONFIG.speed);
        u1f('uTilt', CONFIG.tilt);
        u1f('uRock', CONFIG.rock);
        u1f('uHorizon', CONFIG.horizon);
        u1f('uBreathe', CONFIG.breathe);
        u1f('uSpread', CONFIG.spread);
        u1f('uCurve', CONFIG.curve);
        u1f('uDirect', CONFIG.direct);
        u1f('uBounce', CONFIG.bounce);
        u1f('uBounceCurve', CONFIG.bounceCurve);
        u1f('uSpillCentre', CONFIG.spillCentre);
        u1f('uSpillWidth', CONFIG.spillWidth);
        u1f('uSpillFloor', CONFIG.spillFloor);
        u1f('uAmount', CONFIG.amount);
        u1f('uWarp', CONFIG.warp);
        u1f('uWarpScale', CONFIG.warpScale);
        u1f('uFlow', CONFIG.flow);
        u1f('uRoughness', CONFIG.roughness);
        u1f('uLacunarity', CONFIG.lacunarity);
        u1f('uMotes', CONFIG.motes);
        u1f('uMoteScale', CONFIG.moteScale);
        u1f('uAmbient', CONFIG.ambient);
        u1f('uContrast', CONFIG.contrast);
        u1f('uMidpoint', CONFIG.midpoint);
        u1f('uSink', CONFIG.sink);
        u1f('uGlow', CONFIG.glow);
        u1f('uGrain', CONFIG.grain);
        u1f('uGrainAnim', CONFIG.grainAnim);
        u1f('uDither', CONFIG.dither);
        u1f('uVignette', CONFIG.vignette);
        u1f('uSteer', CONFIG.steer);
        u1f('uLift', CONFIG.lift);
        u1f('uSweep', CONFIG.sweep);
        u1f('uParallax', CONFIG.parallax);

        let dpr = 1;
        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
            const rect = card.getBoundingClientRect();
            const width = Math.max(1, Math.round(rect.width * dpr));
            const height = Math.max(1, Math.round(rect.height * dpr));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
            gl.viewport(0, 0, width, height);
            gl.useProgram(program);
            u2f('iResolution', width, height);
        }

        function queueResize() {
            if (resizeQueued) return;
            resizeQueued = true;
            resizeFrame = requestAnimationFrame(() => {
                resizeQueued = false;
                resize();
            });
        }

        resize();
        resizeObserver = new ResizeObserver(queueResize);
        resizeObserver.observe(card);
        window.addEventListener('resize', queueResize, { passive: true });

        const mouse = { x: 0, y: 0, ax: 0, ay: 0, tx: 0, ty: 0 };
        const aim = event => {
            const rect = card.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const aspect = rect.width / rect.height;
            mouse.tx = ((event.clientX - rect.left) / rect.width - 0.5) * aspect;
            mouse.ty = 0.5 - (event.clientY - rect.top) / rect.height;
        };
        card.addEventListener('pointermove', aim, { passive: true });
        card.addEventListener('pointerdown', aim, { passive: true });

        visibilityObserver = new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
        }, { threshold: 0 });
        visibilityObserver.observe(canvas);

        const t0 = performance.now();
        let prevT = t0, clock = 0, fpsT = t0, fpsN = 0;
        function frame(now) {
            animationFrame = requestAnimationFrame(frame);
            const raw = now - prevT;
            prevT = now;
            if (!visible || document.hidden) return;
            const ms = raw > 50 ? 50 : raw < 4.167 ? 4.167 : raw;
            const s = ms > 36.7 ? 2.2 : ms * 0.06;
            clock += ms * 0.001;

            const kLead = 0.105 * s, kBody = 0.043 * s;
            mouse.ax += (mouse.tx - mouse.ax) * kLead;
            mouse.ay += (mouse.ty - mouse.ay) * kLead;
            mouse.x += (mouse.ax - mouse.x) * kBody;
            mouse.y += (mouse.ay - mouse.y) * kBody;

            gl.useProgram(program);
            u1f('iTime', clock);
            if (mouse.rest === undefined) mouse.rest = { x: mouse.tx, y: mouse.ty };
            if (!CONFIG.cursor) {
                mouse.tx = mouse.rest.x;
                mouse.ty = mouse.rest.y;
            }
            u2f('iMouse', mouse.x, mouse.y);
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            fpsN++;
            if (now - fpsT > 500) {
                fpsT = now;
                fpsN = 0;
            }
        }

        gl.drawArrays(gl.TRIANGLES, 0, 3);
        animationFrame = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(animationFrame);
            cancelAnimationFrame(resizeFrame);
            resizeObserver.disconnect();
            visibilityObserver.disconnect();
            window.removeEventListener('resize', queueResize);
            card.removeEventListener('pointermove', aim);
            card.removeEventListener('pointerdown', aim);
            if (program) gl.deleteProgram(program);
            if (vertexShader) gl.deleteShader(vertexShader);
            if (fragmentShader) gl.deleteShader(fragmentShader);
        };
    } catch (error) {
        console.error('No se pudo inicializar el fondo Soffit de la tarjeta de agregadores.', error);
        if (program && gl) gl.deleteProgram(program);
        if (vertexShader && gl) gl.deleteShader(vertexShader);
        if (fragmentShader && gl) gl.deleteShader(fragmentShader);
        return null;
    }
}

let canvasAnimReq;
function initCanvas() {
    const canvas = document.getElementById('liquid-canvas');
    if (!canvas) return;
    
    if (canvasAnimReq) cancelAnimationFrame(canvasAnimReq);

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && window.innerWidth > 768) {
        const ctx = canvas.getContext('2d');
        let width, height;
        let mouse = { x: -1000, y: -1000 };
        let points = [];
        
        function resize() {
            if(!canvas.parentElement) return;
            const rect = canvas.parentElement.getBoundingClientRect();
            width = rect.width; height = rect.height;
            canvas.width = width * Math.min(window.devicePixelRatio, 2);
            canvas.height = height * Math.min(window.devicePixelRatio, 2);
            ctx.scale(Math.min(window.devicePixelRatio, 2), Math.min(window.devicePixelRatio, 2));
        }

        window.addEventListener('resize', resize);
        resize();

        window.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
            points.push({ x: mouse.x, y: mouse.y, radius: 100, life: 1 });
        });

        function animateCanvas() {
            if(!document.body.contains(canvas)) return; // stop if canvas removed
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#FAFCFD';
            ctx.fillRect(0, 0, width, height);

            for (let i = points.length - 1; i >= 0; i--) {
                const p = points[i];
                p.life -= 0.015;
                p.radius += 0.5;
                if (p.life <= 0) { points.splice(i, 1); continue; }
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(76, 168, 226, ${p.life * 0.05})`;
                ctx.fill();
            }
            canvasAnimReq = requestAnimationFrame(animateCanvas);
        }
        animateCanvas();
    }
}

function initProcessingFluidHero() {
    const container = document.querySelector('.processing-hero');
    const canvas = document.querySelector('.processing-fluid-canvas');
    if (!container || !canvas) return null;

    const isMobile = window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches;
    const config = {
        SIM_RESOLUTION: isMobile ? 128 : 200,
        DYE_RESOLUTION: isMobile ? 256 : 512,
        DENSITY_DISSIPATION: 0.958,
        VELOCITY_DISSIPATION: 0.96,
        PRESSURE_DISSIPATION: 0.8,
        PRESSURE_ITERATIONS: 20,
        CURL: 42,
        SPLAT_RADIUS: 0.22,
        SHADING: !isMobile,
        COLORFUL: true,
        PAUSED: false,
        BACK_COLOR: { r: 7 / 255, g: 29 / 255, b: 46 / 255 }
    };

    let gl = canvas.getContext('webgl2', { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false });
    const isWebGL2 = !!gl;
    if (!gl) {
        gl = canvas.getContext('webgl', { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false }) ||
             canvas.getContext('experimental-webgl', { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false });
    }

    if (!gl) {
        container.classList.add('no-webgl');
        return null;
    }

    let halfFloat;
    let supportLinearFiltering;
    if (isWebGL2) {
        gl.getExtension('EXT_color_buffer_float');
        supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
    } else {
        halfFloat = gl.getExtension('OES_texture_half_float');
        gl.getExtension('OES_texture_half_float_linear');
        gl.getExtension('OES_texture_float');
        supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : (halfFloat ? halfFloat.HALF_FLOAT_OES : gl.UNSIGNED_BYTE);
    
    function supportRenderTextureFormat(gl, internalFormat, format, type) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        gl.deleteTexture(texture);
        gl.deleteFramebuffer(fbo);
        return status === gl.FRAMEBUFFER_COMPLETE;
    }

    function getSupportedFormat(gl, internalFormat, format, type) {
        if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
            switch (internalFormat) {
                case gl.R16F:
                    return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
                case gl.RG16F:
                    return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
                default:
                    return null;
            }
        }
        return { internalFormat, format };
    }

    let formatRGBA = isWebGL2 ? getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType) : getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    let formatRG = isWebGL2 ? getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType) : getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    let formatR = isWebGL2 ? getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType) : getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);

    if (!formatRGBA) {
        container.classList.add('no-webgl');
        return null;
    }

    function compileShader(type, source, keywords) {
        let shaderSource = source;
        if (keywords) {
            let keywordsString = '';
            keywords.forEach(keyword => {
                keywordsString += '#define ' + keyword + '\n';
            });
            shaderSource = keywordsString + source;
        }
        const shader = gl.createShader(type);
        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    function createProgram(vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
        }
        return program;
    }

    const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
        precision highp float;
        attribute vec2 aPosition;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform vec2 texelSize;

        void main () {
            vUv = aPosition * 0.5 + 0.5;
            vL = vUv - vec2(texelSize.x, 0.0);
            vR = vUv + vec2(texelSize.x, 0.0);
            vT = vUv + vec2(0.0, texelSize.y);
            vB = vUv - vec2(0.0, texelSize.y);
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `);

    const clearShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        uniform sampler2D uTexture;
        uniform float value;

        void main () {
            gl_FragColor = value * texture2D(uTexture, vUv);
        }
    `);

    const displayShaderSource = `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform sampler2D uTexture;
        uniform vec2 texelSize;
        uniform vec3 uBackColor;

        void main () {
            vec3 c = texture2D(uTexture, vUv).rgb;
            #ifdef SHADING
                vec3 lc = texture2D(uTexture, vL).rgb;
                vec3 rc = texture2D(uTexture, vR).rgb;
                vec3 tc = texture2D(uTexture, vT).rgb;
                vec3 bc = texture2D(uTexture, vB).rgb;

                float dx = length(rc) - length(lc);
                float dy = length(tc) - length(bc);

                vec3 n = normalize(vec3(dx, dy, length(texelSize)));
                vec3 l = vec3(0.0, 0.0, 1.0);

                float diffuse = max(0.0, dot(n, l));
                c *= (diffuse + 0.15);
            #endif

            vec3 finalColor = uBackColor + c;
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;
    const displayShader = compileShader(gl.FRAGMENT_SHADER, displayShaderSource, config.SHADING ? ['SHADING'] : []);

    const splatShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspect;
        uniform vec3 color;
        uniform vec2 point;
        uniform float radius;

        void main () {
            vec2 p = vUv - point.xy;
            p.x *= aspect;
            vec3 splat = exp(-dot(p, p) / radius) * color;
            vec3 base = texture2D(uTarget, vUv).xyz;
            gl_FragColor = vec4(base + splat, 1.0);
        }
    `);

    const advectionShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texelSize;
        uniform float dt;
        uniform float dissipation;

        void main () {
            vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
            vec4 result = texture2D(uSource, coord);
            float decay = dissipation;
            gl_FragColor = decay * result;
        }
    `);

    const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;

        void main () {
            float L = texture2D(uVelocity, vL).x;
            float R = texture2D(uVelocity, vR).x;
            float T = texture2D(uVelocity, vT).y;
            float B = texture2D(uVelocity, vB).y;

            vec2 C = texture2D(uVelocity, vUv).xy;
            if (vL.x < 0.0) { L = -C.x; }
            if (vR.x > 1.0) { R = -C.x; }
            if (vT.y > 1.0) { T = -C.y; }
            if (vB.y < 0.0) { B = -C.y; }

            float div = 0.5 * (R - L + T - B);
            gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
        }
    `);

    const curlShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;

        void main () {
            float L = texture2D(uVelocity, vL).y;
            float R = texture2D(uVelocity, vR).y;
            float T = texture2D(uVelocity, vT).x;
            float B = texture2D(uVelocity, vB).x;
            float vorticity = R - L - T + B;
            gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
        }
    `);

    const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform float curl;
        uniform float dt;

        void main () {
            float L = texture2D(uCurl, vL).x;
            float R = texture2D(uCurl, vR).x;
            float T = texture2D(uCurl, vT).x;
            float B = texture2D(uCurl, vB).x;
            float C = texture2D(uCurl, vUv).x;

            vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
            float l = length(force);
            force = (l > 0.0001) ? (force / l) : vec2(0.0);
            force *= curl * C;
            force.y *= -1.0;

            vec2 vel = texture2D(uVelocity, vUv).xy;
            gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
        }
    `);

    const pressureShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;

        void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            float C = texture2D(uPressure, vUv).x;
            float divergence = texture2D(uDivergence, vUv).x;
            float pressure = (L + R + B + T - divergence) * 0.25;
            gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
    `);

    const gradSubProgram = createProgram(baseVertexShader, compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;

        void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;

            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity.xy -= vec2(R - L, T - B) * 0.5;
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
    `));

    const clearProgram = createProgram(baseVertexShader, clearShader);
    const displayProgram = createProgram(baseVertexShader, displayShader);
    const splatProgram = createProgram(baseVertexShader, splatShader);
    const advectionProgram = createProgram(baseVertexShader, advectionShader);
    const divergenceProgram = createProgram(baseVertexShader, divergenceShader);
    const curlProgram = createProgram(baseVertexShader, curlShader);
    const vorticityProgram = createProgram(baseVertexShader, vorticityShader);
    const pressureProgram = createProgram(baseVertexShader, pressureShader);

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);

    function blit(target, clear = false) {
        if (target == null) {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
            gl.viewport(0, 0, target.width, target.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }

        if (clear) {
            gl.clear(gl.COLOR_BUFFER_BIT);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    function createFBO(w, h, internalFormat, format, type, param) {
        gl.activeTexture(gl.TEXTURE0);
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.viewport(0, 0, w, h);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const texelSizeX = 1.0 / w;
        const texelSizeY = 1.0 / h;

        return {
            texture, fbo, width: w, height: h,
            texelSizeX, texelSizeY,
            attach(id) {
                gl.activeTexture(gl.TEXTURE0 + id);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                return id;
            }
        };
    }

    function createDoubleFBO(w, h, internalFormat, format, type, param) {
        let fbo1 = createFBO(w, h, internalFormat, format, type, param);
        let fbo2 = createFBO(w, h, internalFormat, format, type, param);

        return {
            width: w, height: h,
            texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
            get read() { return fbo1; },
            set read(value) { fbo1 = value; },
            get write() { return fbo2; },
            set write(value) { fbo2 = value; },
            swap() { const temp = fbo1; fbo1 = fbo2; fbo2 = temp; }
        };
    }

    let dye, velocity, divergence, curl, pressure;

    function getResolution(resolution) {
        let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
        if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
        const min = Math.round(resolution);
        const max = Math.round(resolution * aspectRatio);
        if (gl.drawingBufferWidth > gl.drawingBufferHeight) {
            return { width: max, height: min };
        } else {
            return { width: min, height: max };
        }
    }

    function initFramebuffers() {
        const simRes = getResolution(config.SIM_RESOLUTION);
        const dyeRes = getResolution(config.DYE_RESOLUTION);

        const texType = halfFloatTexType;
        const filtering = supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

        dye = createDoubleFBO(dyeRes.width, dyeRes.height, formatRGBA.internalFormat, formatRGBA.format, texType, filtering);
        velocity = createDoubleFBO(simRes.width, simRes.height, formatRG.internalFormat, formatRG.format, texType, filtering);
        divergence = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, texType, gl.NEAREST);
        curl = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, texType, gl.NEAREST);
        pressure = createDoubleFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, texType, gl.NEAREST);
    }

    function resizeCanvas() {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            initFramebuffers();
        }
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const MEXIPAY_PRIMARY_BLUES = [
        [12, 71, 114],   // #0C4772 (MexiPay Primary)
        [20, 95, 145],   // #145F91
        [31, 111, 165],  // #1F6FA5
        [47, 143, 194],  // #2F8FC2
        [76, 168, 226]   // #4CA8E2
    ];

    const MEXIPAY_ACCENT_TEALS = [
        [97, 197, 214],  // #61C5D6 (Cyan)
        [108, 183, 174], // #6CB7AE (Teal)
        [143, 214, 208]  // #8FD6D0 (Mint)
    ];

    function generateColor() {
        // 70% weight to primary MexiPay blues, 30% weight to cyan/aqua/teal accents
        const isPrimary = Math.random() < 0.70;
        const palette = isPrimary ? MEXIPAY_PRIMARY_BLUES : MEXIPAY_ACCENT_TEALS;
        
        const idx = Math.floor(Math.random() * palette.length);
        const nextIdx = (idx + 1) % palette.length;
        const t = Math.random();
        const c1 = palette[idx];
        const c2 = palette[nextIdx];

        const r = (c1[0] + (c2[0] - c1[0]) * t) / 255;
        const g = (c1[1] + (c2[1] - c1[1]) * t) / 255;
        const b = (c1[2] + (c2[2] - c1[2]) * t) / 255;

        // Multiplicador 0.45 (+35% presencia visual y luminosidad)
        return { r: r * 0.45, g: g * 0.45, b: b * 0.45 };
    }

    function splat(x, y, dx, dy, color) {
        gl.viewport(0, 0, velocity.width, velocity.height);
        gl.useProgram(splatProgram);
        gl.uniform1i(gl.getUniformLocation(splatProgram, 'uTarget'), velocity.read.attach(0));
        gl.uniform1f(gl.getUniformLocation(splatProgram, 'aspect'), canvas.width / canvas.height);
        gl.uniform2f(gl.getUniformLocation(splatProgram, 'point'), x, y);
        gl.uniform3f(gl.getUniformLocation(splatProgram, 'color'), dx, dy, 0.0);
        gl.uniform1f(gl.getUniformLocation(splatProgram, 'radius'), config.SPLAT_RADIUS / 100.0);
        blit(velocity.write);
        velocity.swap();

        gl.viewport(0, 0, dye.width, dye.height);
        gl.uniform1i(gl.getUniformLocation(splatProgram, 'uTarget'), dye.read.attach(0));
        gl.uniform3f(gl.getUniformLocation(splatProgram, 'color'), color.r, color.g, color.b);
        blit(dye.write);
        dye.swap();
    }

    function multipleSplats(count) {
        for (let i = 0; i < count; i++) {
            const color = generateColor();
            const x = Math.random();
            const y = Math.random();
            const dx = (Math.random() - 0.5) * 1000;
            const dy = (Math.random() - 0.5) * 1000;
            splat(x, y, dx, dy, color);
        }
    }

    const splatStack = [];
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        multipleSplats(34);
        for (let i = 0; i < 8; i++) {
            splatStack.push(10 + parseInt(Math.random() * 10));
        }
    } else {
        multipleSplats(3);
    }

    const ORBIT_START_DELAY = 700;
    const ORBIT_RADIUS = 300;
    const ORBIT_SPEED = 0.026;

    let orbitAngle = 0;
    let autoCursorActive = false;
    let lastAutoPos = { x: 0, y: 0 };

    setTimeout(() => {
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            autoCursorActive = true;
        }
    }, ORBIT_START_DELAY);

    function updateAutoCursor(dt) {
        if (!autoCursorActive) return;
        orbitAngle += ORBIT_SPEED;
        const r = ORBIT_RADIUS * (0.72 + 0.28 * Math.sin(orbitAngle * 0.37));
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const x = centerX + r * Math.cos(orbitAngle);
        const y = centerY + r * Math.sin(orbitAngle);

        if (lastAutoPos.x !== 0 && lastAutoPos.y !== 0) {
            const dx = (x - lastAutoPos.x) * 3.5;
            const dy = (y - lastAutoPos.y) * 3.5;
            const color = generateColor();
            splat(x / canvas.width, 1.0 - y / canvas.height, dx, -dy, color);
        }
        lastAutoPos.x = x;
        lastAutoPos.y = y;
    }

    let pointerPos = { x: 0, y: 0, px: 0, py: 0, moved: false };

    function handlePointerMove(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;

        if (pointerPos.moved) {
            const dx = (x - pointerPos.px) * 5;
            const dy = (y - pointerPos.py) * 5;
            if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                splat(x / rect.width, 1.0 - y / rect.height, dx, -dy, generateColor());
            }
        }
        pointerPos.px = x;
        pointerPos.py = y;
        pointerPos.moved = true;
    }

    const onMouseMove = (e) => handlePointerMove(e.clientX, e.clientY);
    const onTouchMove = (e) => {
        if (e.touches && e.touches[0]) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onTouchMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    function step(dt) {
        gl.disable(gl.BLEND);

        gl.viewport(0, 0, curl.width, curl.height);
        gl.useProgram(curlProgram);
        gl.uniform2f(gl.getUniformLocation(curlProgram, 'texelSize'), velocity.read.texelSizeX, velocity.read.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(curlProgram, 'uVelocity'), velocity.read.attach(0));
        blit(curl);

        gl.viewport(0, 0, velocity.width, velocity.height);
        gl.useProgram(vorticityProgram);
        gl.uniform2f(gl.getUniformLocation(vorticityProgram, 'texelSize'), velocity.read.texelSizeX, velocity.read.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(vorticityProgram, 'uVelocity'), velocity.read.attach(0));
        gl.uniform1i(gl.getUniformLocation(vorticityProgram, 'uCurl'), curl.attach(1));
        gl.uniform1f(gl.getUniformLocation(vorticityProgram, 'curl'), config.CURL);
        gl.uniform1f(gl.getUniformLocation(vorticityProgram, 'dt'), dt);
        blit(velocity.write);
        velocity.swap();

        gl.viewport(0, 0, divergence.width, divergence.height);
        gl.useProgram(divergenceProgram);
        gl.uniform2f(gl.getUniformLocation(divergenceProgram, 'texelSize'), velocity.read.texelSizeX, velocity.read.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(divergenceProgram, 'uVelocity'), velocity.read.attach(0));
        blit(divergence);

        gl.useProgram(clearProgram);
        gl.uniform1i(gl.getUniformLocation(clearProgram, 'uTexture'), pressure.read.attach(0));
        gl.uniform1f(gl.getUniformLocation(clearProgram, 'value'), config.PRESSURE_DISSIPATION);
        blit(pressure.write);
        pressure.swap();

        gl.useProgram(pressureProgram);
        gl.uniform2f(gl.getUniformLocation(pressureProgram, 'texelSize'), velocity.read.texelSizeX, velocity.read.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(pressureProgram, 'uDivergence'), divergence.attach(0));
        for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
            gl.uniform1i(gl.getUniformLocation(pressureProgram, 'uPressure'), pressure.read.attach(1));
            blit(pressure.write);
            pressure.swap();
        }

        gl.viewport(0, 0, velocity.width, velocity.height);
        gl.useProgram(gradSubProgram);
        gl.uniform2f(gl.getUniformLocation(gradSubProgram, 'texelSize'), velocity.read.texelSizeX, velocity.read.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(gradSubProgram, 'uPressure'), pressure.read.attach(0));
        gl.uniform1i(gl.getUniformLocation(gradSubProgram, 'uVelocity'), velocity.read.attach(1));
        blit(velocity.write);
        velocity.swap();

        gl.viewport(0, 0, velocity.width, velocity.height);
        gl.useProgram(advectionProgram);
        gl.uniform2f(gl.getUniformLocation(advectionProgram, 'texelSize'), velocity.read.texelSizeX, velocity.read.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(advectionProgram, 'uVelocity'), velocity.read.attach(0));
        gl.uniform1i(gl.getUniformLocation(advectionProgram, 'uSource'), velocity.read.attach(0));
        gl.uniform1f(gl.getUniformLocation(advectionProgram, 'dt'), dt);
        gl.uniform1f(gl.getUniformLocation(advectionProgram, 'dissipation'), config.VELOCITY_DISSIPATION);
        blit(velocity.write);
        velocity.swap();

        gl.viewport(0, 0, dye.width, dye.height);
        gl.useProgram(advectionProgram);
        gl.uniform2f(gl.getUniformLocation(advectionProgram, 'texelSize'), velocity.read.texelSizeX, velocity.read.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(advectionProgram, 'uVelocity'), velocity.read.attach(0));
        gl.uniform1i(gl.getUniformLocation(advectionProgram, 'uSource'), dye.read.attach(1));
        gl.uniform1f(gl.getUniformLocation(advectionProgram, 'dt'), dt);
        gl.uniform1f(gl.getUniformLocation(advectionProgram, 'dissipation'), config.DENSITY_DISSIPATION);
        blit(dye.write);
        dye.swap();

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.useProgram(displayProgram);
        gl.uniform2f(gl.getUniformLocation(displayProgram, 'texelSize'), 1.0 / gl.drawingBufferWidth, 1.0 / gl.drawingBufferHeight);
        gl.uniform1i(gl.getUniformLocation(displayProgram, 'uTexture'), dye.read.attach(0));
        gl.uniform3f(gl.getUniformLocation(displayProgram, 'uBackColor'), config.BACK_COLOR.r, config.BACK_COLOR.g, config.BACK_COLOR.b);
        blit(null);
    }

    let lastTime = Date.now();
    let animId = null;
    let isPaused = false;

    function update() {
        const now = Date.now();
        let dt = (now - lastTime) / 1000;
        dt = Math.min(dt, 0.016666);
        lastTime = now;

        if (!isPaused) {
            if (splatStack.length > 0 && Math.random() < 0.25) {
                multipleSplats(splatStack.pop());
            }

            updateAutoCursor(dt);
            step(dt);
        }

        animId = requestAnimationFrame(update);
    }

    update();

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            isPaused = !entry.isIntersecting;
        });
    }, { threshold: 0.05 });
    observer.observe(container);

    return function destroy() {
        if (animId) cancelAnimationFrame(animId);
        observer.disconnect();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchstart', onTouchMove);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('resize', resizeCanvas);
        const loseCtx = gl.getExtension('WEBGL_lose_context');
        if (loseCtx) loseCtx.loseContext();
    };
}

/* Logos Slider Functionality */
function initLogosSlider() {
    // El slider funciona completamente con animación CSS
    // No requiere JavaScript para la funcionalidad principal
    // La animación está definida en style.css y pausan con hover
}
