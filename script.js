// --- GLOBAL UTILITIES (Always available to HTML onclick) ---
window.switchAdminTab = function(tabName, btnEl) {
    const adminTabContents = document.querySelectorAll('.admin-tab-content');
    const adminTabBtns = document.querySelectorAll('.admin-tab-btn');

    adminTabContents.forEach(content => content.classList.add('hidden'));
    adminTabBtns.forEach(btn => btn.classList.remove('active'));

    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.classList.remove('hidden');
        if (btnEl) btnEl.classList.add('active');
        window.renderAdminTabContent(tabName);
    }
};

window.renderAdminTabContent = function(tabName) {
    switch (tabName) {
        case 'admin-dashboard': if (typeof renderAdminDashboard === 'function') renderAdminDashboard(); break;
        case 'admin-users': if (typeof renderAdminUsers === 'function') renderAdminUsers(); break;
        case 'admin-jobs': if (typeof renderAdminJobs === 'function') renderAdminJobs(); break;
        case 'admin-pending': if (typeof renderAdminPending === 'function') renderAdminPending(); break;
        case 'admin-edit-mcqs': if (typeof renderAdminEditCategorySelect === 'function') renderAdminEditCategorySelect(); break;
        case 'admin-export': if (typeof renderAdminExportCategorySelect === 'function') renderAdminExportCategorySelect(); break;
    }
};

window.togglePasswordVisibility = function(inputId, icon) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    }
};

// --- NATIVE CAPACITOR PLUGINS (Safe initialization) ---
const { Share, Filesystem, TextToSpeech } = window.Capacitor ? window.Capacitor.Plugins : {};
const Directory = window.Capacitor ? (window.Capacitor.Plugins.Filesystem ? { Cache: 'CACHE' } : {}) : {};
const Encoding = { UTF8: 'utf8' };

document.addEventListener('DOMContentLoaded', () => {

// --- LAZY LOADING SYSTEM ---
window.loadedSubjects = {};

async function ensureSubjectLoaded(slug) {
    const varName = `QuizData_${slug.replace(/-/g, '_')}`;
    if (window[varName]) {
        return window[varName];
    }
    
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');

    try {
        if (window.DBStore) {
            const cachedData = await window.DBStore.getSubject(slug);
            if (cachedData) {
                window[varName] = cachedData;
                window.loadedSubjects[slug] = cachedData;
                preCleanAllData([cachedData]); // Clean names just in case
                if (loadingOverlay) loadingOverlay.classList.add('hidden');
                return cachedData;
            }
        }

        const scriptPath = `data/${slug}.js`;
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptPath;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });

        if (window[varName]) {
            preCleanAllData([window[varName]]);
            if (window.DBStore) {
                await window.DBStore.saveSubject(slug, window[varName]);
            }
            window.loadedSubjects[slug] = window[varName];
            return window[varName];
        } else {
            throw new Error("Subject data not found in chunk.");
        }
    } catch (error) {
        console.error("Failed to load subject:", error);
        alert("Failed to load subject data. Please check your internet connection.");
        return null;
    } finally {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
}

    // DOM Elements
    const screens = {
        categories: document.getElementById('category-screen'),
        set: document.getElementById('set-screen'),
        quiz: document.getElementById('quiz-screen'),
        result: document.getElementById('result-screen'),
        'about-screen': document.getElementById('about-screen'),
        'contact-screen': document.getElementById('contact-screen'),
        'privacy-screen': document.getElementById('privacy-screen')
    };

    const categoriesGrid = document.getElementById('categories-grid');
    const setsGrid = document.getElementById('sets-grid');
    const setCategoryTitle = document.getElementById('set-category-title');
    const sectionTitle = document.getElementById('main-section-title');
    const homeLogo = document.getElementById('home-logo');
    const backToHomeFromSetsBtn = document.getElementById('back-to-home-from-sets');
    const backToPrevCategoryBtn = document.getElementById('back-to-prev-category');
    console.log('Back button element found:', backToPrevCategoryBtn);

    const introScreen = document.getElementById('intro-screen');
    const startQuizBtn = document.getElementById('start-quiz-btn');

    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const submitBtn = document.getElementById('submit-btn');
    const nextBtn = document.getElementById('next-btn');
    const feedbackContainer = document.getElementById('feedback-container');
    const explanationText = document.getElementById('explanation-text');

    // Header elements
    const currentCategoryTitle = document.getElementById('current-category-title');
    const questionProgressText = document.getElementById('question-progress-text');
    const progressFill = document.getElementById('progress-fill');
    const backBtn = document.getElementById('back-to-categories');

    // Result elements
    const finalScoreEl = document.getElementById('final-score');
    const totalQuestionsEl = document.getElementById('total-questions');
    const retryBtn = document.getElementById('retry-btn');
    const homeBtn = document.getElementById('home-btn');
    const nextSetBtn = document.getElementById('next-set-btn');
    const resultMessage = document.getElementById('result-message');

    // State
    let currentMainCategory = null;
    let currentSubcategoryData = null;
    let allCategoryQuestions = [];
    let currentSetQuestions = [];
    let currentSetIndex = 0;
    let totalSets = 0;

    let currentQuestionIndex = 0;
    let score = 0;
    let selectedOptionIndex = null;
    let hasAnswered = false;

    // Advanced Features State
    let isDarkMode = localStorage.getItem('theme') === 'dark';
    let isSoundEnabled = true;
    let timerInterval;
    let isNativeSpeaking = false; // Flag for Native TTS control 🛠️✨🏁🛠️🚀
    const timePerQuestion = 60;
    let timeLeft = timePerQuestion;
    
    // Auth State
    let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    let userRole = localStorage.getItem('userRole') || 'user';

    // --- Dynamic SEO & URL Handling ---
    function updateMetaTags(title, parentCategory, isQuizView) {
        const baseTitle = "McqMatrix | Competitive Exam Preparation";
        const newTitle = `${title} MCQs | ${baseTitle}`;
        const newDesc = `Prepare for ${title} under ${parentCategory}. Master top-quality MCQs online for free on McqMatrix.`;

        const newUrl = window.location.href;

        // Update Document Title
        document.title = isQuizView ? newTitle : baseTitle;

        // Update Standard Meta
        const metaTitle = document.getElementById('seo-meta-title');
        const metaDesc = document.getElementById('seo-description');
        if (metaTitle) metaTitle.content = newTitle;
        if (metaDesc) metaDesc.content = newDesc;

        // Update Open Graph (OG)
        const ogTitle = document.getElementById('og-title');
        const ogDesc = document.getElementById('og-description');
        const ogUrl = document.getElementById('og-url');
        if (ogTitle) ogTitle.content = newTitle;
        if (ogDesc) ogDesc.content = newDesc;
        if (ogUrl) ogUrl.content = newUrl;

        // Update Twitter Cards
        const twTitle = document.getElementById('twitter-title');
        const twDesc = document.getElementById('twitter-description');
        const twUrl = document.getElementById('twitter-url');
        if (twTitle) twTitle.content = newTitle;
        if (twDesc) twDesc.content = newDesc;
        if (twUrl) twUrl.content = newUrl;

        // Hashing logic is handled exclusively by switchScreen to prevent conflicts
    }

    // Call deep link check on load removed as handleInitialRoute handles initialization now

    let isExamMode = false;
    let examTimeLeft = 0;
    let examTimerInterval = null;
    let totalExamQuestions = 0;
    let examSelectedSubjects = [];
    let currentFolderData = null;

    // Analytics state
    let quizStartTime = 0;
    let weakTopicsSession = {}; // Tracks mistakes by specific subject/category in this session
    let chartInstance = null;

    // Audio Elements
    const soundCorrect = document.getElementById('sound-correct');
    const soundIncorrect = document.getElementById('sound-incorrect');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const soundToggleBtn = document.getElementById('sound-toggle');
    const timerBar = document.getElementById('timer-bar');
    const timeLeftText = document.getElementById('time-left');

    const translateBtn = document.getElementById('translate-btn');
    const bookmarkBtn = document.getElementById('bookmark-btn');
    const dashboardModal = document.getElementById('dashboard-modal');
    const dashboardToggle = document.getElementById('dashboard-toggle');
    const closeDashboardBtn = document.getElementById('close-dashboard');
    const resetStatsBtn = document.getElementById('reset-stats');

    // Exam Modal Elements
    const examModal = document.getElementById('exam-modal');
    const navExam = document.getElementById('nav-exam');
    const closeExamModalBtn = document.getElementById('close-exam-modal');
    const startExamBtn = document.getElementById('start-exam-btn');
    const examSubjectList = document.getElementById('exam-subject-list');
    const examDurationText = document.getElementById('exam-duration-text');
    const examCountRadios = document.getElementsByName('exam-count');

    function updateNavActiveState(activeId) {
        // Desktop Nav
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const activeEl = document.getElementById(activeId);
        if (activeEl) activeEl.classList.add('active');

        // Mobile Bottom Nav Sync
        const bottomNavMap = {
            'nav-home': 'bottom-nav-home',
            'nav-daily': 'bottom-nav-daily',
            'nav-exam': 'bottom-nav-exam',
            'nav-mock': 'bottom-nav-exam', // Map mock to exam icon
            'nav-bookmarks': 'bottom-nav-home',
            'auth-btn': 'bottom-nav-profile'
        };

        document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
        const mobileActiveId = bottomNavMap[activeId];
        if (mobileActiveId) {
            const mobileActiveEl = document.getElementById(mobileActiveId);
            if (mobileActiveEl) mobileActiveEl.classList.add('active');
        }
    }

    // Initialize Application
    function init() {
        if (isDarkMode) {
            document.body.setAttribute('data-theme', 'dark');
            themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
        updateAuthUI();
        
        // Performance: Pre-clean all subject and category names once during init
        // preCleanAllData is now handled during subject lazy loading.

        renderCategories();
        bindEvents();
    }

    function updateAuthUI() {
        const authBtn = document.getElementById('auth-btn');
        const navItemAdmin = document.getElementById('nav-item-admin');
        
        if (!authBtn) return;
        
        // Ensure the label exists inside authBtn
        let authBtnLabel = authBtn.querySelector('.btn-label');
        let authBtnIcon = authBtn.querySelector('i');
        
        if (!authBtnLabel || !authBtnIcon) return;
        
        if (isLoggedIn) {
            authBtnLabel.textContent = "Logout";
            authBtn.title = "Logout";
            authBtn.ariaLabel = "Logout";
            authBtnIcon.className = "fa-solid fa-user-check";
            authBtn.classList.remove('auth-btn-unlogged');
            authBtn.classList.add('auth-btn-logged');
            if (navItemAdmin) {
                if (userRole === 'admin') {
                    navItemAdmin.classList.remove('hidden');
                } else {
                    navItemAdmin.classList.add('hidden');
                }
            }
            // Fetch jobs globally to allow admin edits to sync instantly
            if (typeof fetchAndRenderJobs === 'function') fetchAndRenderJobs();
        } else {
            authBtnLabel.textContent = "Login";
            authBtn.title = "Login with Google";
            authBtn.ariaLabel = "Login with Google";
            authBtnIcon.className = "fa-brands fa-google";
            authBtn.classList.remove('auth-btn-logged');
            authBtn.classList.add('auth-btn-unlogged');
            if (navItemAdmin) navItemAdmin.classList.add('hidden');
        }
    }

    function bindEvents() {
        submitBtn.addEventListener('click', checkAnswer);
        nextBtn.addEventListener('click', nextQuestion);
        backBtn.addEventListener('click', handleBackButtonClick);
        homeBtn.addEventListener('click', showMainCategories);
        homeLogo.addEventListener('click', showMainCategories);
        backToHomeFromSetsBtn.addEventListener('click', handleSetsBackButtonClick);
        if (backToPrevCategoryBtn) backToPrevCategoryBtn.addEventListener('click', handleCategoryBackButtonClick);
        retryBtn.addEventListener('click', () => startSet(currentSetIndex));

        // Back to Home listener for static screens (About, Contact, Privacy)
        document.querySelectorAll('.back-to-home-btn').forEach(btn => {
            btn.addEventListener('click', showMainCategories);
        });

        // Admin: Add New User Button
        const adminOpenAddUserBtn = document.getElementById('admin-open-add-user-btn');
        if (adminOpenAddUserBtn) {
            adminOpenAddUserBtn.addEventListener('click', () => {
                document.getElementById('admin-add-user-modal').classList.remove('hidden');
            });
        }
        
        const closeAdminAddUserModal = document.getElementById('close-admin-add-user-modal');
        if (closeAdminAddUserModal) {
            closeAdminAddUserModal.addEventListener('click', () => {
                document.getElementById('admin-add-user-modal').classList.add('hidden');
            });
        }

        const confirmCreateUserBtn = document.getElementById('admin-create-user-confirm-btn');
        if (confirmCreateUserBtn) {
            confirmCreateUserBtn.addEventListener('click', () => {
                const name = document.getElementById('new-user-name').value;
                const email = document.getElementById('new-user-email').value;
                const password = document.getElementById('new-user-password').value;
                const role = document.getElementById('new-user-role').value;

                if (!name || !email || !password) {
                    alert("⚠️ Please fill all required fields!");
                    return;
                }

                if (password.length < 6) {
                    alert("⚠️ Password must be at least 6 characters long!");
                    return;
                }

                // Dispatch to firebase-sync.js
                window.dispatchEvent(new CustomEvent('adminCreateUser', {
                    detail: { name, email, password, role }
                }));
            });
        }

        // Contact Form Submission Handler
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const name = document.getElementById('contact-name').value.trim();
                const email = document.getElementById('contact-email').value.trim();
                const subject = document.getElementById('contact-subject').value.trim();
                const message = document.getElementById('contact-message').value.trim();
                const submitBtn = document.getElementById('contact-submit-btn');
                const btnText = document.getElementById('contact-btn-text');
                const btnIcon = document.getElementById('contact-btn-icon');

                if (!name || !email || !message) {
                    alert("⚠️ Please fill in all required fields.");
                    return;
                }

                // Show loading state
                if (submitBtn) submitBtn.disabled = true;
                if (btnText) btnText.textContent = "Sending...";
                if (btnIcon) btnIcon.className = "fa-solid fa-circle-notch fa-spin";

                // Dispatch to firebase-sync.js
                window.dispatchEvent(new CustomEvent('submitContactMessage', {
                    detail: {
                        messageData: { name, email, subject, message },
                        onSuccess: () => {
                            alert("✅ Your message has been sent successfully! We will get back to you soon.");
                            contactForm.reset();
                            if (submitBtn) submitBtn.disabled = false;
                            if (btnText) btnText.textContent = "Send Message";
                            if (btnIcon) btnIcon.className = "fa-solid fa-paper-plane";
                        },
                        onError: (error) => {
                            alert("❌ Failed to send message: " + error);
                            if (submitBtn) submitBtn.disabled = false;
                            if (btnText) btnText.textContent = "Send Message";
                            if (btnIcon) btnIcon.className = "fa-solid fa-paper-plane";
                        }
                    }
                }));
            });
        }

        // Fix: Enable "Back to Home" buttons on static screens (About, Contact, Privacy)
        document.querySelectorAll('.back-to-home').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                showMainCategories();
            });
        });

        // Mobile Menu Toggle Logic
        const menuToggle = document.getElementById('menu-toggle');
        const mainNav = document.querySelector('.main-nav');
        const menuOverlay = document.getElementById('menu-overlay');

        if (menuToggle && mainNav && menuOverlay) {
            const toggleMenu = () => {
                mainNav.classList.toggle('active');
                menuOverlay.classList.toggle('hidden');
            };

            menuToggle.addEventListener('click', toggleMenu);
            menuOverlay.addEventListener('click', toggleMenu);

            // Close menu when a link is clicked (Mobile Only)
            document.querySelectorAll('.nav-item').forEach(link => {
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 768) {
                        mainNav.classList.remove('active');
                        menuOverlay.classList.add('hidden');
                    }
                });
            });
        }

        // Toggles
        themeToggleBtn.addEventListener('click', toggleTheme);
        const headerThemeToggle = document.getElementById('theme-toggle-header');
        if (headerThemeToggle) headerThemeToggle.addEventListener('click', toggleTheme);
        soundToggleBtn.addEventListener('click', toggleSound);

        // Mobile Bottom Nav Events
        const bottomHome = document.getElementById('bottom-nav-home');
        const bottomDaily = document.getElementById('bottom-nav-daily');
        const bottomExam = document.getElementById('bottom-nav-exam');
        const bottomProfile = document.getElementById('bottom-nav-profile');

        if (bottomHome) bottomHome.addEventListener('click', (e) => { e.preventDefault(); showMainCategories(); });
        if (bottomDaily) bottomDaily.addEventListener('click', (e) => { e.preventDefault(); startDailyMCQs(); });
        if (bottomExam) bottomExam.addEventListener('click', (e) => { e.preventDefault(); openExamModal(); });
        if (bottomProfile) bottomProfile.addEventListener('click', (e) => { 
            e.preventDefault(); 
            if (isLoggedIn) openDashboard(); 
            else document.getElementById('auth-btn').click(); 
        });

        if (nextSetBtn) {
            nextSetBtn.addEventListener('click', () => {
                startSet(currentSetIndex + 1);
            });
        }

        const translateBtn = document.getElementById('translate-btn');
        if (translateBtn) {
            translateBtn.addEventListener('click', toggleTranslation);
        }

        const readAloudBtn = document.getElementById('read-aloud-btn');
        if (readAloudBtn) {
            readAloudBtn.addEventListener('click', readAloud);
        }

        if (dashboardToggle) dashboardToggle.addEventListener('click', openDashboard);
        if (closeDashboardBtn) closeDashboardBtn.addEventListener('click', closeDashboard);
        if (resetStatsBtn) resetStatsBtn.addEventListener('click', resetStats);

        const printBtn = document.getElementById('print-btn');
        if (printBtn) printBtn.addEventListener('click', () => window.print());

        const shareBtn = document.getElementById('share-score-btn');
        if (shareBtn) shareBtn.addEventListener('click', shareScore);

        const pdfBtn = document.getElementById('download-pdf-btn');
        if (pdfBtn) pdfBtn.addEventListener('click', downloadResultPDF);

