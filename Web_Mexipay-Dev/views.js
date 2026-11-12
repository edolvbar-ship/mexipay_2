const views = {
  "/": `
        <!-- 01 Hero -->
        <section id="home" class="hero hero-home">
            <div class="hero-video-wrap" aria-hidden="true">
                <video class="hero-video" autoplay muted loop playsinline>
                    <source src="assets/vid1.mp4" type="video/mp4">
                </video>
                <div class="hero-video-overlay"></div>
            </div>
            <div class="container hero-container">
                <div class="hero-content hero-content-home">
                    <h1 class="hero-title reveal-line">Tecnología de pagos para hacer crecer tu operación.</h1>
                    <p class="hero-primary reveal-line">MexiPay integra adquirencia, procesamiento y operación en una sola infraestructura para aceptar y administrar pagos con mayor control.</p>
                    <div class="hero-actions reveal-fade">
                        <a href="#payment-flow" class="btn btn-primary">Conoce cómo funciona</a>
                    </div>
                </div>
            </div>
            <!-- Logos Slider -->
            <div class="logos-slider-section">
                <div class="logos-slider-wrapper">
                <div class="logos-slider">
                    <div class="logos-track">
                            <div class="logo-item">
                                <img src="assets/logos/logos/Escudo Porsche Blanco Transparente.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_47 a.m-1.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_49 a.m-3.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_49 a.m-4.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_50 a.m-5.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_51 a.m-6.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_52 a.m-7.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_53 a.m-8.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_43_22 a.m.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Logotipo CFE en blanco transparente.png" alt="Logo" class="logo-img">
                            </div>
                            <!-- Duplicado para efecto infinito -->
                            <div class="logo-item">
                                <img src="assets/logos/logos/Escudo Porsche Blanco Transparente.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_47 a.m-1.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_49 a.m-3.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_49 a.m-4.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_50 a.m-5.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_51 a.m-6.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_52 a.m-7.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_42_53 a.m-8.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Imagen de ChatGPT 7 oct 2026, 08_43_22 a.m.png" alt="Logo" class="logo-img">
                            </div>
                            <div class="logo-item">
                                <img src="assets/logos/logos/Logotipo CFE en blanco transparente.png" alt="Logo" class="logo-img">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 02 Key benefits -->
        <section class="benefits-strip scroll-reveal">
            <div class="container benefits-container">
                <div class="benefit-module hover-lift">
                    <i class="ph ph-credit-card"></i>
                    <span>Más formas de pago</span>
                </div>
                <div class="benefit-module hover-lift">
                    <i class="ph ph-chart-line-down"></i>
                    <span>Optimización de costos</span>
                </div>
                <div class="benefit-module hover-lift">
                    <i class="ph ph-shield-check"></i>
                    <span>Seguridad y control</span>
                </div>
                <div class="benefit-module hover-lift">
                    <i class="ph ph-plugs-connected"></i>
                    <span>Operación integrada</span>
                </div>
            </div>
        </section>

        <!-- 03 Payment Flow -->
        <section id="payment-flow" class="payment-flow-section section-spacing">
            <div class="container">
                <div class="section-header text-center">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>ECOSISTEMA DE PAGOS</div>
                    <h2 class="reveal-line">Así recorre una operación el ecosistema de pagos.</h2>
                </div>
                
                <div class="flow-container">
                    <div class="flow-track">
                        <div class="flow-progress"></div>
                    </div>
                    
                    <div class="flow-stages">
                        <div class="flow-stage" data-stage="1">
                            <div class="stage-number">01</div>
                            <h3>Inicio</h3>
                            <p>El pago comienza en TPV, web, app, API u otro canal.</p>
                        </div>
                        <div class="flow-stage" data-stage="2">
                            <div class="stage-number">02</div>
                            <h3>Gateway MexiPay</h3>
                            <p>La información se recibe y se enruta.</p>
                        </div>
                        <div class="flow-stage" data-stage="3">
                            <div class="stage-number">03</div>
                            <h3>Procesamiento</h3>
                            <p>La transacción viaja entre los participantes correspondientes.</p>
                        </div>
                        <div class="flow-stage" data-stage="4">
                            <div class="stage-number">04</div>
                            <h3>Autorización</h3>
                            <p>La operación es aprobada o rechazada.</p>
                        </div>
                        <div class="flow-stage" data-stage="5">
                            <div class="stage-number">05</div>
                            <h3>Respuesta</h3>
                            <p>La confirmación regresa al comercio.</p>
                        </div>
                        <div class="flow-stage" data-stage="6">
                            <div class="stage-number">06</div>
                            <h3>Conciliación y liquidación</h3>
                            <p>La operación financiera continúa después del cobro.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 04 Beyond Approval -->
        <section id="beyond-approval" class="beyond-section section-spacing bg-white scroll-reveal">
            <div class="container beyond-grid">
                <div class="beyond-text">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>MÁS ALLÁ DE LA TRANSACCIÓN</div>
                    <h2 class="reveal-line">El pago no termina cuando aparece “Aprobado”.</h2>
                    <p>Después de la autorización continúan procesos como conciliación, compensación, liquidación, reportes y seguimiento operativo. MexiPay ayuda a conectar y administrar esa operación.</p>
                </div>
                <div class="beyond-visual">
                    <div class="terminal-composition">
                        <img src="assets/terminales/terminales (1).png" alt="Terminal MexiPay" class="terminal-img">
                    </div>
                </div>
            </div>
        </section>

        <!-- 04b Acceptance Ecosystem -->
        <section class="acceptance-section section-spacing scroll-reveal">
            <div class="container">
                <div class="acceptance-header text-center">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>ECOSISTEMA DE ACEPTACIÓN</div>
                    <h2 class="reveal-line">Más formas de pagar. Una sola operación.</h2>
                    <p class="acceptance-desc">Integra diferentes marcas y experiencias de pago para adaptarte a la forma en que tus clientes prefieren comprar.</p>
                </div>

                <!-- Card Brands -->
                <div class="acceptance-block">
                    <p class="acceptance-sub-label">MARCAS DE TARJETA</p>
                    <div class="card-brands-row">
                        <div class="card-brand-item">
                            <img src="assets/metodos/visa-card-logo-9.png" alt="Visa" class="card-brand-img">
                        </div>
                        <div class="card-brand-item">
                            <img src="assets/metodos/Mastercard-Logo-Transparent-Images.png" alt="Mastercard" class="card-brand-img">
                        </div>
                        <div class="card-brand-item">
                            <img src="assets/metodos/purepng.com-american-express-logologobrand-logoiconslogos-251519940821gg0bn.png" alt="American Express" class="card-brand-img">
                        </div>
                        <div class="card-brand-item">
                            <img src="assets/metodos/Carnet.png" alt="Carnet" class="card-brand-img">
                        </div>
                        <div class="card-brand-item">
                            <img src="assets/metodos/si-vale-logo-png_seeklogo-264375.png" alt="Sí Vale" class="card-brand-img card-brand-img-sivale">
                        </div>
                        <div class="card-brand-item">
                            <img src="assets/metodos/Edenred.svg" onerror="this.onerror=null;this.src='assets/metodos/Edenred.svg.webp'" alt="Edenred" class="card-brand-img">
                        </div>
                        <div class="card-brand-item">
                            <img src="assets/metodos/whatsapp-logo-whatsapp-logo-transparent-whatsapp-icon-transparent-free-free-png.webp" alt="WhatsApp" class="card-brand-img">
                        </div>
                    </div>
                </div>

                <!-- Payment Methods -->
                <div class="acceptance-block">
                    <p class="acceptance-sub-label">FORMAS DE PAGO</p>
                    <div class="payment-methods-row">
                        <div class="payment-method-item hover-lift">
                            <div class="pm-icon-wrap">
                                <i class="ph ph-contactless-payment"></i>
                            </div>
                            <h3 class="pm-title">Contactless</h3>
                            <p class="pm-desc">Pagos rápidos y sin contacto mediante tecnología NFC.</p>
                        </div>
                        <div class="payment-method-item hover-lift">
                            <div class="pm-icon-wrap">
                                <i class="ph ph-device-mobile"></i>
                            </div>
                            <h3 class="pm-title">Wallets Digitales</h3>
                            <p class="pm-desc">Habilita experiencias de pago desde dispositivos y billeteras digitales compatibles.</p>
                        </div>
                        <div class="payment-method-item hover-lift">
                            <div class="pm-icon-wrap">
                                <i class="ph ph-qr-code"></i>
                            </div>
                            <h3 class="pm-title">Pagos con QR</h3>
                            <p class="pm-desc">Incorpora experiencias de cobro mediante códigos QR según el modelo y canal habilitado.</p>
                        </div>
                    </div>
                </div>

                <p class="acceptance-disclaimer">Disponibilidad de marcas, funcionalidades y modalidades sujeta a la solución, canal y habilitación correspondiente.</p>
            </div>
        </section>

        <!-- 05 Audiences -->
        <section id="audiences" class="audiences-section section-spacing">
            <div class="container">
                <div class="section-header text-center">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>PARA QUIÉN ES</div>
                    <h2 class="reveal-line">Tecnología de pagos adaptada a diferentes modelos de negocio.</h2>
                    <p class="subtitle">Infraestructura y operación para empresas que necesitan aceptar, procesar o administrar pagos sin desarrollar todo desde cero.</p>
                </div>

                <div class="cards-grid scroll-reveal">
                    <div class="mx-card">
                        <div class="card-tag">AGREGADORES Y REDES DE COMERCIOS</div>
                        <h3>Desarrolla y administra tu red de comercios.</h3>
                        <p>Desarrolla y administra una cartera de comercios con respaldo de infraestructura y procesamiento.</p>
                        <a href="#" class="card-link">Conoce la solución <i class="ph ph-arrow-right"></i></a>
                    </div>
                    
                    <div class="mx-card">
                        <div class="card-tag">EMPRESAS Y PLATAFORMAS</div>
                        <h3>Integra capacidades de pago a tu operación.</h3>
                        <p>Integra capacidades de pago a operaciones físicas, digitales u omnicanal.</p>
                        <a href="#" class="card-link">Conoce nuestras soluciones <i class="ph ph-arrow-right"></i></a>
                    </div>
                    
                    <div class="mx-card">
                        <div class="card-tag">COMERCIOS</div>
                        <h3>Acepta pagos con una solución adaptada a tu negocio.</h3>
                        <p>Acepta pagos y administra tu operación con soluciones adaptadas a tu modelo de negocio.</p>
                        <a href="#" class="card-link">Soluciones para comercios <i class="ph ph-arrow-right"></i></a>
                    </div>
                </div>
            </div>
        </section>

        <!-- 06 Solutions -->
        <section id="solutions" class="solutions-section section-spacing">
            <div class="container">
                <div class="section-header text-center">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>SOLUCIONES</div>
                    <h2 class="reveal-line">Todo lo que necesitas para operar pagos.</h2>
                    <p class="subtitle">Tecnología y operación especializadas para construir una solución adaptada a tu modelo de negocio.</p>
                </div>

                <div class="solutions-list scroll-reveal">
                    <a href="#" class="solution-row">
                        <span class="solution-num">01</span>
                        <h3 class="solution-title">Adquirencia y agregación</h3>
                        <div class="solution-arrow"><i class="ph ph-arrow-right"></i></div>
                    </a>
                    <div class="solution-divider"></div>
                    <a href="#" class="solution-row">
                        <span class="solution-num">02</span>
                        <h3 class="solution-title">Procesamiento</h3>
                        <div class="solution-arrow"><i class="ph ph-arrow-right"></i></div>
                    </a>
                    <div class="solution-divider"></div>
                    <a href="#" class="solution-row">
                        <span class="solution-num">03</span>
                        <h3 class="solution-title">Canales y aceptación</h3>
                        <div class="solution-arrow"><i class="ph ph-arrow-right"></i></div>
                    </a>
                    <div class="solution-divider"></div>
                    <a href="#" class="solution-row">
                        <span class="solution-num">04</span>
                        <h3 class="solution-title">Back Office y control</h3>
                        <div class="solution-arrow"><i class="ph ph-arrow-right"></i></div>
                    </a>
                    <div class="solution-divider"></div>
                </div>
            </div>
        </section>

        <!-- 07 Aggregators feature -->
        <section id="aggregators" class="aggregators-section section-spacing bg-surface-soft scroll-reveal">
            <div class="container">
                <div class="section-header text-center">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>AGREGADORES</div>
                    <h2 class="reveal-line">Desarrolla tu red de comercios con respaldo de infraestructura y procesamiento.</h2>
                </div>

                <div class="aggr-modules">
                    <div class="aggr-module">
                        <div class="aggr-num">01</div>
                        <h3>Desarrolla tu red</h3>
                        <p>Captación y desarrollo de una cartera de comercios.</p>
                    </div>
                    <div class="aggr-line"></div>
                    <div class="aggr-module">
                        <div class="aggr-num">02</div>
                        <h3>Incorpora y administra</h3>
                        <p>Onboarding, KYC, terminales y soporte según el esquema.</p>
                    </div>
                    <div class="aggr-line"></div>
                    <div class="aggr-module">
                        <div class="aggr-num">03</div>
                        <h3>Opera con respaldo</h3>
                        <p>MexiPay aporta infraestructura y procesamiento para respaldar la red.</p>
                    </div>
                </div>
                
                <div class="text-center mt-xl">
                    <a href="#" class="btn btn-primary">Conoce MexiPay para agregadores <i class="ph ph-arrow-right"></i></a>
                </div>
            </div>
        </section>

        <!-- 08 Platform -->
        <section id="platform" class="platform-section section-spacing">
            <div class="container platform-grid">
                <div class="platform-text">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>TECNOLOGÍA Y OPERACIÓN</div>
                    <h2 class="reveal-line">Control sobre tu operación.</h2>
                    <p>Centraliza información, reportes y procesos operativos para administrar tus pagos con mayor visibilidad.</p>
                    
                    <ul class="capability-list">
                        <li><i class="ph ph-check"></i> Procesamiento de transacciones</li>
                        <li><i class="ph ph-check"></i> Conciliación</li>
                        <li><i class="ph ph-check"></i> Liquidación</li>
                        <li><i class="ph ph-check"></i> Reportes</li>
                        <li><i class="ph ph-check"></i> Administración</li>
                        <li><i class="ph ph-check"></i> Seguimiento operativo</li>
                    </ul>
                </div>
                <div class="platform-visual scroll-scale">
                    <img src="assets/dashboard/home.png" alt="Panel de administración MexiPay" class="home-dashboard-image">
                </div>
            </div>
        </section>

        <!-- 09 Security -->
        <section id="security" class="security-section section-spacing bg-surface-soft scroll-reveal">
            <div class="container">
                <div class="section-header text-center">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>SEGURIDAD Y OPERACIÓN</div>
                    <h2 class="reveal-line">Seguridad integrada a la operación.</h2>
                    <p class="subtitle">Validación, autenticación, monitoreo y controles técnicos forman parte del ecosistema que protege la operación de pagos.</p>
                </div>

                <div class="security-grid">
                    <div class="security-module">
                        <div class="sec-icon"><i class="ph ph-identification-card"></i></div>
                        <h3>Evaluación y KYC</h3>
                    </div>
                    <div class="security-module">
                        <div class="sec-icon"><i class="ph ph-fingerprint"></i></div>
                        <h3>Autenticación</h3>
                    </div>
                    <div class="security-module">
                        <div class="sec-icon"><i class="ph ph-activity"></i></div>
                        <h3>Monitoreo y riesgo</h3>
                    </div>
                    <div class="security-module">
                        <div class="sec-icon"><i class="ph ph-shield-check"></i></div>
                        <h3>Cumplimiento técnico</h3>
                    </div>
                </div>
            </div>
        </section>

        <!-- 10 Final CTA -->
        <section id="contacto" class="final-cta-section section-spacing bg-white">
            <div class="container text-center">
                <h2 class="reveal-line">Hablemos de tu proyecto de pagos.</h2>
                <p class="cta-desc">Cuéntanos qué quieres construir y nuestro equipo analizará cómo MexiPay puede integrarse a tu operación.</p>
                <div class="cta-actions">
                    <button class="btn btn-primary cta-contact-trigger">Habla con un experto</button>
                    <a href="#" class="btn btn-dark-section cta-contact-trigger">Contacto <i class="ph ph-arrow-right"></i></a>
                </div>
            </div>
        </section>

    `,
  "/comercios/": `
        <!-- Hero -->
        <section class="hero comercios-hero">
            <div class="hero-canvas-container">
                <canvas id="liquid-canvas"></canvas>
            </div>
            <div class="container hero-container" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap;">
                <div class="hero-content">
                    <div class="eyebrow reveal-word"><span class="eyebrow-dot"></span>SOLUCIONES PARA COMERCIOS</div>
                    <h1 class="hero-title reveal-line">Acepta pagos con una infraestructura preparada para crecer contigo.</h1>
                    <p class="hero-primary reveal-line">MexiPay conecta tu negocio con tecnología de pagos diseñada para simplificar la aceptación, el procesamiento y la administración de tus transacciones.</p>
                    <p class="hero-secondary reveal-line">Desde el momento del cobro hasta los procesos posteriores, construimos una operación pensada para darte mayor claridad, seguridad y capacidad de crecimiento.</p>
                    <div class="hero-actions reveal-fade">
                        <a href="#como-funciona" class="btn btn-primary" data-link>Conoce cómo funciona</a>
                        <a href="/contacto/" class="btn btn-secondary" data-link>Habla con un experto &rarr;</a>
                    </div>
                </div>
                <div class="hero-visual" style="flex:1; min-width:300px;">
                    <!-- Terminal Placeholder -->
                </div>
            </div>
        </section>

        <!-- 02 MÁS SIMPLE -->
        <section id="como-funciona" class="section-spacing scroll-reveal bg-surface-soft">
            <div class="container text-center">
                <div class="section-header">
                    <h2 class="reveal-line">Una experiencia sencilla para tu cliente.<br>Una operación más clara para tu negocio.</h2>
                    <p class="subtitle" style="max-width:800px; margin:0 auto;">Aceptar un pago es solo una parte del proceso. MexiPay integra tecnología y operación para conectar el cobro con procesamiento, información y herramientas de seguimiento.</p>
                </div>
                <div class="mt-xl" style="display:flex; justify-content:center; gap:2rem; flex-wrap:wrap;">
                    <div class="diagram-node node-1" style="position:static; transform:none;">Terminal</div>
                    <div style="align-self:center;">&rarr;</div>
                    <div class="diagram-node center-node" style="position:static; transform:none;">Transacción</div>
                    <div style="align-self:center;">&rarr;</div>
                    <div class="diagram-node node-2" style="position:static; transform:none;">Procesamiento</div>
                    <div style="align-self:center;">&rarr;</div>
                    <div class="diagram-node node-3" style="position:static; transform:none;">Control</div>
                </div>
            </div>
        </section>

        <!-- 03 MAS FORMAS DE CONECTAR -->
        <section class="section-spacing scroll-reveal">
            <div class="container">
                <div class="section-header text-center">
                    <h2 class="reveal-line">El pago debe adaptarse a la forma en que opera tu negocio.</h2>
                </div>
                <div class="cards-grid">
                    <div class="mx-card">
                        <h3>PUNTO DE VENTA</h3>
                        <p>Integra pagos en operaciones presenciales mediante soluciones adaptadas al modelo de cada comercio.</p>
                    </div>
                    <div class="mx-card">
                        <h3>CANALES DIGITALES</h3>
                        <p>Conecta experiencias de pago digitales mediante tecnologías e integraciones disponibles según la solución.</p>
                    </div>
                    <div class="mx-card">
                        <h3>INTEGRACIÓN</h3>
                        <p>Conecta sistemas, canales e información para reducir fragmentación dentro de la operación.</p>
                    </div>
                    <div class="mx-card">
                        <h3>VISIBILIDAD</h3>
                        <p>Accede a información que facilite el seguimiento de transacciones y procesos operativos.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- 04 DEL COBRO AL CONTROL -->
        <section class="section-spacing bg-surface scroll-reveal">
            <div class="container beyond-grid">
                <div class="beyond-text">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>MÁS ALLÁ DE LA TRANSACCIÓN</div>
                    <h2 class="reveal-line">El pago continúa después de la autorización.</h2>
                    <p>Una operación de pagos requiere más que recibir una respuesta aprobada. Conciliación, liquidación, reportes y seguimiento forman parte de los procesos que permiten mantener orden y visibilidad.</p>
                </div>
                <div class="beyond-visual">
                    <div style="display:flex; flex-direction:column; gap:1rem; align-items:center;">
                        <div class="diagram-node" style="position:static;">Cobro</div>
                        <div class="diagram-node" style="position:static;">Procesamiento</div>
                        <div class="diagram-node" style="position:static;">Respuesta</div>
                        <div class="diagram-node" style="position:static;">Conciliación</div>
                        <div class="diagram-node" style="position:static;">Liquidación</div>
                        <div class="diagram-node" style="position:static; background:var(--mx-primary); color:#fff;">Control</div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 05 SEGURIDAD -->
        <section class="security-section section-spacing scroll-reveal bg-surface-soft">
            <div class="container">
                <div class="section-header text-center">
                    <h2 class="reveal-line">Confianza en cada etapa de la operación.</h2>
                    <p class="subtitle">La seguridad forma parte del diseño de una operación de pagos. MexiPay integra tecnología, validaciones y controles orientados a proteger la información y responder ante diferentes escenarios operativos.</p>
                </div>
                <div class="security-grid">
                    <div class="security-module">
                        <div class="sec-icon"><i class="ph ph-shield-check"></i></div>
                        <h3>Validación</h3>
                    </div>
                    <div class="security-module">
                        <div class="sec-icon"><i class="ph ph-fingerprint"></i></div>
                        <h3>Autenticación</h3>
                    </div>
                    <div class="security-module">
                        <div class="sec-icon"><i class="ph ph-activity"></i></div>
                        <h3>Monitoreo</h3>
                    </div>
                    <div class="security-module">
                        <div class="sec-icon"><i class="ph ph-warning"></i></div>
                        <h3>Gestión de riesgo</h3>
                    </div>
                </div>
            </div>
        </section>

        <!-- 06 ESCALABILIDAD -->
        <section class="final-cta-section section-spacing bg-white">
            <div class="container text-center">
                <h2 class="reveal-line">Una infraestructura que acompaña tu crecimiento.</h2>
                <p class="cta-desc">Tu operación puede cambiar con el tiempo. MexiPay está pensado para integrarse a diferentes modelos de negocio y acompañar el crecimiento sin obligarte a construir toda la infraestructura de pagos desde cero.</p>
                <div class="cta-actions">
                    <a href="/contacto/" class="btn btn-primary" data-link>Hablemos de tu operación &rarr;</a>
                </div>
            </div>
        </section>
`,
  "/agregador/": `
        <!-- 01 Hero -->
        <section class="hero agregador-hero bg-light">
            <div class="hero-canvas-container">
                <canvas id="liquid-canvas"></canvas>
            </div>
            <div class="container hero-container">
                <div class="hero-content">
                    <div class="eyebrow reveal-word"><span class="eyebrow-dot"></span>SOLUCIONES PARA AGREGADORES</div>
                    <h1 class="hero-title reveal-line">Tu red de comercios al frente. Nuestra infraestructura detrás.</h1>
                    <p class="hero-primary reveal-line">MexiPay aporta infraestructura tecnológica y procesamiento para respaldar a empresas que desarrollan y administran redes de comercios.</p>
                    <p class="hero-secondary reveal-line">Construye una operación preparada para incorporar comercios, procesar transacciones y mantener mayor control a medida que tu red crece.</p>
                    <div class="hero-actions reveal-fade">
                        <a href="#modelo" class="btn btn-primary" data-link>Conoce cómo funciona</a>
                        <a href="/contacto/" class="btn btn-secondary" data-link>Habla con un especialista &rarr;</a>
                    </div>
                </div>
                <div class="hero-visual agregador-hero-visual scroll-reveal">
                    <svg viewBox="0 0 400 400" class="hero-network-svg">
                        <circle cx="200" cy="200" r="140" fill="none" stroke="rgba(12,71,114,0.1)" stroke-width="1" />
                        <circle cx="200" cy="200" r="80" fill="none" stroke="rgba(12,71,114,0.2)" stroke-width="1" />
                        
                        <path class="network-pulse" d="M 200,60 L 200,120" stroke="var(--mx-primary)" stroke-width="2" />
                        <path class="network-pulse delay-1" d="M 60,200 L 120,200" stroke="var(--mx-primary)" stroke-width="2" />
                        <path class="network-pulse delay-2" d="M 340,200 L 280,200" stroke="var(--mx-primary)" stroke-width="2" />
                        
                        <circle cx="200" cy="60" r="10" fill="var(--mx-primary)" />
                        <circle cx="60" cy="200" r="10" fill="var(--mx-primary)" />
                        <circle cx="340" cy="200" r="10" fill="var(--mx-primary)" />
                        <circle cx="200" cy="340" r="10" fill="#6CB7AE" />

                        <text x="200" y="40" text-anchor="middle" font-size="12" fill="var(--dark)" font-weight="bold">COMERCIO</text>
                        <text x="40" y="220" text-anchor="middle" font-size="12" fill="var(--dark)" font-weight="bold">COMERCIO</text>
                        <text x="360" y="220" text-anchor="middle" font-size="12" fill="var(--dark)" font-weight="bold">COMERCIO</text>
                        
                        <rect x="150" y="160" width="100" height="40" rx="8" fill="#fff" stroke="var(--line)" />
                        <text x="200" y="185" text-anchor="middle" font-size="14" fill="var(--dark)" font-weight="bold">AGREGADOR</text>
                        
                        <rect x="150" y="220" width="100" height="40" rx="8" fill="var(--mx-primary)" />
                        <text x="200" y="245" text-anchor="middle" font-size="14" fill="#fff" font-weight="bold">MEXIPAY</text>
                        
                        <path d="M 200,260 L 200,320" stroke="rgba(12,71,114,0.3)" stroke-width="2" stroke-dasharray="4 4" />
                        <text x="200" y="365" text-anchor="middle" font-size="12" fill="var(--dark)" font-weight="bold">ECOSISTEMA DE PAGOS</text>
                    </svg>
                </div>
            </div>
        </section>

        <!-- 02 El Modelo -->
        <section id="modelo" class="section-spacing bg-white">
            <div class="container">
                <div class="section-header text-center mb-xl">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>EL MODELO</div>
                    <h2 class="reveal-line">Tú desarrollas la red.<br>MexiPay respalda la operación.</h2>
                </div>
                <div class="model-grid">
                    <div class="model-text">
                        <div class="model-steps">
                            <div class="model-step step-hover" data-target="dev-node">
                                <div class="step-num">01 &mdash; DESARROLLA</div>
                                <p>Captación y crecimiento de tu cartera de comercios.</p>
                            </div>
                            <div class="model-step step-hover" data-target="inc-node">
                                <div class="step-num">02 &mdash; INCORPORA</div>
                                <p>Según el esquema, onboarding, KYC, terminales y acompañamiento operativo.</p>
                            </div>
                            <div class="model-step step-hover" data-target="op-node">
                                <div class="step-num">03 &mdash; OPERA</div>
                                <p>MexiPay aporta infraestructura y procesamiento para respaldar la red.</p>
                            </div>
                        </div>
                    </div>
                    <div class="model-visual scroll-reveal">
                        <div class="interactive-diagram">
                            <div class="diagram-layer dev-layer" id="dev-node">Red de Comercios</div>
                            <div class="diagram-layer inc-layer" id="inc-node">Operación del Agregador</div>
                            <div class="diagram-layer op-layer" id="op-node">Infraestructura MexiPay</div>
                            <div class="diagram-layer base-layer">Ecosistema Financiero</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>


        <!-- 03 Scroll Storytelling - Crecer una red -->
        <section class="story-section bg-surface-soft">
            <div class="container">
                <div class="section-header text-center mb-xl">
                    <h2 class="reveal-line">Una infraestructura que acompaña el crecimiento de tu red.</h2>
                </div>
                <div class="story-layout">
                    <div class="story-text-col">
                        <div class="story-step" data-step="1">
                            <h3>ETAPA 01 &mdash; INCORPORACIÓN</h3>
                            <p>Un nuevo comercio entra a la red.</p>
                        </div>
                        <div class="story-step" data-step="2">
                            <h3>ETAPA 02 &mdash; CONFIGURACIÓN</h3>
                            <p>La operación se prepara según el modelo.</p>
                        </div>
                        <div class="story-step" data-step="3">
                            <h3>ETAPA 03 &mdash; ACEPTACIÓN</h3>
                            <p>Comienza la operación de pagos.</p>
                        </div>
                        <div class="story-step" data-step="4">
                            <h3>ETAPA 04 &mdash; PROCESAMIENTO</h3>
                            <p>MexiPay respalda el intercambio tecnológico.</p>
                        </div>
                        <div class="story-step" data-step="5">
                            <h3>ETAPA 05 &mdash; OPERACIÓN</h3>
                            <p>Conciliación, liquidación, reportes y seguimiento.</p>
                        </div>
                        <div class="story-step" data-step="6">
                            <h3>ETAPA 06 &mdash; ESCALA</h3>
                            <p>La red incorpora nuevos comercios sin reconstruir toda la infraestructura.</p>
                        </div>
                    </div>
                    <div class="story-visual-col">
                        <div class="story-visual-container sticky-visual">
                            <svg viewBox="0 0 400 400" class="story-svg">
                                <!-- Base Aggregator & MexiPay Nodes -->
                                <circle cx="200" cy="200" r="60" fill="var(--mx-primary)" class="story-base" />
                                <text x="200" y="205" fill="#fff" font-size="14" text-anchor="middle" font-weight="bold">MEXIPAY</text>
                                
                                <circle cx="200" cy="100" r="40" fill="#fff" stroke="var(--line)" class="story-base" />
                                <text x="200" y="105" fill="var(--dark)" font-size="12" text-anchor="middle">AGREGADOR</text>

                                <!-- Edges -->
                                <path d="M200,140 L200,170" stroke="rgba(12,71,114,.2)" stroke-width="2" />
                                
                                <!-- Dynamic Nodes added by JS -->
                                <g class="dynamic-nodes"></g>
                                
                                <!-- Dynamic Pulses added by JS -->
                                <g class="dynamic-pulses"></g>

                                <!-- Dashboard overlay -->
                                <rect x="50" y="280" width="300" height="100" rx="8" fill="rgba(255,255,255,0.9)" stroke="var(--line)" class="story-dashboard" opacity="0" />
                                <rect x="70" y="300" width="80" height="15" rx="4" fill="#e2e8f0" class="story-dashboard" opacity="0" />
                                <rect x="70" y="330" width="260" height="30" rx="4" fill="#f1f5f9" class="story-dashboard" opacity="0" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 04 Infraestructura (Terminal 2) -->
        <section class="section-spacing bg-white terminal-hero-section">
            <div class="container terminal-hero-grid">
                <div class="terminal-text-col">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>INFRAESTRUCTURA</div>
                    <h2 class="reveal-line">Una red de comercios necesita más que terminales.</h2>
                    <p class="subtitle">A medida que una cartera crece, también crecen las necesidades de procesamiento, operación, seguimiento y soporte.</p>
                    
                    <div class="terminal-callouts mt-xl">
                        <div class="t-callout c-hover">
                            <h3>PROCESAMIENTO</h3>
                            <p>Infraestructura que respalda el flujo de las transacciones.</p>
                        </div>
                        <div class="t-callout c-hover">
                            <h3>OPERACIÓN</h3>
                            <p>Procesos que continúan después de una autorización.</p>
                        </div>
                        <div class="t-callout c-hover">
                            <h3>CONTROL</h3>
                            <p>Información para dar seguimiento a movimientos y procesos.</p>
                        </div>
                        <div class="t-callout c-hover">
                            <h3>ACOMPAÑAMIENTO</h3>
                            <p>Equipos especializados detrás de la operación.</p>
                        </div>
                    </div>
                </div>
                <div class="terminal-visual-col scroll-reveal">
                    <div class="terminal-hero-wrapper">
                        <img src="assets/ELEMENTOS GRÁFICOS/terminal3.png" alt="Terminal MexiPay Funciones" class="terminal-hero-img terminal-floating">
                    </div>
                </div>
            </div>
        </section>

        <!-- 05 Accordion -->
        <section class="section-spacing bg-white">
            <div class="container">
                <div class="section-header text-center mb-xl">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>CRECER SIN MULTIPLICAR LA COMPLEJIDAD</div>
                    <h2 class="reveal-line">Infraestructura preparada para pasar de oportunidad a operación.</h2>
                </div>
                <div class="accordion-container">
                    <div class="acc-panel is-active">
                        <div class="acc-header">
                            <span class="acc-num">01</span>
                            <h3>TIME TO MARKET</h3>
                        </div>
                        <div class="acc-content">
                            <p>Reduce la complejidad tecnológica necesaria para poner en marcha una solución.</p>
                            <div class="acc-visual">
                                <div class="acc-visual-icon-box">
                                    <svg class="acc-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                                        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                                        <path d="M9 12H4s.55-3.03 2-4.5c1.62-1.63 5-2.5 5-2.5"/>
                                        <path d="M15 15v5s3.03-.55 4.5-2c1.63-1.62 2.5-5 2.5-5"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="acc-panel">
                        <div class="acc-header">
                            <span class="acc-num">02</span>
                            <h3>ESCALABILIDAD</h3>
                        </div>
                        <div class="acc-content">
                            <p>Una arquitectura preparada para acompañar el crecimiento de transacciones y comercios.</p>
                            <div class="acc-visual">
                                <div class="acc-visual-icon-box">
                                    <svg class="acc-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M3 3v18h18"/>
                                        <path d="m19 9-5 5-4-4-3 3"/>
                                        <polyline points="14 9 19 9 19 14"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="acc-panel">
                        <div class="acc-header">
                            <span class="acc-num">03</span>
                            <h3>BACK OFFICE Y CONTROL</h3>
                        </div>
                        <div class="acc-content">
                            <p>Procesos para dar seguimiento a conciliación, liquidación, reportes y operación.</p>
                            <div class="acc-visual">
                                <div class="acc-visual-icon-box">
                                    <svg class="acc-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="4" y1="21" x2="4" y2="14"/>
                                        <line x1="4" y1="10" x2="4" y2="3"/>
                                        <line x1="12" y1="21" x2="12" y2="12"/>
                                        <line x1="12" y1="8" x2="12" y2="3"/>
                                        <line x1="20" y1="21" x2="20" y2="16"/>
                                        <line x1="20" y1="12" x2="20" y2="3"/>
                                        <line x1="1" y1="14" x2="7" y2="14"/>
                                        <line x1="9" y1="8" x2="15" y2="8"/>
                                        <line x1="17" y1="16" x2="23" y2="16"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 06 Back Office -->
        <section class="platform-section section-spacing bg-surface-soft">
            <div class="container platform-grid">
                <div class="platform-text">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>OPERACIÓN</div>
                    <h2 class="reveal-line">El crecimiento también ocurre detrás de cada transacción.</h2>
                    <p>A medida que aumenta la operación, procesos como conciliación, liquidación, reportes, incidencias y seguimiento necesitan mayor orden y visibilidad.</p>
                    <ul class="capability-list">
                        <li><i class="ph ph-check"></i> Conciliación</li>
                        <li><i class="ph ph-check"></i> Liquidación</li>
                        <li><i class="ph ph-check"></i> Reportes</li>
                        <li><i class="ph ph-check"></i> Incidencias</li>
                        <li><i class="ph ph-check"></i> Seguimiento</li>
                    </ul>
                </div>
                <div class="platform-visual scroll-scale">
                    <img src="assets/dashboard/agregadores.png" alt="Panel de análisis y pronósticos para agregadores" class="aggregator-dashboard-image">
                </div>
            </div>
        </section>

        <!-- 07 Capacidades (Transparencia Operativa) -->
        <section class="section-spacing bg-white">
            <div class="container">
                <div class="section-header text-center mb-xl">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>TRANSPARENCIA OPERATIVA</div>
                    <h2 class="reveal-line">Más capacidades dentro de una misma operación.</h2>
                    <p class="subtitle" style="max-width: 800px; margin: 0 auto;">Además del procesamiento, MexiPay integra capacidades que ayudan a reducir fragmentación y facilitar la administración de una red.</p>
                </div>
                <div class="cards-grid capabilities-grid scroll-reveal">
                    <div class="mx-card">
                        <div class="sec-icon"><i class="ph ph-device-mobile"></i></div>
                        <h3>TERMINALES E INFRAESTRUCTURA</h3>
                        <p>Dispositivos y tecnología en punto de venta adaptados a las necesidades operativas de la red.</p>
                    </div>
                    <div class="mx-card">
                        <div class="sec-icon"><i class="ph ph-plugs-connected"></i></div>
                        <h3>INTEGRACIÓN</h3>
                        <p>Conecta sistemas y canales para reducir fragmentación dentro de tu operativa.</p>
                    </div>
                    <div class="mx-card">
                        <div class="sec-icon"><i class="ph ph-lock-key"></i></div>
                        <h3>SEGURIDAD Y DATOS</h3>
                        <p>Mecanismos de tokenización integrados para la protección transaccional.</p>
                    </div>
                    <div class="mx-card">
                        <div class="sec-icon"><i class="ph ph-headset"></i></div>
                        <h3>OPERACIÓN Y SOPORTE</h3>
                        <p>Acompañamiento especializado continuo y asistencia ante incidencias de tu red.</p>
                    </div>
                    <div class="mx-card">
                        <div class="sec-icon"><i class="ph ph-chart-bar"></i></div>
                        <h3>REPORTES Y CONTROL</h3>
                        <p>Herramientas y visibilidad para una conciliación eficiente.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- 08 Confianza -->
        <section class="aggregator-continuity scroll-reveal">
            <canvas class="aggregator-soffit-canvas" aria-hidden="true"></canvas>
            <div class="container text-center">
                <h2 class="reveal-line mb-xl">Infraestructura para una operación que no puede detenerse.</h2>
                <p class="subtitle" style="max-width: 700px; margin: 0 auto 4rem auto;">Los pagos requieren tecnología, procesos y equipos capaces de responder ante una operación crítica.</p>
                
                <div class="trust-grid">
                    <div class="trust-block">
                        <div class="trust-num">01</div>
                        <h3>TECNOLOGÍA</h3>
                        <p>Arquitectura e integración para sostener la operación.</p>
                    </div>
                    <div class="trust-block">
                        <div class="trust-num">02</div>
                        <h3>OPERACIÓN</h3>
                        <p>Procesos y seguimiento detrás de cada transacción.</p>
                    </div>
                    <div class="trust-block">
                        <div class="trust-num">03</div>
                        <h3>EQUIPO</h3>
                        <p>Acompañamiento especializado cuando la operación lo requiere.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- 09 CTA -->
        <section class="final-cta-section section-spacing bg-white">
            <div class="container text-center">
                <div class="eyebrow"><span class="eyebrow-dot"></span>HABLEMOS DE TU RED</div>
                <h2 class="reveal-line">La próxima etapa de tu red de comercios necesita infraestructura para crecer.</h2>
                <p class="cta-desc">Cuéntanos cómo opera tu modelo y nuestro equipo analizará cómo MexiPay puede respaldar su procesamiento y operación.</p>
                <div class="cta-actions mt-xl">
                    <a href="/contacto/" class="btn btn-primary" data-link>Habla con un especialista</a>
                    <a href="/procesamiento/" class="btn btn-dark-section" data-link>Conoce nuestro procesamiento &rarr;</a>
                </div>
            </div>
        </section>
`,
  "/procesamiento/": `
        <!-- PROCESAMIENTO PÁGINA -->
        
        <!-- 01 Hero Inmersivo WebGL Flowstate MexiPay -->
        <section id="procesamiento-hero" class="processing-hero">
            <canvas class="processing-fluid-canvas" aria-hidden="true"></canvas>
            <div class="processing-scrim" aria-hidden="true"></div>
            <div class="container processing-hero-container">
                <div class="processing-hero-content">
                    <div class="processing-eyebrow-pill">
                        <span class="eyebrow-dot"></span>PROCESAMIENTO Y OPERACIÓN
                    </div>
                    <h1 class="processing-title" id="processing-h1">
                        Haz crecer tu operación sin cargar con toda la complejidad.
                    </h1>
                    <p class="processing-copy-primary">
                        MexiPay combina tecnología, procesos y equipo especializado para administrar componentes críticos de la operación de pagos.
                    </p>
                    <p class="processing-copy-secondary">
                        Obtén procesamiento, visibilidad y acompañamiento dentro de un modelo diseñado para reducir la carga operativa de tu equipo.
                    </p>
                    <div class="processing-actions">
                        <a href="#tecnologia" class="btn btn-processing-primary">Conoce cómo funciona</a>
                        <a href="/contacto/" class="btn btn-processing-secondary" data-link>Habla con un experto &rarr;</a>
                    </div>
                </div>
            </div>
        </section>

        <!-- 02 Tecnología, Personas, Procesos -->",StartLine:5,TargetContent:
        <section id="tecnologia" class="section-spacing bg-white relative overflow-hidden">
            <!-- Background Curve -->
            <div class="proc-bg-corner-curve">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0,100 C50,100 100,50 100,0 L0,0 Z" fill="rgba(12,71,114,0.04)" />
                </svg>
            </div>
            
            <div class="container relative z-10">
                <div class="section-header text-center mb-xl">
                    <h2 class="reveal-line">Tecnología, personas y procesos trabajando como una sola operación.</h2>
                </div>
                
                <div class="proc-tri-container">
                    <div class="proc-tri-lines">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path class="tri-path" id="line-tp" d="M50,15 L15,85" stroke="rgba(12,71,114,0.1)" stroke-width="1" />
                            <path class="tri-path" id="line-pp" d="M15,85 L85,85" stroke="rgba(12,71,114,0.1)" stroke-width="1" />
                            <path class="tri-path" id="line-pt" d="M85,85 L50,15" stroke="rgba(12,71,114,0.1)" stroke-width="1" />
                        </svg>
                    </div>
                    <div class="proc-tri-nodes">
                        <div class="tri-node" data-node="tec">
                            <h3>TECNOLOGÍA</h3>
                            <p>Infraestructura para recibir, procesar y administrar información transaccional.</p>
                        </div>
                        <div class="tri-node" data-node="per">
                            <h3>PERSONAS</h3>
                            <p>Equipos especializados que acompañan la operación y resolución de incidencias.</p>
                        </div>
                        <div class="tri-node" data-node="pro">
                            <h3>PROCESOS</h3>
                            <p>Back office, conciliación, reportes y seguimiento para mantener continuidad y control.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 03 Sticky Timeline -->
        <section class="proc-story-section bg-surface-soft relative overflow-hidden">
            <!-- Abstract background SVG -->
            <div class="proc-abstract-bg">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0,30 Q30,60 100,20 L100,100 L0,100 Z" fill="rgba(12,71,114,0.07)" />
                    <path d="M0,50 Q40,80 100,40 L100,100 L0,100 Z" fill="rgba(76,168,226,0.1)" />
                </svg>
            </div>
            
            <div class="container relative z-10">
                <div class="story-layout">
                    <div class="story-text-col sticky-col">
                        <div class="eyebrow"><span class="eyebrow-dot"></span>MÁS ALLÁ DE LA RESPUESTA</div>
                        <h2 class="reveal-line">La operación continúa después de que una transacción obtiene respuesta.</h2>
                        <p class="reveal-line">MexiPay conecta procesos tecnológicos y operativos para transformar información transaccional en una operación más visible y administrable.</p>
                    </div>
                    <div class="story-visual-col scroll-timeline-col">
                        <div class="timeline-wrapper">
                            <div class="timeline-line"></div>
                            <div class="timeline-progress"></div>
                            
                            <div class="tl-step" data-step="1">
                                <div class="tl-dot"></div>
                                <div class="tl-content">
                                    <span class="tl-num">01</span>
                                    <h3>RECEPCIÓN</h3>
                                </div>
                            </div>
                            <div class="tl-step" data-step="2">
                                <div class="tl-dot"></div>
                                <div class="tl-content">
                                    <span class="tl-num">02</span>
                                    <h3>PROCESAMIENTO</h3>
                                </div>
                            </div>
                            <div class="tl-step" data-step="3">
                                <div class="tl-dot"></div>
                                <div class="tl-content">
                                    <span class="tl-num">03</span>
                                    <h3>RESPUESTA</h3>
                                </div>
                            </div>
                            <div class="tl-step" data-step="4">
                                <div class="tl-dot"></div>
                                <div class="tl-content">
                                    <span class="tl-num">04</span>
                                    <h3>CONCILIACIÓN</h3>
                                </div>
                            </div>
                            <div class="tl-step" data-step="5">
                                <div class="tl-dot"></div>
                                <div class="tl-content">
                                    <span class="tl-num">05</span>
                                    <h3>LIQUIDACIÓN</h3>
                                </div>
                            </div>
                            <div class="tl-step" data-step="6">
                                <div class="tl-dot"></div>
                                <div class="tl-content">
                                    <span class="tl-num">06</span>
                                    <h3>REPORTE</h3>
                                </div>
                            </div>
                            <div class="tl-step" data-step="7">
                                <div class="tl-dot"></div>
                                <div class="tl-content">
                                    <span class="tl-num">07</span>
                                    <h3>SEGUIMIENTO</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 04 Dashboard Visibilidad -->
        <section class="section-spacing bg-white relative overflow-hidden">
            <div class="container">
                <div class="proc-dash-grid">
                    <div class="proc-dash-text">
                        <div class="eyebrow"><span class="eyebrow-dot"></span>VISIBILIDAD</div>
                        <h2 class="reveal-line">Información para entender lo que ocurre en tu operación.</h2>
                        <p>Centraliza información operativa, identifica movimientos y utiliza reportes para dar seguimiento a los procesos que sostienen tus pagos.</p>
                    </div>
                    <div class="proc-dash-visual-wrapper">
                        <!-- Gran arco azul irregular de fondo -->
                        <div class="proc-dash-bg">
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path d="M10,100 C10,40 40,10 100,10 L100,100 Z" fill="var(--mx-primary)" />
                            </svg>
                        </div>
                        <div class="proc-dash-ui">
                            <img src="assets/dashboard/procesamiento.png" alt="Panel de acciones rápidas de MexiPay" class="proc-dashboard-image">
                            <!-- Callouts -->
                            <div class="dash-callout d-call-1">Procesamiento</div>
                            <div class="dash-callout d-call-2">Conciliación</div>
                            <div class="dash-callout d-call-3">Liquidación</div>
                            <div class="dash-callout d-call-4">Reportes</div>
                            <div class="dash-callout d-call-5">Administración</div>
                            <div class="dash-callout d-call-6">Seguimiento</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 05 Servicio Administrado -->
        <section class="section-spacing bg-surface-soft">
            <div class="container">
                <div class="section-header text-center mb-xl">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>SERVICIO ADMINISTRADO</div>
                    <h2 class="reveal-line">Un modelo para que tu equipo se concentre en lo que hace mejor.</h2>
                </div>
                
                <div class="admin-srv-layout">
                    <!-- Mobile Accordion / Desktop List -->
                    <div class="srv-list">
                        <div class="srv-item is-active" data-srv="1">
                            <h3>PROCESAMIENTO</h3>
                            <p>Gestiona el flujo tecnológico de las transacciones.</p>
                        </div>
                        <div class="srv-item" data-srv="2">
                            <h3>BACK OFFICE</h3>
                            <p>Apoya procesos posteriores a la transacción.</p>
                        </div>
                        <div class="srv-item" data-srv="3">
                            <h3>REPORTES</h3>
                            <p>Facilita el seguimiento de la operación.</p>
                        </div>
                        <div class="srv-item" data-srv="4">
                            <h3>SOPORTE</h3>
                            <p>Acompaña incidencias y necesidades operativas.</p>
                        </div>
                        <div class="srv-item" data-srv="5">
                            <h3>INTEGRACIÓN</h3>
                            <p>Conecta la solución con los componentes necesarios según el modelo.</p>
                        </div>
                        <div class="srv-item" data-srv="6">
                            <h3>CONTINUIDAD</h3>
                            <p>Combina tecnología y equipo especializado para sostener la operación.</p>
                        </div>
                    </div>
                    <!-- Desktop Visual -->
                    <div class="srv-visual-area">
                        <div class="srv-vis-content is-active" id="vis-1">
                            <img src="assets/procesamiento/procesamiento.png" alt="Procesamiento" class="srv-image">
                        </div>
                        <div class="srv-vis-content" id="vis-2">
                            <img src="assets/procesamiento/backoffice.png" alt="Back Office" class="srv-image">
                        </div>
                        <div class="srv-vis-content" id="vis-3">
                            <img src="assets/procesamiento/reportes.png" alt="Reportes" class="srv-image">
                        </div>
                        <div class="srv-vis-content" id="vis-4">
                            <img src="assets/procesamiento/soporte.png" alt="Soporte" class="srv-image">
                        </div>
                        <div class="srv-vis-content" id="vis-5">
                            <img src="assets/procesamiento/integracion.png" alt="Integración" class="srv-image">
                        </div>
                        <div class="srv-vis-content" id="vis-6">
                            <img src="assets/procesamiento/continuidad.png" alt="Continuidad" class="srv-image">
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 06 Reducción Complejidad -->
        <section class="section-spacing bg-white">
            <div class="container text-center mb-xl">
                <h2 class="reveal-line">Menos fragmentación. Más control sobre la operación.</h2>
            </div>
            <div class="container comp-grid">
                <div class="comp-col">
                    <h3>SIN UNA OPERACIÓN INTEGRADA</h3>
                    <div class="comp-visual before-comp">
                        <div class="c-node n1"></div><div class="c-node n2"></div><div class="c-node n3"></div>
                        <div class="c-node n4"></div><div class="c-node n5"></div>
                    </div>
                </div>
                <div class="comp-col">
                    <h3>CON MEXIPAY</h3>
                    <div class="comp-visual after-comp">
                        <svg viewBox="0 0 200 200" class="comp-svg">
                            <path class="c-path" d="M20,20 L100,100" stroke="var(--line)" stroke-width="2" />
                            <path class="c-path" d="M180,20 L100,100" stroke="var(--line)" stroke-width="2" />
                            <path class="c-path" d="M20,180 L100,100" stroke="var(--line)" stroke-width="2" />
                            <path class="c-path" d="M180,180 L100,100" stroke="var(--line)" stroke-width="2" />
                            
                            <circle cx="20" cy="20" r="10" fill="#cbd5e1" />
                            <circle cx="180" cy="20" r="10" fill="#cbd5e1" />
                            <circle cx="20" cy="180" r="10" fill="#cbd5e1" />
                            <circle cx="180" cy="180" r="10" fill="#cbd5e1" />
                            
                            <circle cx="100" cy="100" r="25" fill="var(--mx-primary)" class="c-center" />
                        </svg>
                    </div>
                </div>
            </div>
        </section>

        <!-- 07 CTA -->
        <section class="section-spacing bg-white relative overflow-hidden">
            <div class="proc-cta-bg">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon points="40,0 100,0 100,100 10,100" fill="var(--mx-primary)" />
                </svg>
            </div>
            <div class="container relative z-10 proc-cta-grid">
                <div class="proc-cta-text">
                    <h2 class="reveal-line">Menos complejidad operativa.<br>Más capacidad para enfocarte en crecer.</h2>
                    <p class="mt-md mb-xl" style="max-width: 600px;">Hablemos de cómo integrar MexiPay a tu modelo de procesamiento.</p>
                    <a href="/contacto/" class="btn btn-primary" data-link>Habla con un experto</a>
                </div>
            </div>
        </section>
`,
  "/nosotros/": `
        <!-- NOSOTROS PÁGINA -->
        
        <!-- 01 Hero -->
        <section class="hero nos-hero bg-white relative overflow-hidden">
            <!-- Forma azul de fondo editorial -->
            <div class="nos-hero-bg">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M50,0 Q30,50 100,100 L100,0 Z" fill="var(--mx-primary)" />
                    <path d="M60,0 Q40,60 100,100 L100,0 Z" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.5" />
                    <path d="M70,0 Q50,70 100,100 L100,0 Z" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.5" />
                </svg>
            </div>
            
            <div class="container hero-container relative z-10">
                <div class="hero-content" style="max-width: 700px;">
                    <div class="eyebrow reveal-word"><span class="eyebrow-dot"></span>MEXIPAY</div>
                    <h1 class="hero-title reveal-line">Tecnología de pagos con experiencia detrás.</h1>
                    <p class="hero-primary reveal-line">Somos una empresa mexicana especializada en tecnología de pagos, enfocada en construir infraestructura que conecte negocios y participantes del ecosistema financiero.</p>
                    <p class="hero-secondary reveal-line">Nuestro equipo reúne experiencia en la industria para desarrollar soluciones ágiles, confiables y preparadas para diferentes modelos de operación.</p>
                </div>
            </div>
        </section>

        <!-- 02 Trayectoria -->
        <section class="section-spacing bg-surface-soft relative overflow-hidden nos-timeline-section">
            <div class="container text-center mb-xl">
                <div class="eyebrow"><span class="eyebrow-dot"></span>NUESTRA HISTORIA</div>
                <h2 class="reveal-line">Experiencia construida alrededor de la evolución de los pagos.</h2>
                <p class="mt-md" style="max-width: 600px; margin: 0 auto;">Más de 20 años de experiencia.</p>
            </div>
            
            <div class="container">
                <div class="nos-timeline">
                    <!-- Linea vertical -->
                    <div class="nos-tl-line"></div>
                    
                    <div class="nos-tl-item" data-tl="1">
                        <div class="nos-tl-dot"></div>
                        <div class="nos-tl-content">
                            <h3>EXPERIENCIA</h3>
                        </div>
                    </div>
                    <div class="nos-tl-item" data-tl="2">
                        <div class="nos-tl-dot"></div>
                        <div class="nos-tl-content">
                            <h3>TECNOLOGÍA</h3>
                        </div>
                    </div>
                    <div class="nos-tl-item" data-tl="3">
                        <div class="nos-tl-dot"></div>
                        <div class="nos-tl-content">
                            <h3>INFRAESTRUCTURA</h3>
                        </div>
                    </div>
                    <div class="nos-tl-item" data-tl="4">
                        <div class="nos-tl-dot"></div>
                        <div class="nos-tl-content">
                            <h3>NUEVAS FORMAS DE PAGO</h3>
                        </div>
                    </div>
                    <div class="nos-tl-item" data-tl="5">
                        <div class="nos-tl-dot"></div>
                        <div class="nos-tl-content">
                            <h3>FUTURO</h3>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 03 Misión y Visión -->
        <section class="section-spacing bg-white relative overflow-hidden nos-mv-section">
            <div class="container relative z-10">
                <div class="mv-grid">
                    <div class="mv-mision scroll-reveal-left">
                        <div class="eyebrow"><span class="eyebrow-dot"></span>NUESTRO PROPÓSITO</div>
                        <h2>MISIÓN</h2>
                        <p>Impulsar la inclusión financiera en México mediante soluciones tecnológicas de pago seguras, eficientes y accesibles para empresas y usuarios.</p>
                    </div>
                    
                    <div class="mv-divider">
                        <!-- Onda Azul animada muy lento -->
                        <svg viewBox="0 0 100 20" preserveAspectRatio="none" class="mv-wave-svg">
                            <path class="mv-wave-path" d="M0,10 Q25,20 50,10 T100,10" fill="none" stroke="rgba(12,71,114,0.15)" stroke-width="2" />
                        </svg>
                    </div>
                    
                    <div class="mv-vision scroll-reveal-right">
                        <h2>VISIÓN</h2>
                        <p>Ser un referente en tecnología de pagos en México y Latinoamérica, conectando negocios y entidades financieras mediante soluciones innovadoras, escalables y preparadas para el futuro.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- 04 Valores -->
        <section class="section-spacing bg-surface-soft">
            <div class="container text-center mb-xl">
                <h2 class="reveal-line">Principios que guían cada relación y cada solución.</h2>
            </div>
            <div class="container">
                <div class="nos-valores-grid">
                    <div class="nos-valor-card">
                        <div class="val-num">01<div class="val-bg-shape"></div></div>
                        <h3 class="val-title">INTEGRIDAD</h3>
                        <p>Trabajamos con responsabilidad y altos estándares éticos en nuestras relaciones y operaciones.</p>
                    </div>
                    <div class="nos-valor-card">
                        <div class="val-num">02<div class="val-bg-shape"></div></div>
                        <h3 class="val-title">EXCELENCIA</h3>
                        <p>Buscamos elevar constantemente la calidad de nuestro trabajo y nuestras soluciones.</p>
                    </div>
                    <div class="nos-valor-card">
                        <div class="val-num">03<div class="val-bg-shape"></div></div>
                        <h3 class="val-title">INNOVACIÓN</h3>
                        <p>Mejoramos tecnología y procesos para responder a un ecosistema en constante evolución.</p>
                    </div>
                    <div class="nos-valor-card">
                        <div class="val-num">04<div class="val-bg-shape"></div></div>
                        <h3 class="val-title">PASIÓN POR EL CLIENTE</h3>
                        <p>Partimos de las necesidades reales de cada operación para construir soluciones con sentido de negocio.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- 05 Tecnología + Experiencia -->
        <section class="section-spacing bg-white relative overflow-hidden">
            <div class="nos-tecexp-bg">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0,0 Q50,50 0,100 Z" fill="rgba(12,71,114,0.04)" />
                </svg>
            </div>
            
            <div class="container relative z-10 nos-tecexp-grid">
                <div class="tecexp-text">
                    <div class="eyebrow"><span class="eyebrow-dot"></span>NUESTRA FORMA DE TRABAJAR</div>
                    <h2 class="reveal-line">La infraestructura importa.<br>Las personas detrás de ella también.</h2>
                    <p class="mt-md">Los pagos son una operación crítica. Por eso combinamos conocimiento de la industria, tecnología y acompañamiento especializado para construir relaciones de largo plazo con nuestros clientes.</p>
                </div>
                <div class="tecexp-visual scroll-reveal">
                    <img src="assets/dashboard/nosotros.png" alt="Equipo colaborando en una infraestructura de pagos" class="nos-tecexp-image">
                </div>
            </div>
        </section>

        <!-- 06 Qué nos define -->
        <section class="nos-define-section bg-surface-soft">
            <div class="container text-center">
                <div class="define-word-block" data-define="1">
                    <h2 class="define-word">EXPERIENCIA</h2>
                    <p class="define-desc">Conocimiento del ecosistema de pagos aplicado a necesidades reales.</p>
                </div>
                <div class="define-word-block" data-define="2">
                    <h2 class="define-word">CLARIDAD</h2>
                    <p class="define-desc">Tecnología compleja explicada y operada de forma entendible.</p>
                </div>
                <div class="define-word-block" data-define="3">
                    <h2 class="define-word">EVOLUCIÓN</h2>
                    <p class="define-desc">Infraestructura preparada para acompañar cambios en la forma de pagar.</p>
                </div>
            </div>
        </section>

        <!-- 07 CTA Nosotros -->
        <section class="section-spacing bg-white relative overflow-hidden nos-cta-section">
            <!-- Formas azules grandes desde esquinas -->
            <div class="nos-cta-bg shape-bl">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0,0 L0,100 L100,100 Z" fill="var(--mx-primary)" />
                </svg>
            </div>
            <div class="nos-cta-bg shape-tr">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0,0 L100,0 L100,100 Z" fill="var(--mx-primary)" />
                </svg>
            </div>
            
            <div class="container text-center relative z-10">
                <h2 class="reveal-line" style="max-width: 600px; margin: 0 auto; margin-bottom: 2rem;">Conoce cómo nuestra tecnología puede integrarse a tu operación.</h2>
                <a href="/contacto/" class="btn btn-primary" data-link>Habla con nosotros &rarr;</a>
            </div>
        </section>
`,
  "/contacto/": `
        <!-- Hero -->
        <section class="hero contacto-hero">
            <div class="hero-canvas-container">
                <canvas id="liquid-canvas"></canvas>
            </div>
            <div class="container hero-container text-center">
                <div class="hero-content" style="max-width:800px; margin:0 auto;">
                    <div class="eyebrow reveal-word"><span class="eyebrow-dot"></span>HABLEMOS</div>
                    <h1 class="hero-title reveal-line">Cuéntanos qué quieres resolver en tu operación de pagos.</h1>
                    <p class="hero-primary reveal-line">Ya sea que quieras aceptar pagos, desarrollar una red de comercios o mejorar tu operación de procesamiento, nuestro equipo puede ayudarte a identificar la solución adecuada.</p>
                </div>
            </div>
        </section>

        <!-- 02 FORMULARIO Y RUTAS -->
        <section class="section-spacing scroll-reveal" style="padding-top:0;">
            <div class="container platform-grid" style="grid-template-columns: 1fr 1.5fr; gap: 4rem;">
                <div class="contact-sidebar">
                    <h2 style="font-size: 1.5rem; margin-bottom: 2rem;">¿Qué necesitas?</h2>
                    <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom:4rem;">
                        <button class="mx-card hover-lift btn-route" data-route="agregacion" style="text-align:left; padding:1.5rem; background:#fff; border:1px solid var(--line); cursor:pointer; width:100%;">
                            <h3 style="font-size:1.125rem;">AGREGADORES</h3>
                            <p style="margin:0; font-size:0.875rem;">Quiero desarrollar o fortalecer una red de comercios.</p>
                        </button>
                        <button class="mx-card hover-lift btn-route" data-route="procesamiento" style="text-align:left; padding:1.5rem; background:#fff; border:1px solid var(--line); cursor:pointer; width:100%;">
                            <h3 style="font-size:1.125rem;">PROCESAMIENTO</h3>
                            <p style="margin:0; font-size:0.875rem;">Quiero optimizar la operación detrás de mis pagos.</p>
                        </button>
                        <button class="mx-card hover-lift btn-route" data-route="comercios" style="text-align:left; padding:1.5rem; background:#fff; border:1px solid var(--line); cursor:pointer; width:100%;">
                            <h3 style="font-size:1.125rem;">COMERCIOS</h3>
                            <p style="margin:0; font-size:0.875rem;">Quiero aceptar y administrar pagos en mi negocio.</p>
                        </button>
                    </div>

                    <div class="mx-card bg-surface-soft" style="padding:1.5rem;">
                        <h3 style="font-size:1.125rem;">¿Qué ocurre después?</h3>
                        <ol style="padding-left:1.5rem; color:var(--muted); font-size:0.875rem; margin-top:1rem; display:flex; flex-direction:column; gap:0.5rem;">
                            <li>Recibimos tu información.</li>
                            <li>Nuestro equipo revisa las necesidades de tu operación.</li>
                            <li>Un especialista puede ponerse en contacto para profundizar en el proyecto.</li>
                        </ol>
                    </div>
                </div>

                <div class="contact-form-container mx-card" style="padding: 3rem;">
                    <form class="contact-form" id="page-contact-form">
                        <div class="form-group">
                            <label for="name">Nombre completo *</label>
                            <input type="text" id="name" name="name" required>
                        </div>
                        <div class="form-group">
                            <label for="company">Empresa *</label>
                            <input type="text" id="company" name="company" required>
                        </div>
                        <div class="form-group">
                            <label for="email">Correo corporativo *</label>
                            <input type="email" id="email" name="email" required>
                        </div>
                        <div class="form-group">
                            <label for="phone">Teléfono *</label>
                            <input type="tel" id="phone" name="phone" required>
                        </div>
                        <div class="form-group">
                            <label for="interest">¿En qué podemos ayudarte? *</label>
                            <select id="interest" name="interest" required>
                                <option value="" disabled selected>Selecciona una opción</option>
                                <option value="agregacion">Agregación</option>
                                <option value="procesamiento">Procesamiento</option>
                                <option value="comercios">Comercios</option>
                                <option value="integraciones">Integraciones</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="message">Mensaje *</label>
                            <textarea id="message" name="message" rows="4" required></textarea>
                        </div>
                        <div class="form-group" style="flex-direction:row; align-items:flex-start; gap:0.5rem;">
                            <input type="checkbox" id="consent" required style="margin-top:0.25rem;">
                            <label for="consent" style="font-weight:400; font-size:0.875rem;">Acepto el aviso de privacidad y autorizo el uso de mis datos para ser contactado.</label>
                        </div>
                        <button type="submit" class="btn btn-primary btn-submit" style="margin-top:1rem;" disabled>
                            <span>Enviar solicitud</span>
                            <div class="dev-warning">Endpoint pendiente de integración</div>
                        </button>
                    </form>
                </div>
            </div>
        </section>

        <!-- 03 TALENTO -->
        <section class="section-spacing scroll-reveal bg-white">
            <div class="container text-center">
                <h2 class="reveal-line">¿Quieres construir tecnología de pagos con nosotros?</h2>
                <p class="cta-desc">Si tienes experiencia desarrollando soluciones tecnológicas y quieres formar parte del ecosistema MexiPay, queremos conocerte.</p>
                <div class="cta-actions">
                    <a href="mailto:talento@mexipay.mx" class="btn btn-secondary">talento@mexipay.mx</a>
                </div>
            </div>
        </section>
`
};