/* Side share bar event listeners removed in favor of professional native sharing. */

        if (bookmarkBtn) bookmarkBtn.addEventListener('click', toggleBookmark);

        const navHome = document.getElementById('nav-home');
        const navDaily = document.getElementById('nav-daily');
        const navMock = document.getElementById('nav-mock');
        const navBookmarks = document.getElementById('nav-bookmarks');

        const navMistakes = document.getElementById('nav-mistakes');
        const navLeaderboard = document.getElementById('nav-leaderboard');
        const navAddMcq = document.getElementById('nav-add-mcq');
        const navAdmin = document.getElementById('nav-admin');
        const authBtn = document.getElementById('auth-btn'); // Add this back here
        
        // --- Auth & Login Logic ---
        const loginModal = document.getElementById('login-modal');
        const closeLoginModalBtn = document.getElementById('close-login-modal');
        const submitLoginBtn = document.getElementById('submit-login-btn');
        const loginUsernameInput = document.getElementById('login-username');
        const loginPasswordInput = document.getElementById('login-password');
        
        // New Modal Elements
        const tabLogin = document.getElementById('tab-login');
        const tabSignup = document.getElementById('tab-signup');
        const emailGroup = document.getElementById('email-group');
        const loginEmailInput = document.getElementById('login-email');
        const authModalTitle = document.getElementById('auth-modal-title');
        const authSubtitle = document.getElementById('auth-subtitle');
        const authActionText = document.getElementById('auth-action-text');
        const authActionIcon = document.getElementById('auth-action-icon');
        const usernameAsterisk = document.getElementById('username-asterisk');
        const googleLoginBtn = document.getElementById('google-login-btn');
        const facebookLoginBtn = document.getElementById('facebook-login-btn');
        const socialLoginDivider = document.getElementById('social-login-divider');
        const socialLoginGroup = document.getElementById('social-login-group');
        
        let isSignUpMode = false;
        let selectedRole = 'user';


        if (tabLogin && tabSignup) {
            tabLogin.addEventListener('click', () => {
                isSignUpMode = false;
                tabLogin.classList.add('active');
                tabSignup.classList.remove('active');
                
                // Hide Signup specific fields 🛠️✨🏁🛠️🚀
                const signupGroups = ['signup-username-group', 'signup-phone-group', 'signup-confirm-group'];
                signupGroups.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.classList.add('hidden');
                });
                
                if (authActionText) authActionText.textContent = 'Log In';
                if (authModalTitle) authModalTitle.textContent = 'Sign In';
                if (authSubtitle) authSubtitle.textContent = 'Welcome back! Please enter your details.';
                
                // Show forgot password
                const forgotPassLink = document.getElementById('forgot-password-link');
                if (forgotPassLink) forgotPassLink.classList.remove('hidden');

                // Show social links in Log In mode
                if (socialLoginDivider) socialLoginDivider.style.display = 'flex';
                if (socialLoginGroup) socialLoginGroup.style.display = 'flex';
            });

            tabSignup.addEventListener('click', () => {
                isSignUpMode = true;
                tabSignup.classList.add('active');
                tabLogin.classList.remove('active');
                
                // Show Signup specific fields 🛠️✨🏁🛠️🚀
                const signupGroups = ['signup-username-group', 'signup-phone-group', 'signup-confirm-group'];
                signupGroups.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.classList.remove('hidden');
                });
                
                if (authActionText) authActionText.textContent = 'Sign Up';
                if (authModalTitle) authModalTitle.textContent = 'Create Account';
                if (authSubtitle) authSubtitle.textContent = 'Create an account to track your progress.';
                
                // HIDE forgot password on signup
                const forgotPassLink = document.getElementById('forgot-password-link');
                if (forgotPassLink) forgotPassLink.classList.add('hidden');

                // HIDE social links in Sign Up mode as requested
                if (socialLoginDivider) socialLoginDivider.style.display = 'none';
                if (socialLoginGroup) socialLoginGroup.style.display = 'none';
            });
        }

        if (authBtn) {
            authBtn.addEventListener('click', () => {
                if (isLoggedIn) {
                    // Confirmation before logout
                    if (!confirm("Are you sure you want to logout?")) return;

                    // Perform Logout
                    window.dispatchEvent(new CustomEvent('authLogout'));
                    
                    isLoggedIn = false;
                    userRole = 'user';
                    localStorage.setItem('isLoggedIn', false);
                    localStorage.setItem('userRole', 'user');
                    updateAuthUI();
                    showToast("Logged out successfully!");
                } else if (loginModal) {
                    // Open Login Modal
                    loginModal.classList.remove('hidden');
                }
            });
        }

        const adminLogoutBtn = document.getElementById('admin-logout-btn');
        if (adminLogoutBtn) {
            adminLogoutBtn.addEventListener('click', () => {
                if (isLoggedIn) {
                    if (!confirm("Are you sure you want to logout from the Admin panel?")) return;

                    window.dispatchEvent(new CustomEvent('authLogout'));
                    isLoggedIn = false;
                    userRole = 'user';
                    localStorage.setItem('isLoggedIn', false);
                    localStorage.setItem('userRole', 'user');
                    updateAuthUI();
                    
                    const adminModal = document.getElementById('admin-modal');
                    if (adminModal) adminModal.classList.add('hidden');
                    
                    showToast("Logged out successfully!");
                }
            });
        }

        if (closeLoginModalBtn && loginModal) {
            closeLoginModalBtn.addEventListener('click', () => {
                loginModal.classList.add('hidden');
            });
        }

        if (submitLoginBtn && loginModal) {
            submitLoginBtn.addEventListener('click', async () => {
                const email = loginEmailInput ? loginEmailInput.value.trim() : '';
                const password = loginPasswordInput ? loginPasswordInput.value.trim() : '';
                const usernameInput = document.getElementById('signup-username') ? document.getElementById('signup-username').value.trim() : '';
                const phone = document.getElementById('signup-phone') ? document.getElementById('signup-phone').value.trim() : '';
                const confirmPassword = document.getElementById('signup-confirm-password') ? document.getElementById('signup-confirm-password').value.trim() : '';
                
                if (!email || !password) {
                    alert("Please fill in email and password.");
                    return;
                }

                if (isSignUpMode) {
                    if (!usernameInput || !phone || !confirmPassword) {
                        alert("Please fill in all signup fields.");
                        return;
                    }
                    if (password !== confirmPassword) {
                        alert("Passwords do not match.");
                        return;
                    }
                    selectedRole = 'user'; // Ensure signup is always standard user
                } else {
                    // --- ADMIN CREDENTIAL OVERRIDE (Bypass Firebase) ---
                    if (email === 'admin@mcqmatrix.com' && password === 'McqMatrix@2024') {
                        isLoggedIn = true;
                        userRole = 'admin';
                        localStorage.setItem('isLoggedIn', true);
                        localStorage.setItem('userRole', 'admin');
                        updateAuthUI();
                        
                        alert("✅ Welcome back, McqMatrix Admin!");

                        loginModal.classList.add('hidden');
                        
                        if (loginEmailInput) loginEmailInput.value = '';
                        if (loginPasswordInput) loginPasswordInput.value = '';
                        return;
                    }

                    // --- CHECK FOR FIRESTORE USER OVERRIDES ---
                    try {
                        // Dispatch to firebase-sync.js to check for managed profile override
                        window.dispatchEvent(new CustomEvent('checkUserOverride', {
                            detail: {
                                email, password,
                                onSuccess: (userProfile) => {
                                    isLoggedIn = true;
                                    userRole = userProfile.role || 'user';
                                    localStorage.setItem('isLoggedIn', true);
                                    localStorage.setItem('userRole', userRole);
                                    updateAuthUI();
                                    
                                    alert(`✅ Successfully logged in as ${userProfile.displayName || 'User'} (Managed Access)!`);
                                    loginModal.classList.add('hidden');
                                    
                                    if (loginEmailInput) loginEmailInput.value = '';
                                    if (loginPasswordInput) loginPasswordInput.value = '';
                                },
                                onFail: () => {
                                    // No override found, proceed with standard Firebase Auth
                                    window.dispatchEvent(new CustomEvent('authSubmit', {
                                        detail: { isSignUpMode, email, username: usernameInput, password, phone, role: 'user' }
                                    }));
                                }
                            }
                        }));
                        return; // Wait for event callback
                    } catch(e) { console.error("Override check failed:", e); }

                    selectedRole = 'user';
                }

                // Default flow if no overrides hit
                window.dispatchEvent(new CustomEvent('authSubmit', {
                    detail: { isSignUpMode, email, username: usernameInput, password, phone, role: selectedRole }
                }));
            });
        }
        // Listener: Firebase Auth Success (Sign Up or Login via Firebase)
        window.addEventListener('authSuccess', (e) => {
            const { username, role, silent } = e.detail;
            isLoggedIn = true;
            userRole = role || 'user';
            localStorage.setItem('isLoggedIn', true);
            localStorage.setItem('userRole', userRole);
            updateAuthUI();
            
            if (!silent) {
                showToast(`Welcome back, ${username}!`);
            }
            
            
            // Clear form fields
            if (loginUsernameInput) loginUsernameInput.value = '';
            if (loginPasswordInput) loginPasswordInput.value = '';
            if (loginEmailInput) loginEmailInput.value = '';
            if (adminSecretInput) adminSecretInput.value = '';
        });

        // Listener: Firebase Auth Logout (Triggered by session restore logic if logged out)
        window.addEventListener('authLogout', () => {
            isLoggedIn = false;
            userRole = null;
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userRole');
            updateAuthUI();
        });

        // Listeners for Social Logins
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('socialLogin', { detail: 'google' }));
            });
        }
        
        if (facebookLoginBtn) {
            facebookLoginBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('socialLogin', { detail: 'facebook' }));
            });
        }

        // Forgot Password Handler
        const forgotPasswordBtn = document.getElementById('forgot-password-btn');
        if (forgotPasswordBtn) {
            forgotPasswordBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const emailInput = loginEmailInput ? loginEmailInput.value.trim() : '';
                const usernameInput = loginUsernameInput ? loginUsernameInput.value.trim() : '';
                
                // Try email field first, then username field (if it looks like email)
                const resetEmail = emailInput || (usernameInput.includes('@') ? usernameInput : '');
                
                if (!resetEmail) {
                    // Show email field if hidden
                    const emailGroup = document.getElementById('email-group');
                    if (emailGroup) emailGroup.classList.remove('hidden');
                    alert("Please enter your email address in the Email field, then click 'Forgot Password?' again.");
                    return;
                }

                // Dispatch to firebase-sync.js
                window.dispatchEvent(new CustomEvent('resetPassword', { 
                    detail: { 
                        email: resetEmail,
                        onSuccess: () => {
                            alert("✅ Password reset email sent!\n\nPlease check your inbox at:\n" + resetEmail);
                        },
                        onError: (err) => {
                            alert("❌ Failed to send reset email:\n" + err);
                        }
                    }
                }));
            });
        }

        // --- Visitor Geography Tracking ---
        function trackVisitorGeography() {
            // Only track once per session to avoid spamming the API
            if (sessionStorage.getItem('geoTracked')) return;

            fetch('https://ipapi.co/json/')
                .then(response => response.json())
                .then(data => {
                    const country = data.country_name || "Unknown Region";
                    
                    // Simple Local Storage based stats for demo. 
                    // To share across users, you would dispatch event to firebase-sync.js here.
                    let visitorStats = JSON.parse(localStorage.getItem('visitor_stats') || '{}');
                    visitorStats[country] = (visitorStats[country] || 0) + 1;
                    localStorage.setItem('visitor_stats', JSON.stringify(visitorStats));
                    
                    // Mark session is tracked
                    sessionStorage.setItem('geoTracked', 'true');
                    
                    // Dispatch to Firebase (if you have the backend logic set up)
                    window.dispatchEvent(new CustomEvent('logVisitorGeo', { detail: country }));
                })
                .catch(err => console.error('Geo Tracking Error:', err));
        }

        // Call the tracker when the site loads
        trackVisitorGeography();

        // --- Admin Panel Logic ---
        const adminModal = document.getElementById('admin-modal');
        const closeAdminModalBtn = document.getElementById('close-admin-modal');
        const adminPendingList = document.getElementById('admin-pending-list');
        
        // Admin New Tabs Logic
        const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
        const adminTabContents = document.querySelectorAll('.admin-tab-content');
        
        if (adminTabBtns.length > 0) {
            adminTabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    adminTabBtns.forEach(b => b.classList.remove('active'));
                    adminTabContents.forEach(c => c.classList.add('hidden'));
                    
                    btn.classList.add('active');
                    const targetTab = document.getElementById(btn.getAttribute('data-tab'));
                    if (targetTab) targetTab.classList.remove('hidden');
                    
                    // Refresh data based on tab selected
                    const tabName = btn.getAttribute('data-tab');
                    if (tabName === 'admin-dashboard') renderAdminDashboard();
                    if (tabName === 'admin-pending') renderAdminPending();
                    if (tabName === 'admin-users') renderAdminUsers();
                    if (tabName === 'admin-jobs') renderAdminJobs();
                    if (tabName === 'admin-edit-mcqs') renderAdminEditCategorySelect();
                    if (tabName === 'admin-export') renderAdminExportCategorySelect();
                });
            });
        }

        // --- 1. Admin Dashboard Logic ---
        function renderAdminDashboard() {
            const totalUsersEl = document.getElementById('admin-total-users');
            const totalMcqsEl = document.getElementById('admin-total-mcqs');
            const pendingCountEl = document.getElementById('admin-pending-count');
            const visitorStatsTbody = document.getElementById('admin-visitor-stats');

            // Get Total Pending
            const pendingMcqs = JSON.parse(localStorage.getItem('user_submitted_mcqs') || '[]');
            if (pendingCountEl) pendingCountEl.textContent = pendingMcqs.length;

            // Helper function to count questions recursively
            function countAllQuestions(node) {
                let count = 0;
                if (node.questions) count += node.questions.length;
                if (node.subcategories) {
                    node.subcategories.forEach(sub => {
                        count += countAllQuestions(sub);
                    });
                }
                return count;
            }

            // Get Total MCQs across all categories
            let totalQ = 0;
            if (window.subjectsIndex) {
                window.subjectsIndex.forEach(cat => {
                    totalQ += (cat.mcqCount || 0);
                });
            }
            if (totalMcqsEl) totalMcqsEl.textContent = totalQ.toLocaleString();

            // Get Mock Total Users (Or fetch from firebase if configured)
            // Let's mock a simple local active user count if real DB isn't fully returning users yet
            if (totalUsersEl) {
                // If we get an event from firebase loaded users, we can update it, else default fallback
                if (window.adminFetchedUsers) {
                    totalUsersEl.textContent = window.adminFetchedUsers.length;
                } else {
                    totalUsersEl.textContent = "...";
                    window.dispatchEvent(new Event('adminFetchUsers'));
                }
            }

            // Render Visitor Demographics
            if (visitorStatsTbody) {
                const visitorStats = JSON.parse(localStorage.getItem('visitor_stats') || '{}');
                visitorStatsTbody.innerHTML = '';
                
                const countries = Object.keys(visitorStats);
                
                if (countries.length === 0) {
                    visitorStatsTbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No data available yet.</td></tr>';
                } else {
                    countries.sort((a,b) => visitorStats[b] - visitorStats[a]).forEach(country => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><i class="fa-solid fa-location-dot" style="color:var(--primary-color); margin-right:8px;"></i> ${country}</td>
                            <td><span class="badge badge-primary">${visitorStats[country]}</span></td>
                        `;
                        visitorStatsTbody.appendChild(tr);
                    });
                }
            }
        }

        // --- 2. Admin Pending Logic ---

        function renderAdminPending() {
            if (!adminPendingList) return;
            adminPendingList.innerHTML = '<p style="text-align: center; padding: 2rem;">Loading pending MCQs from cloud <i class="fa-solid fa-circle-notch fa-spin"></i></p>';

            window.dispatchEvent(new CustomEvent('fetchPendingQuestions', {
                detail: {
                    onSuccess: (pendingMcqs) => {
                        window._currentPendingMcqs = pendingMcqs; // Save locally for easy reference
                        adminPendingList.innerHTML = '';
                        if (pendingMcqs.length === 0) {
                            adminPendingList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No pending MCQs to review.</p>';
                            return;
                        }

                        pendingMcqs.forEach((mcq, index) => {
                            const card = document.createElement('div');
                            card.className = 'admin-mcq-card';
                            
                            const optLabels = ['A', 'B', 'C', 'D'];
                            let optionsHtml = '';
                            mcq.options.forEach((opt, oIdx) => {
                                optionsHtml += `<li><strong>${optLabels[oIdx]}:</strong> ${opt}</li>`;
                            });

                            card.innerHTML = `
                                <h4><i class="fa-solid fa-folder-open"></i> Category: ${mcq.category}</h4>
                                <p><strong>Q:</strong> ${mcq.q}</p>
                                <ul>${optionsHtml}</ul>
                                <div class="correct-opt"><i class="fa-solid fa-check"></i> Correct Answer: Option ${optLabels[mcq.answer]}</div>
                                <div class="admin-actions">
                                    <button class="approve-btn" data-index="${index}"><i class="fa-solid fa-check-double"></i> Approve</button>
                                    <button class="reject-btn" data-index="${index}"><i class="fa-solid fa-trash-can"></i> Reject</button>
                                </div>
                            `;
                            adminPendingList.appendChild(card);
                        });

                        // Bind Action Buttons
                        document.querySelectorAll('.approve-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                const idx = parseInt(e.target.closest('button').getAttribute('data-index'));
                                approveMcq(idx);
                            });
                        });

                        document.querySelectorAll('.reject-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                const idx = parseInt(e.target.closest('button').getAttribute('data-index'));
                                rejectMcq(idx);
                            });
                        });
                    },
                    onError: (err) => {
                        adminPendingList.innerHTML = `<p style="text-align: center; color: red; padding: 2rem;">Error loading pending MCQs: ${err}</p>`;
                    }
                }
            }));
        }

        function approveMcq(index) {
            const pendingMcqs = window._currentPendingMcqs || [];
            if (index < 0 || index >= pendingMcqs.length) return;
            
            const mcq = pendingMcqs[index];
            
            // Find target subcategory to add the question
            let found = false;
            let targetMainObj = null;
            for (let main of window.subjectsIndex) {
                for (let sub of main.subcategories) {
                    if (sub.category === mcq.category) {
                        // Temporarily push to local array
                        sub.questions.push({
                            q: mcq.q,
                            options: mcq.options,
                            answer: mcq.answer
                        });
                        targetMainObj = main;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            
            if (found) {
                // Dispatch event to update Firebase
                window.dispatchEvent(new CustomEvent('resolvePendingQuestion', {
                    detail: {
                        action: 'approve',
                        docId: mcq.id,
                        targetMainObj: targetMainObj,
                        onSuccess: () => {
                            showToast("MCQ Approved and added to the Cloud Quiz Bank!");
                            renderAdminPending(); // Refresh UI
                        },
                        onError: (err) => {
                            alert("Failed to approve MCQ in Cloud: " + err);
                            // Potentially rollback the local array update here if needed
                        }
                    }
                }));
            } else {
                alert("Error: Target category not found in the dataset.");
            }
        }

        function rejectMcq(index) {
            if (!confirm("Are you sure you want to reject and delete this submitted MCQ?")) return;
            const pendingMcqs = window._currentPendingMcqs || [];
            if (index < 0 || index >= pendingMcqs.length) return;
            
            const mcq = pendingMcqs[index];
            
            window.dispatchEvent(new CustomEvent('resolvePendingQuestion', {
                detail: {
                    action: 'reject',
                    docId: mcq.id,
                    onSuccess: () => {
                        showToast("MCQ Rejected and removed from cloud queue.", true);
                        renderAdminPending();
                        renderAdminDashboard(); // Update stats if needed
                    },
                    onError: (err) => {
                        alert("Failed to reject MCQ in Cloud: " + err);
                    }
                }
            }));
        }


        // --- 4. Admin Manage Jobs Logic ---
        function renderAdminJobs() {
            fetchAndRenderJobs(true);
        }

        const adminAddJobBtn = document.getElementById('admin-add-job-btn');
        if (adminAddJobBtn) {
            adminAddJobBtn.addEventListener('click', () => {
                const title = document.getElementById('admin-job-title').value.trim();
                const dept = document.getElementById('admin-job-dept').value.trim();
                const deadline = document.getElementById('admin-job-deadline').value;
                const link = document.getElementById('admin-job-link').value.trim();
                const imageUrl = document.getElementById('admin-job-image') ? document.getElementById('admin-job-image').value.trim() : '';
                const fileInput = document.getElementById('admin-job-image-file');
                const editingId = adminAddJobBtn.dataset.editingId;

                if (!title || !deadline) {
                    alert("Please fill out Job Title and Deadline Date");
                    return;
                }

                adminAddJobBtn.disabled = true;
                const btnText = document.getElementById('admin-add-job-btn-text');
                const previousText = btnText ? btnText.innerText : (editingId ? 'Update Alert' : 'Publish Alert');
                adminAddJobBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span id="admin-add-job-btn-text">' + (editingId ? 'Updating...' : 'Publishing...') + '</span>';

                const jobData = {
                    title: title,
                    dept: dept,
                    deadline: deadline,
                    link: link || '#',
                    image: imageUrl || ''
                };

                const eventName = editingId ? 'editJob' : 'addJob';
                const payload = editingId ? { jobId: editingId, jobData: jobData } : { jobData: jobData };

                window.dispatchEvent(new CustomEvent(eventName, {
                    detail: {
                        ...payload,
                        onSuccess: (id) => {
                            showToast(editingId ? "Job alert updated!" : "Job alert published!");
                            adminAddJobBtn.disabled = false;
                            adminAddJobBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span id="admin-add-job-btn-text">Publish Alert</span>';
                            delete adminAddJobBtn.dataset.editingId;
                            
                            // Reset form
                            document.getElementById('admin-job-title').value = '';
                            document.getElementById('admin-job-dept').value = '';
                            document.getElementById('admin-job-deadline').value = '';
                            document.getElementById('admin-job-link').value = '';
                            if(document.getElementById('admin-job-image')) document.getElementById('admin-job-image').value = '';
                            if(fileInput) fileInput.value = '';
                            const previewDiv = document.getElementById('admin-job-image-preview');
                            if(previewDiv) previewDiv.style.display = 'none';

                            // Refresh lists
                            fetchAndRenderJobs();
                        },
                        onError: (err) => {
                            alert("Failed to " + (editingId ? "update" : "publish") + " job: " + err);
                            adminAddJobBtn.disabled = false;
                            adminAddJobBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span id="admin-add-job-btn-text">' + previousText + '</span>';
                        }
                    }
                }));
            });
        }

        // --- 5. Edit MCQs Logic ---
        const adminCategorySelect = document.getElementById('admin-category-select');
        const adminEditMcqList = document.getElementById('admin-edit-mcq-list');

        function renderAdminEditCategorySelect() {
            if (!adminCategorySelect) return;
            adminCategorySelect.innerHTML = '<option value="">-- Choose Category --</option>';
            window.subjectsIndex.forEach(mainCat => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = mainCat.name;
                mainCat.subcategories.forEach(sub => {
                    const opt = document.createElement('option');
                    opt.value = sub.category;
                    opt.textContent = sub.category;
                    optgroup.appendChild(opt);
                });
                adminCategorySelect.appendChild(optgroup);
            });
        }

        if (adminCategorySelect) {
            adminCategorySelect.addEventListener('change', (e) => {
                const selectedCat = e.target.value;
                if (!selectedCat) {
                    if (adminEditMcqList) adminEditMcqList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Select a category above to load questions.</p>';
                    return;
                }
                loadCategoryForEditing(selectedCat);
            });
        }

        function loadCategoryForEditing(catName) {
            if (!adminEditMcqList) return;
            adminEditMcqList.innerHTML = '<p style="text-align:center;">Loading questions...</p>';
            
            let targetSub = null;
            let targetMainObj = null;
            
            for (let main of window.subjectsIndex) {
                for (let sub of main.subcategories) {
                    if (sub.category === catName) {
                        targetSub = sub;
                        targetMainObj = main;
                        break;
                    }
                }
                if (targetSub) break;
            }

            if (!targetSub) {
                adminEditMcqList.innerHTML = '<p style="text-align:center; color:red;">Category not found.</p>';
                return;
            }

            if (!targetSub.questions || targetSub.questions.length === 0) {
                adminEditMcqList.innerHTML = '<p style="text-align:center;">No questions found in this category.</p>';
                return;
            }

            adminEditMcqList.innerHTML = '';
            targetSub.questions.forEach((q, idx) => {
                const card = document.createElement('div');
                card.className = 'admin-mcq-card';
                card.style.position = 'relative';
                
                // Normal View HTML
                const normalViewHtml = `
                    <div class="mcq-view">
                        <p style="font-weight:600; margin-bottom: 0.5rem; padding-right: 4.5rem;">Q${idx + 1}: ${q.q}</p>
                        <div style="position:absolute; top: 1rem; right: 1rem; display: flex; gap: 0.5rem;">
                            <button class="edit-db-btn" data-cat="${catName}" data-idx="${idx}" title="Edit MCQ" style="background:#3b82f6; color:white; border:none; padding:0.4rem 0.6rem; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-pen"></i></button>
                            <button class="delete-db-btn" data-cat="${catName}" data-idx="${idx}" title="Delete MCQ" style="background:#ef4444; color:white; border:none; padding:0.4rem 0.6rem; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                        <ul style="margin-top:0.5rem; font-size:0.9rem;">
                            <li><strong>A:</strong> ${q.options[0]}</li>
                            <li><strong>B:</strong> ${q.options[1]}</li>
                            <li><strong>C:</strong> ${q.options[2]}</li>
                            <li><strong>D:</strong> ${q.options[3]}</li>
                        </ul>
                        <div class="correct-opt" style="margin-top:0.5rem; font-size:0.85rem;"><i class="fa-solid fa-check"></i> Answer: Opt ${['A','B','C','D'][q.answer]}</div>
                    </div>
                `;
                
                // Edit Form HTML (Hidden initially)
                const editFormHtml = `
                    <div class="mcq-edit-form hidden" style="background:#f9fafb; padding:1rem; border-radius:8px; border:1px solid #d1d5db;">
                        <h4 style="margin-bottom:0.8rem; color:var(--primary-dark);">Edit Question ${idx + 1}</h4>
                        <div style="margin-bottom:0.8rem;">
                            <label style="display:block; font-size:0.85rem; margin-bottom:0.2rem;">Question</label>
                            <textarea id="edit-q-${idx}" style="width:100%; border:1px solid #d1d5db; border-radius:4px; padding:0.5rem;" rows="2">${q.q}</textarea>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; margin-bottom:0.8rem;">
                            <div><label style="font-size:0.8rem;">Opt A</label><input type="text" id="edit-opt0-${idx}" value="${q.options[0]}" style="width:100%; padding:0.4rem; border:1px solid #d1d5db; border-radius:4px;"></div>
                            <div><label style="font-size:0.8rem;">Opt B</label><input type="text" id="edit-opt1-${idx}" value="${q.options[1]}" style="width:100%; padding:0.4rem; border:1px solid #d1d5db; border-radius:4px;"></div>
                            <div><label style="font-size:0.8rem;">Opt C</label><input type="text" id="edit-opt2-${idx}" value="${q.options[2]}" style="width:100%; padding:0.4rem; border:1px solid #d1d5db; border-radius:4px;"></div>
                            <div><label style="font-size:0.8rem;">Opt D</label><input type="text" id="edit-opt3-${idx}" value="${q.options[3]}" style="width:100%; padding:0.4rem; border:1px solid #d1d5db; border-radius:4px;"></div>
                        </div>
                        <div style="margin-bottom:1rem;">
                            <label style="display:block; font-size:0.85rem; margin-bottom:0.2rem;">Correct Answer</label>
                            <select id="edit-ans-${idx}" style="padding:0.4rem; border-radius:4px; border:1px solid #d1d5db; width:100%;">
                                <option value="0" ${q.answer === 0 ? 'selected' : ''}>Option A</option>
                                <option value="1" ${q.answer === 1 ? 'selected' : ''}>Option B</option>
                                <option value="2" ${q.answer === 2 ? 'selected' : ''}>Option C</option>
                                <option value="3" ${q.answer === 3 ? 'selected' : ''}>Option D</option>
                            </select>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
                            <button class="cancel-edit-btn" data-idx="${idx}" style="background:#e5e7eb; border:none; padding:0.4rem 0.8rem; border-radius:4px; cursor:pointer;">Cancel</button>
                            <button class="save-edit-btn" data-idx="${idx}" style="background:var(--primary); color:white; border:none; padding:0.4rem 0.8rem; border-radius:4px; cursor:pointer;">Save</button>
                        </div>
                    </div>
                `;

                card.innerHTML = normalViewHtml + editFormHtml;
                adminEditMcqList.appendChild(card);
            });

            // Bind Delete events
            document.querySelectorAll('.delete-db-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const btnEl = e.target.closest('button');
                    const cName = btnEl.getAttribute('data-cat');
                    const qIdx = parseInt(btnEl.getAttribute('data-idx'));
                    
                    if (confirm(`Are you sure you want to permanently delete Question ${qIdx + 1}?`)) {
                        // Store deleted question temporarily in case of rollback
                        const deletedQuestion = targetSub.questions[qIdx];
                        targetSub.questions.splice(qIdx, 1);
                        
                        window.dispatchEvent(new CustomEvent('updateCategoryInFirestore', {
                            detail: {
                                mainCat: targetMainObj,
                                onSuccess: () => {
                                    showToast("Question deleted from cloud database.");
                                    loadCategoryForEditing(catName); // Refresh list
                                    renderAdminDashboard(); // Refresh stats
                                },
                                onError: (err) => {
                                    alert("Failed to delete question from cloud: " + err);
                                    // Rollback local change
                                    targetSub.questions.splice(qIdx, 0, deletedQuestion);
                                }
                            }
                        }));
                    }
                });
            });

            // Bind Edit form toggles
            document.querySelectorAll('.edit-db-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const card = e.target.closest('.admin-mcq-card');
                    card.querySelector('.mcq-view').classList.add('hidden');
                    card.querySelector('.mcq-edit-form').classList.remove('hidden');
                });
            });

            document.querySelectorAll('.cancel-edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const card = e.target.closest('.admin-mcq-card');
                    card.querySelector('.mcq-edit-form').classList.add('hidden');
                    card.querySelector('.mcq-view').classList.remove('hidden');
                });
            });

            document.querySelectorAll('.save-edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const qIdx = parseInt(e.target.getAttribute('data-idx'));
                    
                    // Extract values from form
                    const newQ = document.getElementById(`edit-q-${qIdx}`).value.trim();
                    const newOpt0 = document.getElementById(`edit-opt0-${qIdx}`).value.trim();
                    const newOpt1 = document.getElementById(`edit-opt1-${qIdx}`).value.trim();
                    const newOpt2 = document.getElementById(`edit-opt2-${qIdx}`).value.trim();
                    const newOpt3 = document.getElementById(`edit-opt3-${qIdx}`).value.trim();
                    const newAns = parseInt(document.getElementById(`edit-ans-${qIdx}`).value);

                    if (!newQ || !newOpt0 || !newOpt1 || !newOpt2 || !newOpt3) {
                        alert("Please fill out all fields before saving.");
                        return;
                    }

                    // Store old question for rollback
                    const oldQuestion = { ...targetSub.questions[qIdx] };
                    
                    // Update the array object locally first (Optimistic update)
                    targetSub.questions[qIdx] = {
                        q: newQ,
                        options: [newOpt0, newOpt1, newOpt2, newOpt3],
                        answer: newAns
                    };

                    // Send to Firebase
                    window.dispatchEvent(new CustomEvent('updateCategoryInFirestore', {
                        detail: {
                            mainCat: targetMainObj,
                            onSuccess: () => {
                                showToast("Question updated successfully locally and on the cloud!");
                                loadCategoryForEditing(catName); // Re-render the list immediately
                            },
                            onError: (err) => {
                                alert("Failed to update question in the cloud: " + err);
                                // Rollback local change
                                targetSub.questions[qIdx] = oldQuestion;
                            }
                        }
                    }));
                });
            });
        }

        // --- 5. Export Data Logic ---
        const exportJsonBtn = document.getElementById('admin-export-json-btn');
        const exportPdfBtn = document.getElementById('admin-export-pdf-btn');
        const migrateFirebaseBtn = document.getElementById('admin-migrate-firebase-btn');
        
        if (migrateFirebaseBtn) {
            migrateFirebaseBtn.addEventListener('click', () => {
                if(confirm("Are you sure you want to upload all offline data to Firebase? This will overwrite the database.")) {
                    if (typeof window.migrateDataToFirestore === 'function') {
                        window.migrateDataToFirestore();
                    } else {
                        alert("Firebase sync script not loaded or initialized yet.");
                    }
                }
            });
        }
        
        const adminExportCategorySelect = document.getElementById('admin-export-category-select');
        
        function renderAdminExportCategorySelect() {
            if (!adminExportCategorySelect) return;
            // Preserve the 'All Categories' option
            adminExportCategorySelect.innerHTML = '<option value="all">All Categories (Complete Database)</option>';
            
            window.subjectsIndex.forEach(mainCat => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = mainCat.name;
                mainCat.subcategories.forEach(sub => {
                    const opt = document.createElement('option');
                    opt.value = sub.category; // using sub.category name as the value identifier
                    opt.textContent = sub.category;
                    optgroup.appendChild(opt);
                });
                adminExportCategorySelect.appendChild(optgroup);
            });
        }

        const exportDataJsBtn = document.getElementById('admin-save-data-js-btn');
        if (exportDataJsBtn) {
            exportDataJsBtn.addEventListener('click', () => {
                // Generate a valid JavaScript file content that defines the const mainQuizData array
                const jsContent = `const mainQuizData = ${JSON.stringify(window.subjectsIndex, null, 4)};\n`;
                
                // Create a Blob from the content
                const blob = new Blob([jsContent], { type: "text/javascript;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                
                // Create an invisible anchor to trigger the download
                const anchor = document.createElement('a');
                anchor.setAttribute("href", url);
                anchor.setAttribute("download", "data.js");
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                
                // Clean up the URL object
                setTimeout(() => URL.revokeObjectURL(url), 100);
                
                showToast("Database (data.js) saved and downloaded successfully!");
            });
        }

        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.subjectsIndex, null, 2));
                const anchor = document.createElement('a');
                anchor.setAttribute("href", dataStr);
                anchor.setAttribute("download", "mcqmatrix_database_backup.json");
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                showToast("JSON Database exported successfully!");
            });
        }

        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', async () => {
                const selectedCategory = adminExportCategorySelect ? adminExportCategorySelect.value : 'all';
                
                if (!window.jspdf || !window.jspdf.jsPDF) {
                    alert("PDF Library is still loading or failed to load. Please try again in a moment.");
                    return;
                }
                
                showToast("Generating PDF... Please wait.");
                exportPdfBtn.disabled = true;
                exportPdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

                let dataToExport = [];
                if (selectedCategory === 'all') {
                    exportPdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Downloading database...';
                    for (const meta of window.subjectsIndex) {
                        const data = await ensureSubjectLoaded(meta.slug);
                        if (data) dataToExport.push(data);
                    }
                } else {
                    const meta = window.subjectsIndex.find(m => m.subcategories && m.subcategories.some(s => s.category === selectedCategory || (s.isFolder && s.subcategories && s.subcategories.some(n => n.category === selectedCategory))));
                    if (meta) {
                        const data = await ensureSubjectLoaded(meta.slug);
                        if (data) dataToExport.push(data);
                    }
                }

                // Use jsPDF
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                let yPos = 20;

                // Function to add Watermark
                const addWatermark = () => {
                    doc.setTextColor(200, 200, 200); // Light Gray
                    doc.setFontSize(50);
                    // Save current angle and translate to center
                    doc.text("McqMatrix", pageWidth / 2, pageHeight / 2, { angle: 45, align: "center", opacity: 0.3 });

                    
                    // Reset font settings so subsequent text isn't drawn massive and gray
                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(11);
                    doc.setFont("helvetica", "normal");
                };

                // Add Title and initial watermark
                doc.setFont("helvetica", "bold");
                doc.setFontSize(22);
                doc.setTextColor(0, 0, 0); // Black
                
                let titleText = "McqMatrix - Complete Database";
                if (selectedCategory !== 'all') {
                    titleText = `McqMatrix - Category: ${selectedCategory}`;
                }
                doc.text(titleText, pageWidth / 2, yPos, { align: "center" });
                
                addWatermark();
                yPos += 20;

                doc.setFontSize(12);
                
                // Keep track of if we added anything
                let hasDataToPrint = false;
                
                // Iterate through the database
                window.subjectsIndex.forEach((mainCat) => {
                    let mainHeaderPrinted = false;
                    
                    if (mainCat.subcategories) {
                        mainCat.subcategories.forEach((subCat) => {
                            // Filter logic
                            if (selectedCategory !== 'all' && subCat.category !== selectedCategory) {
                                return; // Skip this subcategory if it is not selected
                            }
                            
                            hasDataToPrint = true; // We found something to print!

                            if (yPos > pageHeight - 40) {
                                doc.addPage();
                                addWatermark();
                                yPos = 20;
                            }
                            
                            // Print Main Category header ONLY if we haven't printed it yet AND we are actually printing a subcategory belonging to it
                            if (!mainHeaderPrinted && selectedCategory === 'all') {
                                doc.setFont("helvetica", "bold");
                                doc.setFontSize(16);
                                doc.setTextColor(5, 150, 105); // Primary Color (Greenish)
                                doc.text(`Category: ${mainCat.name}`, 15, yPos);
                                yPos += 10;
                                doc.setTextColor(0, 0, 0); // Reset text color
                                mainHeaderPrinted = true;
                            }
                            
                            // Sub Category Header
                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(14);
                            doc.text(`Topic: ${subCat.category}`, 20, yPos);
                            yPos += 8;
                            
                            // Questions
                            doc.setFont("helvetica", "normal");
                            doc.setFontSize(11);
                            
                            if (subCat.questions) {
                                subCat.questions.forEach((q, qIdx) => {
                                    // Make sure entire question block stays on a page nicely instead of cutting off randomly
                                    // A big question block could take 60 units of space. Give it a large threshold.
                                    if (yPos > pageHeight - 65) {
                                        doc.addPage();
                                        addWatermark();
                                        yPos = 20;
                                    }
                                    
                                    // Split long text
                                    const questionLines = doc.splitTextToSize(`Q${qIdx + 1}: ${q.q}`, pageWidth - 30);
                                    doc.setFont("helvetica", "bold");
                                    doc.text(questionLines, 20, yPos);
                                    yPos += (questionLines.length * 6) + 2;
                                    
                                    doc.setFont("helvetica", "normal");
                                    const labels = ['A)', 'B)', 'C)', 'D)'];
                                    
                                    q.options.forEach((opt, oIdx) => {
                                        const optText = `${labels[oIdx]} ${opt}`;
                                        const optLines = doc.splitTextToSize(optText, pageWidth - 40);
                                        
                                        // Highlight the correct answer
                                        if (oIdx === q.answer) {
                                            doc.setFont("helvetica", "bold");
                                            doc.setTextColor(0, 128, 0); // Green
                                        } else {
                                            doc.setFont("helvetica", "normal");
                                            doc.setTextColor(50, 50, 50); // Dark gray
                                        }
                                        
                                        doc.text(optLines, 25, yPos);
                                        yPos += (optLines.length * 5) + 1;
                                    });
                                    
                                    // Reset color and add padding
                                    doc.setTextColor(0, 0, 0);
                                    yPos += 4;
                                });
                            }
                            yPos += 5; // Extra padding between topics
                        });
                    }
                    if (mainHeaderPrinted) {
                        yPos += 10; // Extra padding between main categories
                    }
                });

                if (!hasDataToPrint) {
                     doc.setFont("helvetica", "italic");
                     doc.setFontSize(12);
                     doc.text("No data found for this category.", pageWidth / 2, yPos, { align: "center" });
                }

                // Download
                const fileName = selectedCategory === 'all' ? "McqMatrix_Book.pdf" : `McqMatrix_${selectedCategory.replace(/\\s+/g, '_')}.pdf`;
                doc.save(fileName);
                showToast("PDF Generated Successfully!");
                
                exportPdfBtn.disabled = false;
                exportPdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Export as PDF (Printable)';
            });
        }

        if (navAdmin && adminModal) {
            navAdmin.addEventListener('click', (e) => {
                e.preventDefault();
                // Select default tab
                const firstTabBtn = document.querySelector('.admin-tab-btn[data-tab="admin-dashboard"]');
                if (firstTabBtn) firstTabBtn.click();
                
                adminModal.classList.remove('hidden');
                document.body.classList.add('admin-premium-mode');
            });
        }

        if (closeAdminModalBtn && adminModal) {
            closeAdminModalBtn.addEventListener('click', () => {
                adminModal.classList.add('hidden');
                document.body.classList.remove('admin-premium-mode');
                document.body.classList.remove('contributor-active');
            });
        }

        if (navHome) navHome.addEventListener('click', (e) => { e.preventDefault(); showMainCategories(); });
        if (navDaily) navDaily.addEventListener('click', (e) => { e.preventDefault(); startDailyMCQs(); });
        if (navMock) navMock.addEventListener('click', (e) => { e.preventDefault(); startMockTest(); });
        if (navExam) navExam.addEventListener('click', (e) => { e.preventDefault(); openExamModal(); });
        if (navBookmarks) navBookmarks.addEventListener('click', (e) => { e.preventDefault(); startBookmarksQuiz(); });
        if (navMistakes) navMistakes.addEventListener('click', (e) => { e.preventDefault(); startMistakesQuiz(); });
        if (navLeaderboard) navLeaderboard.addEventListener('click', (e) => { e.preventDefault(); openLeaderboard(); });
        
        // --- Admin Premium Mode Dual-State Toggle Logic ---
        const adminModeToggleBtns = document.querySelectorAll('.admin-mode-toggle-btn');
        adminModeToggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all
                adminModeToggleBtns.forEach(b => b.classList.remove('active'));
                // Add active class to clicked
                btn.classList.add('active');
                
                const mode = btn.getAttribute('data-mode');
                if (mode === 'contributor') {
                    // Navigate to 'Add MCQ' tab disguised as Contributor mode
                    document.body.classList.add('contributor-active');
                    const addMcqTabBtn = document.querySelector('.admin-tab-btn[data-tab="admin-pending"]'); // Or dedicated tab if needed. Actually we want a specific form. Let's redirect to an injected form or create a dedicated tab for it.
                    // Wait, earlier design didn't specify where Add MCQ form inside Admin is. Let's just create a new hidden tab for it if it doesn't exist, or reuse the global 'Add MCQ' modal. 
                    // To keep it simple, we can trigger the Add MCQ nav click.
                    if (navAddMcq) navAddMcq.click();
                } else {
                    document.body.classList.remove('contributor-active');
                }
            });
        });
        
        // --- Add MCQs Logic ---
        const addMcqModal = document.getElementById('add-mcq-modal');
        const closeAddMcqBtn = document.getElementById('close-add-mcq-modal');
        const submitMcqBtn = document.getElementById('submit-mcq-btn');
        const mcqCategorySelect = document.getElementById('mcq-category');

        if (navAddMcq && mcqCategorySelect && addMcqModal) {
            navAddMcq.addEventListener('click', (e) => { 
                e.preventDefault(); 
                if (!isLoggedIn) {
                    showToast("Please login top right to add your own MCQs.");
                    return;
                }
                
                // Populate categories dropdown
                mcqCategorySelect.innerHTML = '<option value="">-- Choose Category --</option>';
                window.subjectsIndex.forEach(mainCat => {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = mainCat.name;
                    mainCat.subcategories.forEach(sub => {
                        const opt = document.createElement('option');
                        opt.value = sub.category;
                        opt.textContent = sub.category;
                        optgroup.appendChild(opt);
                    });
                    mcqCategorySelect.appendChild(optgroup);
                });

                addMcqModal.classList.remove('hidden');
            });
        }

        if (closeAddMcqBtn && addMcqModal) {
            closeAddMcqBtn.addEventListener('click', () => {
                addMcqModal.classList.add('hidden');
            });
        }

        if (submitMcqBtn && mcqCategorySelect) {
            submitMcqBtn.addEventListener('click', () => {
                const category = mcqCategorySelect.value;
                const questionText = document.getElementById('mcq-question').value;
                const optA = document.getElementById('mcq-opt-a').value;
                const optB = document.getElementById('mcq-opt-b').value;
                const optC = document.getElementById('mcq-opt-c').value;
                const optD = document.getElementById('mcq-opt-d').value;
                const correctOpt = document.getElementById('mcq-correct').value;

            if (!category || !questionText.trim() || !optA.trim() || !optB.trim() || !optC.trim() || !optD.trim() || !correctOpt) {
                alert("Please fill in all fields.");
                return;
            }

            submitMcqBtn.disabled = true;
            submitMcqBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

            const userQ = {
                category,
                q: questionText,
                options: [optA, optB, optC, optD],
                answer: parseInt(correctOpt),
                timestamp: new Date().toISOString()
            };

            // Send to backend (Firebase)
            window.dispatchEvent(new CustomEvent('submitPendingQuestion', { 
                detail: { 
                    userQ, 
                    onSuccess: () => {
                        showToast("Question submitted successfully! It will be reviewed by admin.");
                        addMcqModal.classList.add('hidden');
                        
                        // Form reset
                        mcqCategorySelect.value = '';
                        document.getElementById('mcq-question').value = '';
                        document.getElementById('mcq-opt-a').value = '';
                        document.getElementById('mcq-opt-b').value = '';
                        document.getElementById('mcq-opt-c').value = '';
                        document.getElementById('mcq-opt-d').value = '';
                        document.getElementById('mcq-correct').value = '';
                        
                        submitMcqBtn.disabled = false;
                        submitMcqBtn.textContent = 'Submit Question';
                    },
                    onError: (err) => {
                        alert("Submission failed: " + err);
                        submitMcqBtn.disabled = false;
                        submitMcqBtn.innerHTML = 'Submit Question <i class="fa-solid fa-paper-plane"></i>';
                    }
                } 
            }));
        });
        }

        if (closeExamModalBtn) closeExamModalBtn.addEventListener('click', closeExamModal);
        if (startExamBtn) startExamBtn.addEventListener('click', startTimedExam);

        examCountRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const count = parseInt(e.target.value);
                examDurationText.textContent = count === 100 ? "90 Minutes" : "45 Minutes";
            });
        });

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            const leaderboardModal = document.getElementById('leaderboard-modal');
            if (e.target === dashboardModal) closeDashboard();
            if (e.target === examModal) closeExamModal();
            if (e.target === leaderboardModal) closeLeaderboard();
            if (addMcqModal && e.target === addMcqModal) addMcqModal.classList.add('hidden');
            if (adminModal && e.target === adminModal) adminModal.classList.add('hidden');
            if (loginModal && e.target === loginModal) loginModal.classList.add('hidden');
        });

        const closeLeaderboardBtn = document.getElementById('close-leaderboard');
        if (closeLeaderboardBtn) closeLeaderboardBtn.addEventListener('click', closeLeaderboard);


        // Close review modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target === reviewModal) reviewModal.classList.add('hidden');
            const examModal = document.getElementById('exam-modal');
            const leaderboardModal = document.getElementById('leaderboard-modal');
            const dashboardModal = document.getElementById('dashboard-modal');
            if (e.target === dashboardModal) closeDashboard();
            if (e.target === examModal) closeExamModal();
            if (e.target === leaderboardModal) closeLeaderboard();
        });

        // Handle native back button navigation
        window.addEventListener('popstate', (e) => {
            const state = e.state;
            if (!state) {
                // We reached the very first entry (landing). 
                // Stay on main categories and re-push state to "trap" the back button.
                showMainCategories(true);
                const homePath = '?p=home';
                history.pushState({ screen: 'categories' }, '', homePath);
                return;
            }

            if (state.screen === 'categories') {
                if (state.folderData && state.mainCategory) {
                    showNestedSubcategories(state.mainCategory, state.folderData, true);
                } else if (state.mainCategory) {
                    showSubcategories(state.mainCategory, true);
                } else {
                    showMainCategories(true);
                }
            } else if (state.screen === 'set') {
                if (state.subcategoryData) {
                    startSubcategory(state.subcategoryData, true);
                }
            } else if (state.screen === 'quiz') {
                if (state.setIndex !== undefined) {
                    startSet(state.setIndex, true);
                }
            } else if (screens[state.screen]) {
                switchScreen(state.screen, true);
            }
        });

        // Parse initial URL
        handleInitialRoute();
        
        // Fetch jobs for the home screen
        fetchAndRenderJobs();

        // Warm up TTS engine to eliminate first-click latency on mobile
        if (window.Capacitor && typeof TextToSpeech !== 'undefined') {
            try {
                TextToSpeech.speak({
                    text: "Active",
                    lang: 'en-US',
                    rate: 1.0,
                    pitch: 1.0,
                    volume: 0.01 // Very low volume silent speak
                }).catch(e => console.log("TTS Warmup skip:", e));
            } catch (e) {}
        }
    }
    
    // Global Job Modal Functions
    window.openJobModal = function(encodedJobStr) {
        const job = JSON.parse(decodeURIComponent(encodedJobStr));
        document.getElementById('job-modal-title').innerText = job.title;
        
        const detailsContainer = document.getElementById('job-modal-details');
        detailsContainer.innerHTML = '';
        if (job.dept) {
            detailsContainer.innerHTML += `<p><strong>Department:</strong> ${job.dept}</p>`;
        }
        
        // Use formatPakDate if available
        let formattedDate = job.deadline;
        if(job.deadline && job.deadline.includes('-')) {
            const [y, m, d] = job.deadline.split('-');
            formattedDate = `${d}-${m}-${y}`;
        }
        detailsContainer.innerHTML += `<p><strong>Deadline:</strong> ${formattedDate}</p>`;
        
        const imgEl = document.getElementById('job-modal-image');
        if (job.image) {
            imgEl.src = job.image;
            imgEl.style.display = 'block';
        } else {
            imgEl.src = '';
            imgEl.style.display = 'none';
        }
        
        const linkBtn = document.getElementById('job-modal-link');
        if (job.link && job.link !== '#') {
            linkBtn.href = job.link;
            linkBtn.style.display = 'inline-block';
        } else {
            linkBtn.style.display = 'none';
        }
        
        document.getElementById('job-image-modal').classList.remove('hidden');
        
        // Attach close listeners every time modal opens
        const closeBtn = document.getElementById('close-job-modal');
        if (closeBtn) {
            closeBtn.onclick = () => {
                document.getElementById('job-image-modal').classList.add('hidden');
            };
        }
    };
    
    // Click outside modal to close
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('job-image-modal');
        if (modal && e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // --- Date Formatter ---
    function formatPakDate(dateString) {
        if(!dateString) return 'N/A';
        if(dateString.includes('-')) {
            const [y, m, d] = dateString.split('-');
            return `${d}-${m}-${y}`;
        }
        return new Date(dateString).toLocaleDateString('en-GB');
    }

    // --- Image Upload Handler ---
    (function setupImageUpload() {
        const fileInput = document.getElementById('admin-job-image-file');
        const hiddenInput = document.getElementById('admin-job-image');
        const previewDiv = document.getElementById('admin-job-image-preview');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Compress and convert to base64
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    // Compress: max 600px width, JPEG quality 0.6
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    const maxW = 600;
                    if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    const base64 = canvas.toDataURL('image/jpeg', 0.6);
                    
                    // Store in hidden input
                    if (hiddenInput) hiddenInput.value = base64;
                    
                    // Show preview
                    if (previewDiv) {
                        previewDiv.querySelector('img').src = base64;
                        previewDiv.style.display = 'block';
                    }
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    })();

    // --- Instant Display: Render from cache first ---
    function renderJobsFromCache() {
        try {
            const cached = localStorage.getItem('cachedJobs');
            if (cached) {
                const jobs = JSON.parse(cached);
                if (jobs.length > 0) {
                    renderJobCards(jobs);
                }
            }
        } catch(e) { /* ignore parse errors */ }
    }
    // Show cached jobs immediately on page load
    renderJobsFromCache();

    function renderJobCards(jobs) {
        const jobsSection = document.getElementById('job-alerts-section');
        const jobsList = document.getElementById('jobs-list');

        if (jobs.length > 0) {
            if (jobsSection) jobsSection.classList.remove('hidden');
            if (jobsList) {
                jobsList.innerHTML = '';
                jobsList.forEach(job => {
                    const card = document.createElement('div');
                    card.className = 'job-alert-card';
                    card.innerHTML = `
                        <div class="job-alert-info" style="cursor: pointer;" onclick="openJobModal('${encodeURIComponent(JSON.stringify(job))}')"> 
                            <div class="job-alert-title">${job.title}</div>
                            <div class="job-alert-meta">
                                ${job.dept ? `<span class="job-alert-dept"><i class="fa-solid fa-building"></i> ${job.dept}</span>` : ''}
                                <span class="job-alert-date"><i class="fa-regular fa-clock"></i> ${formatPakDate(job.deadline)}</span>
                            </div>
                        </div>
                        ${job.link && job.link !== '#' ? `<a href="${job.link}" target="_blank" class="job-alert-link"><i class="fa-solid fa-up-right-from-square"></i> Apply</a>` : ''}
                    `;
                    jobsList.appendChild(card);
                });
            }
        } else {
            if (jobsSection) jobsSection.classList.add('hidden');
        }
    }

    function fetchAndRenderJobs(isAdminView = false) {
        window.dispatchEvent(new CustomEvent('fetchJobs', {
            detail: {
                onSuccess: (jobs) => {
                    try { localStorage.setItem('cachedJobs', JSON.stringify(jobs)); } catch(e) {}
                    renderJobCards(jobs);
                    const adminJobsList = document.getElementById('admin-jobs-list');
                    if (adminJobsList) {
                        if (jobs.length > 0) {
                            adminJobsList.innerHTML = '';
                            jobs.forEach(job => {
                                const tr = document.createElement('tr');
                                tr.innerHTML = `
                                    <td><strong>${job.title}</strong></td>
                                    <td>${job.dept || 'N/A'}</td>
                                    <td>${formatPakDate(job.deadline)}</td>
                                    <td>
                                        <button class="icon-btn text-primary edit-job-btn" data-job='${JSON.stringify(job).replace(/'/g, "&apos;")}' title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                                        <button class="icon-btn text-danger delete-job-btn" data-id="${job.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                                    </td>
                                `;
                                adminJobsList.appendChild(tr);
                            });
                            
                            document.querySelectorAll('.edit-job-btn').forEach(btn => {
                                btn.addEventListener('click', (e) => {
                                    const button = e.target.closest('.edit-job-btn');
                                    if(!button) return;
                                    const job = JSON.parse(button.dataset.job.replace(/&apos;/g, "'"));
                                    document.getElementById('admin-job-title').value = job.title || '';
                                    document.getElementById('admin-job-dept').value = job.dept || '';
                                    document.getElementById('admin-job-deadline').value = job.deadline || '';
                                    document.getElementById('admin-job-link').value = job.link !== '#' ? job.link : '';
                                    if(document.getElementById('admin-job-image')) document.getElementById('admin-job-image').value = job.image || '';
                                    const previewDiv = document.getElementById('admin-job-image-preview');
                                    if (previewDiv && job.image) {
                                        previewDiv.querySelector('img').src = job.image;
                                        previewDiv.style.display = 'block';
                                    }
                                    const submitBtn = document.getElementById('admin-add-job-btn');
                                    submitBtn.dataset.editingId = job.id;
                                    document.getElementById('admin-add-job-btn-text').innerText = 'Update Alert';
                                    document.getElementById('admin-jobs').scrollIntoView({ behavior: 'smooth' });
                                });
                            });

                            document.querySelectorAll('.delete-job-btn').forEach(btn => {
                                btn.addEventListener('click', (e) => {
                                    const button = e.target.closest('.delete-job-btn');
                                    if(!button) return;
                                    if(!confirm("Are you sure you want to delete this job alert?")) return;
                                    const id = button.dataset.id;
                                    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                                    button.disabled = true;
                                    window.dispatchEvent(new CustomEvent('deleteJob', {
                                        detail: {
                                            jobId: id,
                                            onSuccess: () => {
                                                fetchAndRenderJobs(true);
                                                showToast("Job alert deleted.", true);
                                            },
                                            onError: (err) => {
                                                alert("Failed to delete: " + err);
                                                button.innerHTML = '<i class="fa-solid fa-trash"></i>';
                                                button.disabled = false;
                                            }
                                        }
                                    }));
                                });
                            });
                        } else {
                            adminJobsList.innerHTML = '<tr><td colspan="4" style="text-align:center;">No active job alerts.</td></tr>';
                        }
                    }
                },
                onError: (err) => {
                    console.log("Could not load jobs: " + err);
                }
            }
        }));
    }

    function handleInfoRoute(page) {
        updateMetaTags(page.charAt(0).toUpperCase() + page.slice(1) + " Us", "Learn more about McqMatrix", false);
        switchScreen(`${page}-screen`, true, {}, true);
    }

    function handleInitialRoute() {
        let path = new URLSearchParams(window.location.search).get('p');
        if (!path && window.location.hash) {
            path = window.location.hash.replace('#', '');
        }
        if (['about', 'contact', 'privacy'].includes(path)) {
            const pathUrl = '?p=' + path;
            history.replaceState({ screen: path }, '', pathUrl);
            history.pushState({ screen: path }, '', pathUrl);
            handleInfoRoute(path);
            return;
        }
        if (!path || path === 'home') {
            const homePath = '?p=home';
            history.replaceState({ screen: 'categories' }, '', homePath);
            history.pushState({ screen: 'categories' }, '', homePath);
            return;
        }
        if (path.startsWith('topics/')) {
            const topicParts = path.replace('topics/', '').split('/');
            const topicSlug = topicParts[0];
            const folderSlug = topicParts[1];
            const subjectMeta = window.subjectsIndex.find(s => s.slug === topicSlug);
            if (subjectMeta) {
                ensureSubjectLoaded(subjectMeta.slug).then(subjectData => {
                    if (!subjectData) return;
                    if (folderSlug) {
                        const folderObj = subjectData.subcategories.find(s => s.isFolder && (s.category || "").toLowerCase().replace(/ /g, '-') === folderSlug);
                        if (folderObj) {
                            const state = { screen: 'categories', mainCategory: subjectData, folderData: folderObj };
                            const formattedPath = '?p=' + path;
                            history.replaceState(state, '', formattedPath);
                            history.pushState(state, '', formattedPath);
                            showNestedSubcategories(subjectData, folderObj, true);
                            return;
                        }
                    }
                    const state = { screen: 'categories', mainCategory: subjectData };
                    const formattedPath = '?p=' + path;
                    history.replaceState(state, '', formattedPath);
                    history.pushState(state, '', formattedPath);
                    showSubcategories(subjectData, true);
                });
                return;
            }
        } else if (path.startsWith('practice/')) {
            const practiceSlug = path.replace('practice/', '');
            async function findAndStartPractice() {
                for (const subjectMeta of window.subjectsIndex) {
                    const subjectData = await ensureSubjectLoaded(subjectMeta.slug);
                    if (!subjectData) continue;
                    let foundSub = subjectData.subcategories.find(s => (s.category || "").toLowerCase().replace(/ /g, '-') === practiceSlug);
                    if (!foundSub) {
                        for (const sub of subjectData.subcategories) {
                            if (sub.isFolder && sub.subcategories) {
                                foundSub = sub.subcategories.find(s => (s.category || "").toLowerCase().replace(/ /g, '-') === practiceSlug);
                                if (foundSub) break;
                            }
                        }
                    }
                    if (foundSub) {
                        const state = { screen: 'set', subcategoryData: foundSub };
                        const formattedPath = '?p=' + path;
                        history.replaceState(state, '', formattedPath);
                        history.pushState(state, '', formattedPath);
                        startSubcategory(foundSub, true);
                        return true;
                    }
                }
                return false;
            }
            findAndStartPractice().then(found => {
                if (!found) showMainCategories();
            });
            return;
        }
        const homePath = window.location.protocol === 'file:' ? '#home' : '/home';
        history.replaceState({ screen: 'categories' }, '', homePath);
        history.pushState({ screen: 'categories' }, '', homePath);
    }

    function toggleTheme() {
        isDarkMode = !isDarkMode;
        if (isDarkMode) {
            document.body.setAttribute('data-theme', 'dark');
            themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
            themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            localStorage.setItem('theme', 'light');
        }
    }

    function toggleSound() {
        isSoundEnabled = !isSoundEnabled;
        if (isSoundEnabled) {
            soundToggleBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        } else {
            soundToggleBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        }
    }

    function playSound(isCorrect) {
        if (!isSoundEnabled) return;
        const sound = isCorrect ? soundCorrect : soundIncorrect;
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log('Audio play failed:', e));
        }
    }

    function shuffleArray(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    let isTranslated = false;
    let originalQuestionText = "";
    let originalOptionsText = [];
    const translationCache = new Map();

    async function translateText(text, targetLang = 'ur') {
        if (translationCache.has(text)) return translationCache.get(text);
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURI(text)}`;
            const response = await fetch(url);
            const data = await response.json();
            const translatedText = data[0].map(item => item[0]).join('');
            translationCache.set(text, translatedText);
            return translatedText;
        } catch (error) {
            console.error("Translation Error:", error);
            return text;
        }
    }

    async function toggleTranslation() {
        if (!translateBtn) return;
        isTranslated = !isTranslated;
        const icon = translateBtn.querySelector('i');
        const textSpan = translateBtn.querySelector('.trans-text');
        if (isTranslated) {
            translateBtn.classList.add('active');
            icon.className = 'fa-solid fa-language';
            textSpan.textContent = "English";
        } else {
            translateBtn.classList.remove('active');
            icon.className = 'fa-solid fa-language';
            textSpan.textContent = "اردو";
        }
        if (screens.quiz.classList.contains('active') && originalQuestionText) {
            if (isTranslated) {
                icon.className = 'fa-solid fa-spinner fa-spin';
                textSpan.textContent = "Translating...";
                const translatedQ = await translateText(originalQuestionText);
                questionText.textContent = translatedQ;
                questionText.style.direction = "rtl";
                questionText.style.fontFamily = "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif";
                const optionBtns = document.querySelectorAll('.option-btn');
                for (let i = 0; i < optionBtns.length; i++) {
                    const translatedOpt = await translateText(originalOptionsText[i]);
                    optionBtns[i].textContent = translatedOpt;
                    optionBtns[i].style.direction = "rtl";
                    optionBtns[i].style.fontFamily = "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif";
                }
                icon.className = 'fa-solid fa-language';
                textSpan.textContent = "English";
            } else {
                questionText.textContent = originalQuestionText;
                questionText.style.direction = "ltr";
                questionText.style.fontFamily = "inherit";
                const optionBtns = document.querySelectorAll('.option-btn');
                for (let i = 0; i < optionBtns.length; i++) {
                    optionBtns[i].textContent = originalOptionsText[i];
                    optionBtns[i].style.direction = "ltr";
                    optionBtns[i].style.fontFamily = "inherit";
                }
            }
        }
    }

    async function readAloud() {
        if (isNativeSpeaking) {
            if (typeof TextToSpeech !== 'undefined') await TextToSpeech.stop();
            isNativeSpeaking = false;
            return;
        }
        const textToRead = questionText.textContent;
        const optionsToRead = Array.from(document.querySelectorAll('.option-btn')).map(btn => btn.textContent).join('. ');
        const fullText = `Question. ${textToRead}. Options are. ${optionsToRead}`;
        if (typeof TextToSpeech !== 'undefined') {
            isNativeSpeaking = true;
            await TextToSpeech.speak({
                text: fullText,
                lang: isTranslated ? 'ur-PK' : 'en-US',
                rate: 1.0, pitch: 1.0, volume: 1.0, category: 'ambient'
            });
            isNativeSpeaking = false;
        } else {
            const utterance = new SpeechSynthesisUtterance(fullText);
            utterance.lang = isTranslated ? 'ur-PK' : 'en-US';
            window.speechSynthesis.speak(utterance);
        }
    }

    function openExamModal() {
        if (!examSubjectList) return;

        if (examModal) examModal.classList.add('hidden');
    }

    async function startTimedExam() {
        const selectedSubjectNames = Array.from(document.querySelectorAll('input[name="exam-subject"]:checked'))
            .map(cb => cb.value);

        if (selectedSubjectNames.length === 0) {
            alert("Please select at least one subject.");
            return;
        }

        const countRadio = document.querySelector('input[name="exam-count"]:checked');
        totalExamQuestions = parseInt(countRadio.value);

        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');

        let pool = [];
        for (const name of selectedSubjectNames) {
            const meta = window.subjectsIndex.find(m => m.name === name);
            if (meta) {
                const subjectData = await ensureSubjectLoaded(meta.slug);
                if (subjectData && subjectData.subcategories) {
                    subjectData.subcategories.forEach(sub => {
                        if (sub.questions) pool = pool.concat(sub.questions);
                        if (sub.isFolder && sub.subcategories) {
                            sub.subcategories.forEach(n => {
                                if (n.questions) pool = pool.concat(n.questions);
                            });
                        }
                    });
                }
            }
        }
        
        if (loadingOverlay) loadingOverlay.classList.add('hidden');

        if (pool.length === 0) {
            alert("No questions found in selected subjects.");
            return;
        }

        currentSetQuestions = shuffleArray([...pool]).slice(0, totalExamQuestions);
        totalExamQuestions = currentSetQuestions.length; // in case pool < target

        // Initialize Exam State
        isExamMode = true;
        currentQuestionIndex = 0;
        score = 0;
        examTimeLeft = totalExamQuestions === 100 ? 90 * 60 : 45 * 60;

        closeExamModal();
        switchScreen('quiz');
        renderQuestion();
        startExamTimer();
    }

    function startExamTimer() {
        clearInterval(examTimerInterval);
        clearInterval(timerInterval); // stop per-question timer

        const timerContainer = document.getElementById('timer-container');
        if (timerContainer) timerContainer.classList.add('hidden'); // Hide per-question timer bar

        // Create or Show Global Exam Timer (if we had a dedicated UI for it, let's reuse timer-text for now or add a floating one)
        // For now, let's just update the existing timer-text but keep it static/global
        if (timeLeftText) timeLeftText.parentElement.style.color = "var(--primary)";

        examTimerInterval = setInterval(() => {
            examTimeLeft--;
            updateExamTimerDisplay();

            if (examTimeLeft <= 0) {
                clearInterval(examTimerInterval);
                showResults();
            }
        }, 1000);
    }

    function updateExamTimerDisplay() {
        const minutes = Math.floor(examTimeLeft / 60);
        const seconds = examTimeLeft % 60;
        if (timeLeftText) {
            timeLeftText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    let userStats = JSON.parse(localStorage.getItem('userStats')) || {
        totalQuizzes: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        subjectStats: {},
        scoreHistory: []
    };

    let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
    let mistakesBank = JSON.parse(localStorage.getItem('mistakesBank')) || [];
    let completedQuizzes = JSON.parse(localStorage.getItem('completedQuizzes')) || [];

    // --- Quiz Completion Helpers ---
    function markQuizCompleted(subject, subcategory, setIndex) {
        const quizId = `${subject}|${subcategory}|${setIndex}`;
        if (!completedQuizzes.includes(quizId)) {
            completedQuizzes.push(quizId);
            localStorage.setItem('completedQuizzes', JSON.stringify(completedQuizzes));
            window.dispatchEvent(new CustomEvent('saveToCloud', { detail: { type: 'completedQuizzes', data: completedQuizzes } }));
        }
    }

    function isQuizCompleted(subject, subcategory, setIndex) {
        const quizId = `${subject}|${subcategory}|${setIndex}`;
        return completedQuizzes.includes(quizId);
    }

    // --- Firebase Sync Integration ---
    window.addEventListener('cloudDataLoaded', (e) => {
        const data = e.detail;
        if (data.userStats) userStats = data.userStats;
        if (data.bookmarks) bookmarks = data.bookmarks;
        if (data.mistakesBank) mistakesBank = data.mistakesBank;
        if (data.completedQuizzes) completedQuizzes = data.completedQuizzes;

        // Persist cloud data to local storage
        localStorage.setItem('userStats', JSON.stringify(userStats));
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        localStorage.setItem('mistakesBank', JSON.stringify(mistakesBank));
        localStorage.setItem('completedQuizzes', JSON.stringify(completedQuizzes));

        // Refresh UI if open
        if (!dashboardModal.classList.contains('hidden')) {
            renderDashboard();
        }
        console.log('Firebase Cloud data successfully synced and merged into local state.');
    });

    function saveStats() {
        localStorage.setItem('userStats', JSON.stringify(userStats));
        window.dispatchEvent(new CustomEvent('saveToCloud', { detail: { type: 'stats', data: userStats } }));
    }

    function updateStats(subjectName, questionsCount, correctCount) {
        userStats.totalQuizzes++;
        userStats.totalQuestions += questionsCount;
        userStats.totalCorrect += correctCount;

        if (!userStats.subjectStats[subjectName]) {
            userStats.subjectStats[subjectName] = { total: 0, correct: 0 };
        }
        userStats.subjectStats[subjectName].total += questionsCount;
        userStats.subjectStats[subjectName].correct += correctCount;

        // Push recent score percentage
        const currentScorePercent = Math.round((correctCount / questionsCount) * 100);
        if (!userStats.scoreHistory) userStats.scoreHistory = [];
        userStats.scoreHistory.push(currentScorePercent);

        // Keep only last 10 scores for trend
        if (userStats.scoreHistory.length > 10) {
            userStats.scoreHistory.shift();
        }

        saveStats();
    }


    // Bookmark Logic
    function toggleBookmark() {
        const question = currentSetQuestions[currentQuestionIndex];
        // Use a unique ID based on question text
        const qId = question.q.substring(0, 50);

        const existingIndex = bookmarks.findIndex(b => b.qId === qId);

        if (existingIndex > -1) {
            bookmarks.splice(existingIndex, 1);
            if (bookmarkBtn) {
                bookmarkBtn.classList.remove('active');
                bookmarkBtn.querySelector('i').className = 'fa-regular fa-bookmark';
            }
        } else {
            bookmarks.push({
                ...question,
                qId: qId,
                categorySource: currentSubcategoryData.category,
                timestamp: new Date().getTime()
            });
            if (bookmarkBtn) {
                bookmarkBtn.classList.add('active');
                bookmarkBtn.querySelector('i').className = 'fa-solid fa-bookmark';
            }
        }

        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        window.dispatchEvent(new CustomEvent('saveToCloud', { detail: { type: 'bookmarks', data: bookmarks } }));
        // Update home screen visibility if needed
    }

    // Mistake Bank Logic
    function addToMistakesBank(question) {
        const qId = question.q.substring(0, 50);
        const existing = mistakesBank.find(m => m.qId === qId);
        if (!existing) {
            mistakesBank.push({
                ...question,
                qId: qId,
                correctStreak: 0,
                addedAt: new Date().getTime()
            });
            saveMistakes();
        }
    }

    function handleMistakeCorrection(questionText) {
        const qId = questionText.substring(0, 50);
        const index = mistakesBank.findIndex(m => m.qId === qId);
        if (index > -1) {
            mistakesBank[index].correctStreak++;
            // If answered correctly twice in a row, remove from mistakes bank
            if (mistakesBank[index].correctStreak >= 2) {
                mistakesBank.splice(index, 1);
            }
            saveMistakes();
        }
    }

    function saveMistakes() {
        localStorage.setItem('mistakesBank', JSON.stringify(mistakesBank));
        window.dispatchEvent(new CustomEvent('saveToCloud', { detail: { type: 'mistakes', data: mistakesBank } }));
    }

    function startMistakesQuiz() {
        updateNavActiveState('nav-mistakes');
        if (mistakesBank.length === 0) {
            alert("No mistakes yet! When you answer questions incorrectly, they will be saved here for review.");
            return;
        }

        currentSetQuestions = shuffleArray([...mistakesBank]);
        currentQuestionIndex = 0;
        score = 0;

        currentSubcategoryData = null; // Important for back button logic
        currentCategoryTitle.textContent = `Mistake Bank Review (${mistakesBank.length})`;
        switchScreen('quiz');
        renderQuestion();
    }

    function openDashboard() {
        renderDashboard();
        dashboardModal.classList.remove('hidden');
    }

    function closeDashboard() {
        dashboardModal.classList.add('hidden');
    }

    // --- Share Logic ---
/* General share functions removed. Native share API is now used for a more professional experience. */

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Link copied to clipboard!");
        }).catch(err => {
            console.error('Failed to copy: ', err);
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast("Link copied to clipboard!");
        });
    }

    function showToast(message) {
        const toast = document.getElementById('copy-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }


    // --- PWA Manual Install Logic ---
    let deferredPrompt;
    const installAppBtn = document.getElementById('install-app-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        // Show the install button in the header
        if (installAppBtn) installAppBtn.classList.remove('hidden');
    });

    if (installAppBtn) {
        installAppBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                // Show the prompt
                deferredPrompt.prompt();
                // Wait for the user to respond to the prompt
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                // We've used the prompt, and can't use it again, throw it away
                deferredPrompt = null;
                installAppBtn.classList.add('hidden');
            }
        });
    }

    // Check if app is successfully installed
    window.addEventListener('appinstalled', () => {
        if (installAppBtn) installAppBtn.classList.add('hidden');
        showToast("App installed successfully! Check your home screen.");
        deferredPrompt = null;
    });


    // --- Leaderboard Logic ---
    function openLeaderboard() {
        const modal = document.getElementById('leaderboard-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        fetchLeaderboardData();
    }

    function closeLeaderboard() {
        const modal = document.getElementById('leaderboard-modal');
        if (modal) modal.classList.add('hidden');
    }

    function fetchLeaderboardData() {
        const tbody = document.getElementById('leaderboard-tbody');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...<i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

        // Dispatch custom event to let Firebase handle fetching
        window.dispatchEvent(new CustomEvent('requestLeaderboard'));
    }

    window.addEventListener('leaderboardDataLoaded', (e) => {
        const data = e.detail;
        const tbody = document.getElementById('leaderboard-tbody');
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No data available yet. Be the first to take a quiz!</td></tr>';
            return;
        }

        data.forEach((user, index) => {
            const rank = index + 1;
            let rankClass = '';
            let rankIcon = rank;
            if (rank === 1) { rankClass = 'rank-1'; rankIcon = '<i class="fa-solid fa-trophy"></i>'; }
            else if (rank === 2) { rankClass = 'rank-2'; rankIcon = '<i class="fa-solid fa-medal"></i>'; }
            else if (rank === 3) { rankClass = 'rank-3'; rankIcon = '<i class="fa-solid fa-medal"></i>'; }

            const totalQ = user.userStats?.totalQuestions || 0;
            const totalC = user.userStats?.totalCorrect || 0;
            const avgScore = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;
            const quizzes = user.userStats?.totalQuizzes || 0;
            const name = user.displayName || "Anonymous Scholar";

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="${rankClass}">${rankIcon}</td>
                <td style="font-weight: 500;">${name}</td>
                <td>${quizzes}</td>
                <td>${totalC}</td>
                <td><span style="background: rgba(16, 185, 129, 0.1); color: var(--success); padding: 0.2rem 0.6rem; border-radius: 20px; font-weight: bold;">${avgScore}%</span></td>
            `;
            tbody.appendChild(tr);
        });
    });

    function resetStats() {
        if (confirm("Are you sure you want to reset all your progress? This cannot be undone.")) {
            userStats = {
                totalQuizzes: 0,
                totalQuestions: 0,
                totalCorrect: 0,
                subjectStats: {},
                scoreHistory: []
            };
            saveStats();
            renderDashboard();
        }
    }

    function renderDashboard() {
        document.getElementById('stats-total-quizzes').textContent = userStats.totalQuizzes;

        const avgScore = userStats.totalQuestions > 0
            ? Math.round((userStats.totalCorrect / userStats.totalQuestions) * 100)
            : 0;
        document.getElementById('stats-avg-score').textContent = `${avgScore}%`;
        document.getElementById('stats-total-correct').textContent = userStats.totalCorrect;

        const list = document.getElementById('subject-progress-list');
        list.innerHTML = '';

        let strongestSubject = { name: "N/A", accuracy: -1 };
        let weakestSubject = { name: "N/A", accuracy: 101 };

        const subjectIcons = {
            "Islamic Studies": "fa-star-and-crescent",
            "General Knowledge": "fa-earth-asia",
            "Pakistan Studies": "fa-moon",
            "English": "fa-spell-check",
            "Mathematics": "fa-calculator",
            "Everyday Science": "fa-microscope",
            "Computer Science": "fa-laptop-code",
            "Urdu": "fa-pen-nib",
            "Current Affairs": "fa-newspaper",
            "Pedagogy": "fa-chalkboard-user",
            "Geography": "fa-map-location-dot",
            "default": "fa-book-open-reader"
        };

        Object.keys(userStats.subjectStats).forEach(subject => {
            const stats = userStats.subjectStats[subject];
            const percentage = Math.round((stats.correct / stats.total) * 100);
            const iconClass = subjectIcons[subject] || subjectIcons["default"];

            if (percentage > strongestSubject.accuracy) {
                strongestSubject = { name: subject, accuracy: percentage };
            }
            if (percentage < weakestSubject.accuracy) {
                weakestSubject = { name: subject, accuracy: percentage };
            }

            // Determine Mastery Level
            let masteryClass = '';
            let masteryLabel = '';
            if (percentage >= 75) {
                masteryClass = 'mastery-expert';
                masteryLabel = 'Expert';
            } else if (percentage >= 40) {
                masteryClass = 'mastery-intermediate';
                masteryLabel = 'Intermediate';
            } else {
                masteryClass = 'mastery-novice';
                masteryLabel = 'Novice';
            }

            const item = document.createElement('div');
            item.className = 'progress-item-premium';
            item.innerHTML = `
                <div class="progress-icon-wrapper">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div class="progress-content-premium">
                    <div class="progress-label-row">
                        <span class="subject-name-premium">${subject}</span>
                        <span class="subject-percent-premium">${percentage}%</span>
                    </div>
                    <div class="progress-bar-container-premium">
                        <div class="progress-bar-fill-premium" style="width: ${percentage}%"></div>
                    </div>
                    <div class="progress-sub-row">
                        <span class="mastery-badge-premium ${masteryClass}">${masteryLabel}</span>
                        <span class="subject-ratio-premium">${stats.correct} / ${stats.total} correct</span>
                    </div>
                </div>
            `;
            list.appendChild(item);
        });

        // Add Insights if data exists
        if (Object.keys(userStats.subjectStats).length > 0) {
            const insightsDiv = document.createElement('div');
            insightsDiv.className = 'dashboard-insights-premium';
            insightsDiv.innerHTML = `
                <div class="insight-card-premium">
                    <i class="fa-solid fa-crown" style="color: var(--accent);"></i>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Strongest Subject</span>
                        <span style="font-size:0.9rem; font-weight:700;">${strongestSubject.name} (${strongestSubject.accuracy}%)</span>
                    </div>
                </div>
                <div class="insight-card-premium">
                    <i class="fa-solid fa-arrow-trend-down" style="color: var(--danger);"></i>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Needs Focus</span>
                        <span style="font-size:0.9rem; font-weight:700;">${weakestSubject.name} (${weakestSubject.accuracy}%)</span>
                    </div>
                </div>
            `;
            list.prepend(insightsDiv);
        }

        if (Object.keys(userStats.subjectStats).length === 0) {
            list.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem; background: rgba(255,255,255,0.03); border-radius: 15px; border: 1px dashed var(--border-color);"><i class="fa-solid fa-chart-simple" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i><p>No data yet. Take a quiz to unlock your personalized dashboard!</p></div>';
        }

        // Render Score Trend Chart
        const trendChart = document.getElementById('score-trend-chart');
        if (trendChart && userStats.scoreHistory && userStats.scoreHistory.length > 0) {
            trendChart.innerHTML = '';
            // Only show last 8-10 quizzes for better look
            const historyToShow = userStats.scoreHistory.slice(-8);
            historyToShow.forEach((score, index) => {
                const barContainer = document.createElement('div');
                barContainer.className = 'trend-bar-container';

                barContainer.innerHTML = `
                    <div class="trend-bar-premium" style="height: ${Math.max(score, 5)}%;">
                        <div class="trend-tooltip">Quiz ${userStats.scoreHistory.length - historyToShow.length + index + 1}: ${score}%</div>
                    </div>
                    <div class="trend-label">Q${userStats.scoreHistory.length - historyToShow.length + index + 1}</div>
                `;
                trendChart.appendChild(barContainer);
            });
        } else if (trendChart) {
            trendChart.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem; width: 100%; text-align: center; padding: 2rem;">Take a quiz to see your performance trend!</span>';
        }
    }

    function findMainCategoryBySub(subName) {
        if (subName === 'Daily MCQs' || subName === 'Full Mock Test') return "Mixed Tests";
        for (const mainCat of window.subjectsIndex) {
            if (mainCat.subcategories.some(sub => sub.category === subName)) {
                return mainCat.name;
            }
        }
        return "Others";
    }

    function switchScreen(screenName, isPopState = false, additionalState = {}, skipScroll = false) {
        stopSpeech(); // Stop audio when leaving screen
        Object.values(screens).forEach(screen => screen.classList.remove('active'));
        if (screens[screenName]) screens[screenName].classList.add('active');
        
        if (!skipScroll) {
            window.scrollTo(0, 0);
        }

        if (!isPopState) {
            const state = { screen: screenName, ...additionalState };
            let pathName = screenName;

            // Map the screen names to clean URLs
            if (screenName === 'categories' && !additionalState.mainCategory) {
                pathName = 'home';
            } else if (screenName === 'categories' && additionalState.mainCategory) {
                const name = (additionalState.mainCategory.name || "").toLowerCase().replace(/ /g, '-');
                if (additionalState.folderData) {
                    const folderName = (additionalState.folderData.category || "").toLowerCase().replace(/ /g, '-');
                    pathName = 'topics/' + name + '/' + folderName;
                } else {
                    pathName = 'topics/' + name;
                }
            } else if (screenName === 'set' && additionalState.subcategoryData) {
                const name = (additionalState.subcategoryData.category || "").toLowerCase().replace(/ /g, '-');
                pathName = 'practice/' + name;
            } else if (screenName === 'quiz' && additionalState.setIndex !== undefined) {
                pathName = 'quiz/set-' + (additionalState.setIndex + 1);
            } else if (['about', 'contact', 'privacy'].includes(screenName)) {
                pathName = screenName;
            }

            // Use query parameters for all environments to guarantee SEO visibility and fix GitHub Pages 404s
            const finalPath = '?p=' + pathName;
            try {
                history.pushState(state, '', finalPath);
                console.log("URL pushed successfully:", finalPath);
            } catch (e) {
                console.error("Error pushing state:", e);
                // Last fallback: use hashes if pushState fails
                history.pushState(state, '', '#' + pathName);
            }
        }
    }

    const nameCache = new Map();
    function cleanName(name) {
        if (!name) return "";
        if (nameCache.has(name)) return nameCache.get(name);

        // 1. Remove Urdu/Arabic characters and surrounding brackets
        let cleaned = name.replace(/\s*[\(\-]?[\u0600-\u06FF\s،۔؛؟]+\)?/g, '').trim();
        
        // 2. Insert spaces around symbols like '&' that appear concatenated
        cleaned = cleaned.replace(/([^\s])&([^\s])/g, '$1 & $2');
        
        // 3. Insert spaces between CamelCase words (e.g., "PlantAnatomy" -> "Plant Anatomy")
        cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
        
        // 4. Final cleanup of multiple spaces
        const result = cleaned.replace(/\s+/g, ' ').trim();
        nameCache.set(name, result);
        return result;
    }

    // New Pre-cleaning engine for ultra-fast performance
    function preCleanAllData(data) {
        data.forEach(cat => {
            if (cat.name) cat.name = cleanName(cat.name);
            if (cat.subcategories) {
                cat.subcategories.forEach(sub => {
                    if (sub.category) sub.category = cleanName(sub.category);
                    if (sub.isFolder && sub.subcategories) {
                        sub.subcategories.forEach(nested => {
                            if (nested.category) nested.category = cleanName(nested.category);
                        });
                    }
                });
            }
        });
    }

    function countCatQuestions(cat) {
        let count = 0;
        if (cat.questions) count += cat.questions.length;
        if (cat.subcategories) {
            cat.subcategories.forEach(sub => {
                count += countCatQuestions(sub);
            });
        }
        return count;
    }

    function renderCategories() {
        let html = '';
        window.subjectsIndex.forEach((mainCat, index) => {
            html += `
                <div class="category-card" data-type="category" data-index="${index}">
                    <div class="category-icon">
                        <i class="fa-solid ${mainCat.icon || 'fa-book-open'}"></i>
                    </div>
                    <h3>${mainCat.name}</h3>
                    <p>${mainCat.topicCount} Topics | ${mainCat.mcqCount.toLocaleString()} MCQs</p>
                </div>
            `;
        });
        categoriesGrid.innerHTML = html;
    }

    // Set up a single Event Listener for the entire grid (Event Delegation)
    if (categoriesGrid) {
        categoriesGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.category-card');
            if (!card) return;

            const type = card.dataset.type;
            const index = parseInt(card.dataset.index);

            if (type === 'category') {
                const subjectMeta = window.subjectsIndex[index]; ensureSubjectLoaded(subjectMeta.slug).then(subjectData => { if (subjectData) showSubcategories(subjectData); });
            } else if (type === 'subcategory') {
                const sub = currentMainCategory.subcategories[index];
                if (card.dataset.folder === 'true') {
                    showNestedSubcategories(currentMainCategory, sub);
                } else {
                    startSubcategory(sub);
                }
            } else if (type === 'nested') {
                startSubcategory(currentFolderData.subcategories[index]);
            }
        });
    }

    function showMainCategories(isPopState = false, skipScroll = false) {
        updateNavActiveState('nav-home');
        currentMainCategory = null;
        currentSubcategoryData = null;
        currentFolderData = null;
        if (sectionTitle) sectionTitle.textContent = "Select a Subject";
        updateMetaTags("Home", "All Topics", false);


        if (backToPrevCategoryBtn) backToPrevCategoryBtn.classList.add('hidden');
        renderCategories();
        switchScreen('categories', isPopState, {}, skipScroll);
    }

    function showSubcategories(mainCat, isPopState = false, skipScroll = false) {
        currentMainCategory = mainCat;
        currentFolderData = null;

        let html = '';
        mainCat.subcategories.forEach((sub, index) => {
            const isFolder = sub.isFolder === true;
            html += `
                <div class="category-card" data-type="subcategory" data-index="${index}" data-folder="${isFolder}">
                    <div class="category-icon">
                        <i class="fa-solid ${sub.icon || (isFolder ? 'fa-folder' : 'fa-book-open')}"></i>
                    </div>
                    <h3>${sub.category}</h3>
                    <p>${isFolder ? (sub.subcategories ? sub.subcategories.length : 0) + ' Topics' : (sub.questions ? sub.questions.length : 0) + ' Questions'}</p>
                </div>
            `;
        });
        categoriesGrid.innerHTML = html;

        // Update header or title if needed
        const sectionTitleElement = document.querySelector('#category-screen h2');
        if (sectionTitleElement) sectionTitleElement.textContent = cleanName(mainCat.name);

        updateMetaTags(cleanName(mainCat.name), "Various Subjects", false);
        if (backToPrevCategoryBtn) backToPrevCategoryBtn.classList.remove('hidden');
        switchScreen('categories', isPopState, { mainCategory: mainCat }, skipScroll);
    }

    function showNestedSubcategories(mainCat, folderData, isPopState = false, skipScroll = false) {
        currentMainCategory = mainCat;
        currentFolderData = folderData;

        let html = '';
        if (folderData.subcategories) {
            folderData.subcategories.forEach((sub, index) => {
                html += `
                    <div class="category-card" data-type="nested" data-index="${index}">
                        <div class="category-icon">
                            <i class="fa-solid ${sub.icon || 'fa-book-open'}"></i>
                        </div>
                        <h3>${sub.category}</h3>
                        <p>${sub.questions ? sub.questions.length : 0} Questions</p>
                    </div>
                `;
            });
        }
        categoriesGrid.innerHTML = html;

        const sectionTitleElement = document.querySelector('#category-screen h2');
        if (sectionTitleElement) sectionTitleElement.textContent = `${mainCat.name} - ${folderData.category}`;

        updateMetaTags(folderData.category, mainCat.name, false);
        if (backToPrevCategoryBtn) backToPrevCategoryBtn.classList.remove('hidden');
        switchScreen('categories', isPopState, { mainCategory: mainCat, folderData: folderData }, skipScroll);
    }

    function startSubcategory(subData, isPopState = false) {
        currentSubcategoryData = subData;

        // Deep copy and shuffle questions for this subcategory
        allCategoryQuestions = shuffleArray(JSON.parse(JSON.stringify(subData.questions)));

        // Inject original category into each question for analytics
        allCategoryQuestions.forEach(q => q.originalCategory = subData.category);

        // Calculate total sets (10 questions per set)
        const setSize = 10;
        totalSets = Math.ceil(allCategoryQuestions.length / setSize);

        setCategoryTitle.textContent = subData.category;
        updateMetaTags(subData.category, currentMainCategory?.name || "Topic", true);

        renderSets();
        switchScreen('set', isPopState, { subcategoryData: subData });
    }

    function renderSets() {
        setsGrid.innerHTML = '';
        const setSize = 10;

        for (let i = 0; i < totalSets; i++) {
            const startIdx = i * setSize;
            const endIdx = Math.min((i + 1) * setSize, allCategoryQuestions.length);
            const setQuestionsCount = endIdx - startIdx;
            const setName = `Quiz ${i + 1}`;
            
            const mainCatName = findMainCategoryBySub(currentSubcategoryData.category);
            const isCompleted = isQuizCompleted(mainCatName, currentSubcategoryData.category, i);

            const card = document.createElement('div');
            card.className = `category-card ${isCompleted ? 'completed' : ''}`;
            card.innerHTML = `
                ${isCompleted ? '<div class="completed-badge"><i class="fa-solid fa-check"></i> Completed</div>' : ''}
                <div class="category-icon">
                    <i class="fa-solid fa-layer-group"></i>
                </div>
                <h3>${setName}</h3>
                <p>${setQuestionsCount} Questions</p>
            `;
            card.addEventListener('click', () => startSet(i));
            setsGrid.appendChild(card);
        }
    }

    function handleBackButtonClick() {
        if (isExamMode) {
            if (!confirm("Are you sure you want to exit the exam? All progress will be lost.")) return;
            clearInterval(examTimerInterval);
            isExamMode = false;
        }

        if (currentSubcategoryData) {
            switchScreen('set');
        } else {
            handleSetsBackButtonClick();
        }
    }

    function handleSetsBackButtonClick() {
        if (currentFolderData && currentMainCategory) {
            showNestedSubcategories(currentMainCategory, currentFolderData);
        } else if (currentMainCategory) {
            showSubcategories(currentMainCategory);
        } else {
            showMainCategories();
        }
    }

    function handleCategoryBackButtonClick() {
        if (currentFolderData && currentMainCategory) {
            // We were in a folder, go back to top-level subcategories of the same subject
            showSubcategories(currentMainCategory);
        } else {
            // We were in subcategories, go back to main subjects
            showMainCategories();
        }
    }

    // --- Audio Reading (Text-to-Speech) Logic ---
    async function readAloud() {
        const question = currentSetQuestions[currentQuestionIndex];
        if (!question) return;

        // Immediate UI feedback for better UX
        updateReadAloudBtnUI(true);

        // Toggle logic for Native TTS 🛠️✨🏁🛠️🚀
        if (window.Capacitor && TextToSpeech) {
            if (isNativeSpeaking) {
                try {
                    await TextToSpeech.stop();
                    isNativeSpeaking = false;
                    updateReadAloudBtnUI(false);
                } catch (e) { console.error("TTS Stop Error:", e); }
                return;
            }

            let textToRead = `Question: ${question.q}. `;
            const optionLabels = ['A', 'B', 'C', 'D'];
            question.options.forEach((opt, index) => {
                textToRead += `Option ${optionLabels[index]}: ${opt}. `;
            });

            try {
                isNativeSpeaking = true;
                await TextToSpeech.speak({
                    text: textToRead,
                    lang: 'en-US',
                    rate: 1.0,
                    pitch: 1.0,
                    volume: 1.0
                    // Removed category: 'ambient' to reduce system-level audio routing latency
                });
                isNativeSpeaking = false;
                updateReadAloudBtnUI(false);
            } catch (err) {
                console.error('Native TTS Error:', err);
                isNativeSpeaking = false;
                updateReadAloudBtnUI(false);
                alert('Voice speech failed.');
            }
            return;
        }

        // Web Fallback Toggle
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            updateReadAloudBtnUI(false);
            return;
        }

        let webText = `Question: ${question.q}. `;
        const webLabels = ['A', 'B', 'C', 'D'];
        question.options.forEach((opt, index) => {
            webText += `Option ${webLabels[index]}: ${opt}. `;
        });

        const utterance = new SpeechSynthesisUtterance(webText);
        const voices = window.speechSynthesis.getVoices();
        let voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || 
                    voices.find(v => v.lang.startsWith('en'));
        if (voice) utterance.voice = voice;
        utterance.rate = 0.9;
        updateReadAloudBtnUI(true);
        utterance.onend = () => updateReadAloudBtnUI(false);
        window.speechSynthesis.speak(utterance);
    }

    function updateReadAloudBtnUI(isSpeaking) {
        const readBtn = document.getElementById('read-aloud-btn');
        if (!readBtn) return;
        const icon = readBtn.querySelector('i');
        if (isSpeaking) {
            icon.classList.add('pulse');
            readBtn.classList.add('active');
        } else {
            icon.classList.remove('pulse');
            readBtn.classList.remove('active');
        }
    }

    // Stop speaking when user goes to next question or leaves screen
    function stopSpeech() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        const readBtn = document.getElementById('read-aloud-btn');
        if (readBtn) {
            const icon = readBtn.querySelector('i');
            icon.className = 'fa-solid fa-volume-high';
            icon.classList.remove('pulse');
        }
    }

    function startSet(setIndex, isPopState = false) {
        currentSetIndex = setIndex;
        const setSize = 10;
        const startIdx = setIndex * setSize;
        const endIdx = Math.min((setIndex + 1) * setSize, allCategoryQuestions.length);

        currentSetQuestions = allCategoryQuestions.slice(startIdx, endIdx);
        currentQuestionIndex = 0;
        score = 0;

        currentCategoryTitle.textContent = `${currentSubcategoryData.category} - Quiz ${setIndex + 1} of ${totalSets}`;
        switchScreen('quiz', isPopState, { setIndex: setIndex });
        renderQuestion();
    }

    // Mulberry32 seeded PRNG
    function mulberry32(a) {
        return function () {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    async function startDailyMCQs() {
        updateNavActiveState('nav-daily');
        
        const today = new Date();
        const seed = parseInt(`${today.getFullYear()}${today.getMonth()}${today.getDate()}`, 10);
        const rng = mulberry32(seed);
        
        let shuffledIndexes = [...window.subjectsIndex];
        for (let i = shuffledIndexes.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [shuffledIndexes[i], shuffledIndexes[j]] = [shuffledIndexes[j], shuffledIndexes[i]];
        }
        
        const selectedMetas = shuffledIndexes.slice(0, 3);
        let allQs = [];
        
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
        
        for (const meta of selectedMetas) {
            const subjectData = await ensureSubjectLoaded(meta.slug);
            if (subjectData && subjectData.subcategories) {
                subjectData.subcategories.forEach(subCat => {
                    if (subCat.questions) allQs = allQs.concat(subCat.questions);
                    if (subCat.isFolder && subCat.subcategories) {
                        subCat.subcategories.forEach(n => {
                            if (n.questions) allQs = allQs.concat(n.questions);
                        });
                    }
                });
            }
        }
        
        if (loadingOverlay) loadingOverlay.classList.add('hidden');

        for (let i = allQs.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [allQs[i], allQs[j]] = [allQs[j], allQs[i]];
        }

        // Pick top 10
        currentSetQuestions = allQs.slice(0, 10);
        currentQuestionIndex = 0;
        score = 0;

        // Mock currentSubcategoryData so back buttons work gracefully
        currentSubcategoryData = { category: 'Daily MCQs' };
        currentSetIndex = 0;
        totalSets = 1;

        currentCategoryTitle.textContent = "Daily MCQs Challenge";
        switchScreen('quiz');
        renderQuestion();
    }

    function startMockTest() {
        updateNavActiveState('nav-mock');
        // Collect all questions
        let allQs = [];
        window.subjectsIndex.forEach(mainCat => {
            mainCat.subcategories.forEach(subCat => {
                allQs = allQs.concat(subCat.questions);
            });
        });

        // Shuffle all questions randomly
        for (let i = allQs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allQs[i], allQs[j]] = [allQs[j], allQs[i]];
        }

        // Pick top 100 or max available
        const testSize = Math.min(100, allQs.length);
        currentSetQuestions = allQs.slice(0, testSize);
        // Ensure source category is tracked
        currentSetQuestions.forEach(q => {
            if (!q.originalCategory) q.originalCategory = "Mock Test";
        });
        currentQuestionIndex = 0;
        score = 0;

        // Mock currentSubcategoryData so back buttons work gracefully
        currentSubcategoryData = { category: 'Full Mock Test' };
        currentSetIndex = 0;
        totalSets = 1;

        currentCategoryTitle.textContent = `Full Mock Test (${testSize} Questions)`;
        switchScreen('quiz');
        renderQuestion();
    }

    function startBookmarksQuiz() {
        updateNavActiveState('nav-bookmarks');
        if (bookmarks.length === 0) {
            alert("No bookmarks yet! Save some questions during a quiz to see them here.");
            return;
        }

        currentSetQuestions = [...bookmarks];
        currentQuestionIndex = 0;
        score = 0;

        currentSubcategoryData = { category: 'Bookmarked Questions' };
        currentSetIndex = 0;
        totalSets = 1;

        currentCategoryTitle.textContent = `Your Bookmarks (${bookmarks.length})`;
        switchScreen('quiz');
        renderQuestion();
    }

    function renderQuestion() {
        if (currentQuestionIndex === 0) {
            quizStartTime = Date.now();
            weakTopicsSession = {}; // Reset session mistakes for analytics
        }

        stopSpeech(); // Stop audio when moving to new question
        hasAnswered = false;
        selectedOptionIndex = null;
        submitBtn.disabled = true;

        submitBtn.classList.remove('hidden');
        nextBtn.classList.add('hidden');
        feedbackContainer.classList.add('hidden');

        const question = currentSetQuestions[currentQuestionIndex];
        const total = currentSetQuestions.length;

        // Update progress
        questionProgressText.textContent = `${currentQuestionIndex + 1} / ${total}`;
        progressFill.style.width = `${((currentQuestionIndex + 1) / total) * 100}%`;

        // Save original text for translation
        originalQuestionText = question.q;
        originalOptionsText = [...question.options];

        // Ensure English UI reset first
        questionText.classList.remove('nastaliq');
        questionText.style.direction = "ltr";
        questionText.style.fontFamily = "inherit";
        if (translateBtn) {
            translateBtn.classList.remove('active');
            translateBtn.querySelector('i').className = 'fa-solid fa-language';
            translateBtn.querySelector('.trans-text').textContent = "اردو";
        }

        const isUrduSubject = (currentMainCategory?.name || "").toLowerCase().includes("urdu") || 
                             (currentSubcategoryData?.category || "").toLowerCase().includes("urdu");

        if (isUrduSubject) {
            questionText.classList.add('nastaliq');
        }

        // Render Text
        questionText.textContent = originalQuestionText;
        optionsContainer.innerHTML = '';

        // Render Options
        question.options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            if (isUrduSubject) btn.classList.add('nastaliq');
            btn.textContent = opt;
            btn.style.direction = isUrduSubject ? "rtl" : "ltr";
            btn.style.fontFamily = "inherit";
            btn.addEventListener('click', () => selectOption(index, btn));
            optionsContainer.appendChild(btn);
        });

        // Update Bookmark state
        const qId = question.q.substring(0, 50);
        const isBookmarked = bookmarks.some(b => b.qId === qId);
        if (bookmarkBtn) {
            if (isBookmarked) {
                bookmarkBtn.classList.add('active');
                bookmarkBtn.querySelector('i').className = 'fa-solid fa-bookmark';
            } else {
                bookmarkBtn.classList.remove('active');
                bookmarkBtn.querySelector('i').className = 'fa-regular fa-bookmark';
            }
        }

        // Auto-translate if toggle was kept on
        if (isTranslated) {
            isTranslated = false; // reset temp to let toggle push it back true
            toggleTranslation();
        }

        if (isExamMode) {
            submitBtn.textContent = "Save & Next";
            const timerContainer = document.getElementById('timer-container');
            if (timerContainer) timerContainer.classList.remove('hidden');
            if (timerBar) timerBar.style.width = "100%";
            updateExamTimerDisplay();
        } else {
            submitBtn.textContent = "Check Answer";
            startTimer();
        }
    }

    function startTimer() {
        clearInterval(timerInterval);
        timeLeft = timePerQuestion;
        updateTimerUI();

        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerUI();

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timeOutHandler();
            }
        }, 1000);
    }

    function updateTimerUI() {
        timeLeftText.textContent = timeLeft;
        const percentage = (timeLeft / timePerQuestion) * 100;
        timerBar.style.width = `${percentage}%`;

        timerBar.classList.remove('warning', 'danger');
        if (timeLeft <= 5 && timeLeft > 0) {
            timerBar.classList.add('danger');
        } else if (timeLeft <= 10) {
            timerBar.classList.add('warning');
        }
    }

    function timeOutHandler() {
        if (hasAnswered) return;
        // Auto check answer as incorrect if time runs out and no valid selection
        selectedOptionIndex = null;
        checkAnswer();
    }

    function selectOption(index, btnNode) {
        if (hasAnswered) return;

        // Remove selection from all
        document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));

        // Add to current
        btnNode.classList.add('selected');
        selectedOptionIndex = index;
        submitBtn.disabled = false;
    }

    function checkAnswer() {
        if (hasAnswered) return;

        const question = currentSetQuestions[currentQuestionIndex];
        const isCorrect = (selectedOptionIndex === question.answer);

        if (isExamMode) {
            if (isCorrect) score++;
            nextQuestion();
            return;
        }

        hasAnswered = true;
        clearInterval(timerInterval); // Stop timer

        const correctIndex = question.answer;
        const optionsNodes = document.querySelectorAll('.option-btn');

        let feedbackIconHTML = '';

        playSound(isCorrect);

        // Apply feedback styles
        optionsNodes.forEach((btn, index) => {
            btn.disabled = true;
            if (index === correctIndex) {
                btn.classList.add('correct');
            } else if (index === selectedOptionIndex) {
                btn.classList.add('incorrect');
            }
        });

        if (isCorrect) {
            score++;
            feedbackContainer.style.borderLeftColor = 'var(--success)';
            feedbackIconHTML = '<i class="fa-solid fa-circle-check" style="color: var(--success);"></i> Correct! Explanation:';
            handleMistakeCorrection(question.q);
        } else {
            feedbackContainer.style.borderLeftColor = 'var(--danger)';
            feedbackIconHTML = '<i class="fa-solid fa-circle-xmark" style="color: var(--danger);"></i> Incorrect or Time Out. Explanation:';
            addToMistakesBank(question);

            // Track weak topics
            const t = question.originalCategory || currentSubcategoryData?.category || "Unknown Topic";
            if (!weakTopicsSession[t]) weakTopicsSession[t] = 0;
            weakTopicsSession[t]++;
        }

        // Show Explanation
        const headingEl = feedbackContainer.querySelector('h4');
        headingEl.innerHTML = feedbackIconHTML;

        let explanationString = question.explanation;
        if (isTranslated) {
            translateText(explanationString).then(translatedExp => {
                explanationText.textContent = translatedExp;
                explanationText.style.direction = "rtl";
                explanationText.style.fontFamily = "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif";
            });
        } else {
            explanationText.textContent = explanationString;
            explanationText.style.direction = "ltr";
            explanationText.style.fontFamily = "inherit";
        }

        feedbackContainer.classList.remove('hidden');

        // Toggle buttons
        submitBtn.classList.add('hidden');
        nextBtn.classList.remove('hidden');
    }

    function nextQuestion() {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentSetQuestions.length) {
            renderQuestion();
        } else {
            showResults();
        }
    }

    function showResults() {
        if (timerInterval) clearInterval(timerInterval);
        if (examTimerInterval) clearInterval(examTimerInterval);

        finalScoreEl.textContent = score;
        const total = currentSetQuestions.length;
        totalQuestionsEl.textContent = total;

        const trophyIcon = document.querySelector('.trophy-icon');
        const scoreCircle = document.querySelector('.score-circle');
        const percent = (score / total) * 100;

        if (isExamMode) {
            resultMessage.textContent = `Timed Exam Completed! You scored ${percent}%`;
            if (nextSetBtn) nextSetBtn.classList.add('hidden');
            isExamMode = false; // Reset
            // Reset timer text color
            if (timeLeftText) timeLeftText.parentElement.style.color = "inherit";
        } else {
            // Update User Stats
            const mainCatName = findMainCategoryBySub(currentSubcategoryData.category);
            updateStats(mainCatName, total, score);

            // Mark Quiz as Completed
            if (currentSubcategoryData && currentSubcategoryData.category !== 'Bookmarked Questions' && 
                currentSubcategoryData.category !== 'Daily MCQs' && currentSubcategoryData.category !== 'Full Mock Test') {
                markQuizCompleted(mainCatName, currentSubcategoryData.category, currentSetIndex);
            }

            if (score === total) {
                resultMessage.textContent = 'Excellent! You mastered this set.';
            } else if (score >= total / 2) {
                resultMessage.textContent = 'Good effort! Keep practicing to secure full marks.';
            } else {
                resultMessage.textContent = 'You need more revision on this topic.';
            }

            // Handle Next Set Button logic
            if (currentSetIndex < totalSets - 1) {
                nextSetBtn.classList.remove('hidden');
            } else {
                nextSetBtn.classList.add('hidden');
            }
        }

        // Show Analytics Report Card
        renderReportCard(total, score);

        // Confetti Celebration
        if (percent >= 80 && typeof confetti === 'function') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#059669', '#10b981', '#fbbf24', '#ffffff']
            });
        }

        // Icon styles (shared)
        if (percent >= 80) {
            trophyIcon.style.color = 'var(--accent)';
            trophyIcon.innerHTML = '<i class="fa-solid fa-trophy"></i>';
            scoreCircle.style.borderColor = 'var(--success)';
        } else if (percent >= 50) {
            trophyIcon.style.color = 'var(--primary)';
            trophyIcon.innerHTML = '<i class="fa-solid fa-medal"></i>';
            scoreCircle.style.borderColor = 'var(--primary)';
        } else {
            trophyIcon.style.color = 'var(--danger)';
            trophyIcon.innerHTML = '<i class="fa-solid fa-book-open-reader"></i>';
            scoreCircle.style.borderColor = 'var(--danger)';
        }

        switchScreen('result');
    }

    function renderReportCard(totalQuestions, correctAnswers) {
        const reportCard = document.getElementById('quiz-report-card');
        if (!reportCard) return;

        // Populate basic stats
        const timeTakenMs = Date.now() - quizStartTime;
        const totalSecs = Math.floor(timeTakenMs / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        document.getElementById('report-time').textContent = `${mins}m ${secs}s`;

        const accuracy = Math.round((correctAnswers / totalQuestions) * 100);
        document.getElementById('report-accuracy').textContent = `${accuracy}%`;

        // Populate Weak Topics
        const weakList = document.getElementById('weak-topics-list');
        weakList.innerHTML = '';
        const weakKeys = Object.keys(weakTopicsSession);

        if (weakKeys.length > 0) {
            weakKeys.sort((a, b) => weakTopicsSession[b] - weakTopicsSession[a]).forEach(topic => {
                const li = document.createElement('li');
                li.innerHTML = `<i class="fa-solid fa-xmark"></i> ${topic} (${weakTopicsSession[topic]} mistakes)`;
                weakList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.style.background = 'rgba(16, 185, 129, 0.1)';
            li.style.color = 'var(--success)';
            li.innerHTML = `<i class="fa-solid fa-check-double"></i> Perfect! No weak areas identified in this session.`;
            weakList.appendChild(li);
        }

        // Render Chart using userStats history
        renderImprovementChart();

        reportCard.classList.remove('hidden');
    }

    function renderImprovementChart() {
        const ctx = document.getElementById('improvement-chart');
        if (!ctx) return;

        if (chartInstance) {
            chartInstance.destroy();
        }

        const history = userStats.scoreHistory || [];
        const labels = history.map((_, i) => `Q ${i + 1}`);
        const data = history;

        // If history is empty, show just the current
        if (data.length === 0) {
            const currentAcc = Math.round((score / currentSetQuestions.length) * 100);
            labels.push('Now');
            data.push(currentAcc);
        }

        const isDark = document.body.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? '#374151' : '#E5E7EB';
        const textColor = isDark ? '#9CA3AF' : '#6B7280';

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score %',
                    data: data,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#10B981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    },
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    }
                }
            }
        });
    }

    // Start App - Wait for Firebase or fallback to local after 3s
    let isAppInitialized = false;
    
    function startApp() {
        if (isAppInitialized) return;
        isAppInitialized = true;
        init();
    }
    
    window.addEventListener('firebaseDataLoaded', () => {
        if (isAppInitialized) {
            // Hot reload the UI if data changes from Firebase post-initialization
            console.log("Hot reloading UI with fresh Firebase data...");
            if (document.getElementById('category-screen').classList.contains('active')) {
                // Only go back to main categories if they were ALREADY on the main categories screen
                if (currentMainCategory === null) {
                    showMainCategories(false, true);
                } else {
                    // Stay where we are, refresh subcategories but SKIP the scroll back to top
                    // If they are deep in a folder, showSubcategories is not ideal, but better than a full jump to home
                    showSubcategories(currentMainCategory, false, true); 
                }
            } else if (document.getElementById('set-screen').classList.contains('active')) {
                // If they are on the sets screen, don't jump to home
                // renderSets() doesn't scroll to top by default
                renderSets();
            }
            
            // Re-render admin if open
            if (!document.getElementById('admin-modal').classList.contains('hidden')) {
                // Check which tab is active
                const activeTab = document.querySelector('.admin-tab-btn.active');
                if (activeTab && typeof window[activeTab.getAttribute('data-tab').replace(/-/g, '') + 'Render'] === 'function') {
                    // Try to re-render specific tab, or just re-render dashboard
                }
                renderAdminDashboard(); 
            }
        } else {
            startApp();
        }
    });

    // Start immediately with local data.js, Firebase updates UI in background if it loads
    setTimeout(() => {
        if (!isAppInitialized) {
            console.log("Starting app with local offline data.js (Firebase will update if available).");
            startApp();
        }
    }, 50);
});

// --- RECOVERED ADMIN FUNCTIONS (Global Scope so called from tab switcher) ---

window.fetchAndRenderJobs = function() {
    window.dispatchEvent(new CustomEvent('fetchJobs', {
        detail: {
            onSuccess: (jobs) => {
                renderJobAlerts(jobs);
                renderAdminJobsList(jobs);
            },
            onError: (err) => console.error(err)
        }
    }));
};

function renderJobAlerts(jobs) {
    const jobAlertsContainer = document.getElementById('job-alerts-list');
    if (!jobAlertsContainer) return;

    if (jobs.length === 0) {
        jobAlertsContainer.innerHTML = '<p style="text-align:center; padding: 1rem; color: var(--text-muted);">No active alerts.</p>';
        return;
    }

    jobAlertsContainer.innerHTML = jobs.map(job => `
        <div class="job-alert-item" onclick="openJobModal(${JSON.stringify(job).replace(/"/g, '&quot;')})">
            <i class="fa-solid fa-bullhorn"></i>
            <div class="job-alert-info">
                <span class="job-alert-title">${job.title}</span>
                <span class="job-alert-meta">${job.department || ''} | Deadline: ${job.deadline}</span>
            </div>
        </div>
    `).join('');
}

function renderAdminJobsList(jobs) {
    const container = document.getElementById('admin-jobs-list');
    if (!container) return;

    if (jobs.length === 0) {
        container.innerHTML = '<tr><td colspan="4" style="text-align:center;">No jobs found.</td></tr>';
        return;
    }

    container.innerHTML = jobs.map(job => `
        <tr>
            <td>${job.title}</td>
            <td>${job.department || '-'}</td>
            <td>${job.deadline}</td>
            <td>
                <button onclick="deleteJobAlert('${job.id}')" style="color:#ef4444; background:none; border:none; cursor:pointer;" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.deleteJobAlert = function(id) {
    if (!confirm("Are you sure you want to delete this alert?")) return;
    window.dispatchEvent(new CustomEvent('deleteJob', {
        detail: { jobId: id, onSuccess: () => fetchAndRenderJobs() }
    }));
};

window.renderAdminUsers = function() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    container.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading users...</td></tr>';
    window.dispatchEvent(new Event('adminFetchUsers'));
};

window.addEventListener('adminUsersLoaded', (e) => {
    const users = e.detail;
    window.adminFetchedUsers = users;
    const dashboardUserCount = document.getElementById('admin-total-users');
    if (dashboardUserCount) dashboardUserCount.textContent = users.length;
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    if (users.length === 0) {
        container.innerHTML = '<tr><td colspan="5" style="text-align:center;">No users found.</td></tr>';
        return;
    }

    container.innerHTML = users.map(user => `
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
            <td style="padding: 0.8rem 0.4rem;"><span class="badge ${user.role === 'admin' ? 'badge-premium' : 'badge-free'}">${user.role || 'user'}</span></td>
            <td style="padding: 0.8rem 0.4rem; font-weight: 500;">${user.displayName || 'Anonymous'}</td>
            <td style="padding: 0.8rem 0.4rem; color: var(--text-muted); font-size: 0.85rem;">${user.createdAt ? (user.createdAt.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'Just now') : 'N/A'}</td>
            <td style="padding: 0.8rem 0.4rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button onclick="openEditUserModal('${user.uid}', '${user.displayName || ''}', '${user.role || 'user'}', '${user.email || ''}', '${user.password || ''}')" class="icon-btn" style="color:var(--primary);" title="Edit Credentials">
                    <i class="fa-solid fa-user-gear"></i>
                </button>
                <button onclick="deleteAdminUser('${user.uid}', '${user.displayName || 'this user'}')" class="icon-btn" style="color:#ef4444;" title="Delete User">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
});

window.deleteAdminUser = function(uid, name) {
    if (!confirm(`⚠️ WARNING: Are you sure you want to PERMANENTLY delete ${name}?\n\nThis will remove their Authentication account AND Database records, allowing their email to be reused.`)) return;
    
    window.dispatchEvent(new CustomEvent('adminDeleteUser', {
        detail: {
            uid,
            onSuccess: () => {
                alert("✅ User account and data purged successfully!");
                if (typeof renderAdminUsers === 'function') renderAdminUsers();
            },
            onError: (err) => alert("❌ Purge Failed: " + err)
        }
    }));
};

window.openEditUserModal = function(uid, name, role, email, password) {
    document.getElementById('edit-user-uid').value = uid;
    document.getElementById('edit-user-name').value = name;
    document.getElementById('edit-user-role').value = role;
    document.getElementById('edit-user-email').value = email || '';
    document.getElementById('edit-user-password').value = password || '';
    document.getElementById('edit-user-modal').classList.remove('hidden');
};

// Global listener for modal close and save (defined once at start of global functions or end)
document.addEventListener('DOMContentLoaded', () => {
    const closeEditUserBtn = document.getElementById('close-edit-user-modal');
    if (closeEditUserBtn) {
        closeEditUserBtn.addEventListener('click', () => {
            document.getElementById('edit-user-modal').classList.add('hidden');
        });
    }

    const saveUserChangesBtn = document.getElementById('save-user-changes-btn');
    if (saveUserChangesBtn) {
        saveUserChangesBtn.addEventListener('click', () => {
            const uid = document.getElementById('edit-user-uid').value;
            const displayName = document.getElementById('edit-user-name').value;
            const role = document.getElementById('edit-user-role').value;
            const email = document.getElementById('edit-user-email').value;
            const password = document.getElementById('edit-user-password').value;

            window.dispatchEvent(new CustomEvent('adminUpdateUser', {
                detail: {
                    uid, displayName, role, email, password,
                    onSuccess: () => {
                        alert("User profile and credentials updated successfully!");
                        document.getElementById('edit-user-modal').classList.add('hidden');
                        renderAdminUsers();
                    },
                    onError: (msg) => alert("Error: " + msg)
                }
            }));
        });
    }

    // Listener for real-time user list refresh
    window.addEventListener('adminUserListChanged', () => {
        if (typeof renderAdminUsers === 'function') renderAdminUsers();
    });
});

/**
 * Performance: Pre-cleans all category and subcategory names,
 * and fixes the 'questions' property for all subcategories.
 * This runs ONCE at load to avoid runtime overhead.
 */
function preCleanAllData(data) {
    if (!Array.isArray(data)) return;
    console.log("Performance: Pre-cleaning application data engine started...");
    const start = performance.now();
    
    data.forEach(main => {
        // Clean main categories
        if (main.name) main.cleanName = main.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        if (Array.isArray(main.subcategories)) {
            main.subcategories.forEach(sub => {
                // Clean subcategories
                if (sub.category) sub.cleanName = sub.category.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                
                // Ensure questions is an array
                if (!sub.questions) {
                    sub.questions = [];
                } else if (typeof sub.questions === 'string') {
                    try {
                        sub.questions = JSON.parse(sub.questions);
                    } catch (e) {
                        sub.questions = [];
                    }
                }
            });
        }
    });
    
    const end = performance.now();
    console.log(`Performance: Engine completed in ${(end - start).toFixed(2)}ms.`);
}

function renderPublicStats() {
    const container = document.getElementById('public-stats-container');
    if (!container) return;

    if (!window.subjectsIndex) return;

    let totalSubjects = window.subjectsIndex.length;
    let totalTopics = 0;
    let totalMCQs = 0;

    window.subjectsIndex.forEach(cat => {
        totalTopics += cat.topicCount || 0;
        totalMCQs += cat.mcqCount || 0;
    });

    container.innerHTML = `
        <div class="public-stat-card">
            <i class="fa-solid fa-book" style="color: var(--primary);"></i>
            <div class="public-stat-value">${totalSubjects}</div>
            <div class="public-stat-label">Total Subjects</div>
        </div>
        <div class="public-stat-card">
            <i class="fa-solid fa-layer-group" style="color: var(--accent);"></i>
            <div class="public-stat-value">${totalTopics.toLocaleString()}</div>
            <div class="public-stat-label">Total Topics</div>
        </div>
        <div class="public-stat-card">
            <i class="fa-solid fa-circle-check" style="color: var(--success);"></i>
            <div class="public-stat-value">${totalMCQs.toLocaleString()}</div>
            <div class="public-stat-label">Total MCQs</div>
        </div>
    `;
}

// Call to initialize display
document.addEventListener('DOMContentLoaded', () => {
    // Initial load
    if (typeof window.subjectsIndex !== 'undefined') {
        renderPublicStats();
    }
});
