/* 
   FIREBASE CLOUD SYNC & AUTHENTICATION MODULE 
   Step 1 Implementation
*/

// ==========================================
// 🔴 IMPORTANT: PASTE YOUR FIREBASE CONFIG HERE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBDptYbPZqxl5gqRv8Bq07dh7WeV9dDeHY",
    authDomain: "mcqs-master-app.firebaseapp.com",
    projectId: "mcqs-master-app",
    storageBucket: "mcqs-master-app.firebasestorage.app",
    messagingSenderId: "787829790061",
    appId: "1:787829790061:web:c832025c0f4be558c93664",
    measurementId: "G-5S767H10N2"
};

// Initialize Firebase
let app, auth, db, storage;
let currentUser = null;

// Function to initialize after checking if config is somewhat valid
function initFirebase() {
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.warn("Firebase Config not updated. Cloud sync is disabled. Please update firebase-sync.js with your project credentials.");
        return;
    }

    // Check if auth is already available and initialized
    if (auth && db) {
        setupAuthStateListener();
        onFirebaseReady(); // Assuming onFirebaseReady is defined elsewhere or a placeholder
        return;
    }

    try {
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        storage = firebase.storage();

        setupAuthListener();
        
        // Handle Social Login Redirect Result if any
        auth.getRedirectResult().then((result) => {
            if (result.user) {
                console.log("Redirect login successful:", result.user);
                window.dispatchEvent(new CustomEvent('authSuccess', { 
                    detail: { username: result.user.displayName || result.user.email, role: 'user', silent: false }
                }));
            }
        }).catch((error) => {
            console.error("Redirect Auth Error:", error);
        });

        console.log("Firebase initialized successfully.");
    } catch (e) {
        console.error("Firebase Init Error:", e);
    }
}

// Persist Login State Across Page Reloads
function setupAuthStateListener() {
    if (!auth) return;
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in, fetch role from Firestore
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                let role = 'user';
                let displayName = user.displayName || user.email;
                
                if (doc.exists) {
                    role = doc.data().role || 'user';
                    displayName = doc.data().displayName || displayName;
                }
                
                // Notify script.js to restore session silently
                window.dispatchEvent(new CustomEvent('authSuccess', { 
                    detail: { username: displayName, role: role, silent: true }
                }));
                
            } catch (error) {
                console.error("Error fetching user role on state change:", error);
            }
        } else {
            // User is signed out. Let script.js handle logout state if needed.
            // Dispatching a logout event guarantees both files are in sync.
            window.dispatchEvent(new Event('authLogout'));
        }
    });
}

// ==========================================
// AUTHENTICATION LOGIC
// ==========================================
function setupAuthListener() {
    auth.onAuthStateChanged(user => {
        currentUser = user;
        // but we can dispatch an event to sync it if needed.
        if (user) {
            console.log("User logged in:", user.displayName || user.email);
            fetchCloudData(user.uid);
            
            // Sync user back to script.js if needed (for UI)
            // But we already updated UI in script.js on success.
        } else {
            console.log("User logged out");
        }
    });

    // Listeners for events dispatched from script.js modal
    window.addEventListener('authSubmit', handleAuthSubmit);
    window.addEventListener('socialLogin', handleSocialLogin);
    window.addEventListener('authLogout', () => {
        if(auth) auth.signOut();
    });
    window.addEventListener('adminCreateUser', handleAdminCreateUser);
}

async function handleAdminCreateUser(e) {
    if (!auth || !db) return;
    
    const { name, email, password, role } = e.detail;
    
    // Show a loading indicator if possible, or just alert state
    console.log("Admin attempting to create user:", email);

    try {
        // Step 1: Initialize a temporary secondary app to avoid logging out the current admin
        // Use a random suffix to ensure uniqueness if multiple attempts happen (though we clean up)
        const secondaryAppName = "AdminCreateUserApp_" + Date.now();
        const secondaryApp = firebase.initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = secondaryApp.auth();

        // Step 2: Create the user in Auth
        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        const newUser = userCredential.user;

        // Step 3: Update Display Name in Auth Profile
        await newUser.updateProfile({ displayName: name });

        // Step 4: Create User Profile in Firestore
        await db.collection('users').doc(newUser.uid).set({
            displayName: name,
            email: email,
            role: role || 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Step 5: Clean up - Sign out and delete secondary app instance
        await secondaryAuth.signOut();
        await secondaryApp.delete();

        alert(`✅ User Created Successfully!\nName: ${name}\nRole: ${role.toUpperCase()}`);
        
        // Hide modal and clear fields
        const modal = document.getElementById('admin-add-user-modal');
        if (modal) modal.classList.add('hidden');
        
        document.getElementById('new-user-name').value = '';
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-password').value = '';

        // Trigger a refresh of the admin user list if the function is available
        // We'll dispatch a custom event that script.js can listen to
        window.dispatchEvent(new Event('adminUserListChanged'));

    } catch (error) {
        console.error("Admin user creation error:", error);
        alert("❌ Failed to create user: " + error.message);
    }
}

async function handleAdminDeleteUser(e) {
    if (!db) return;
    const userId = e.detail.userId;
    try {
        await db.collection('users').doc(userId).delete();
        alert("✅ User deleted successfully.");
        window.dispatchEvent(new Event('adminUserListChanged'));
    } catch (error) {
        console.error("Error deleting user:", error);
        alert("❌ Failed to delete user.");
    }
}

function handleAuthSubmit(e) {
    if (!auth) {
        console.warn("Firebase Auth not initialized. Using local fallback.");
        return;
    }

    const { isSignUpMode, email, username, password, role } = e.detail;

    if (isSignUpMode) {
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                return user.updateProfile({ displayName: username })
                    .then(() => {
                        // Save the user role in Firestore upon signup
                        return db.collection('users').doc(user.uid).set({
                            role: role || 'user',
                            displayName: username,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    })
                    .then(() => user);
            })
            .then((user) => {
                alert(`✅ Successfully signed up as ${user.displayName}! (${role})`);
                document.getElementById('login-modal').classList.add('hidden');
                // Notify script.js to update local UI state
                window.dispatchEvent(new CustomEvent('authSuccess', { 
                    detail: { username: user.displayName, role: role }
                }));
            })
            .catch((error) => {
                const friendlyMsg = getAuthErrorMessage(error.code);
                alert("❌ Sign Up Failed!\n\n" + friendlyMsg);
                console.error("Sign Up Error:", error);
            });
    } else {
        const loginIdentifier = email || username; 
        
        auth.signInWithEmailAndPassword(loginIdentifier, password)
            .then(async (userCredential) => {
                let actualRole = 'user';
                let displayName = userCredential.user.displayName || loginIdentifier;
                
                try {
                    const doc = await db.collection('users').doc(userCredential.user.uid).get();
                    if (doc.exists) {
                        actualRole = doc.data().role || 'user';
                        displayName = doc.data().displayName || displayName;
                    }
                } catch(e) {
                    console.error("Error fetching user role on login:", e);
                }

                // Strictly validate role
                if (role === 'admin' && actualRole !== 'admin') {
                    alert("❌ Access Denied: You do not have Admin privileges.");
                    auth.signOut();
                    return;
                }

                // If user accidentally logged in through User tab but is an admin, let them be an admin
                // (or optionally restrict that too, but generally upward elevation is what we want to block)
                if (role === 'user' && actualRole === 'admin') actualRole = 'user'; // Or let them keep admin

                alert(`✅ Successfully logged in as ${actualRole.toUpperCase()}!`);
                document.getElementById('login-modal').classList.add('hidden');
                
                // Notify script.js to update local UI state
                window.dispatchEvent(new CustomEvent('authSuccess', { 
                    detail: { username: displayName, role: actualRole, silent: false }
                }));
            })
            .catch((error) => {
                const friendlyMsg = getAuthErrorMessage(error.code);
                alert("❌ Login Failed!\n\n" + friendlyMsg);
                console.warn("Firebase login failed:", error.message);
            });
    }
}

// Helper function to convert Firebase error codes to user-friendly messages
function getAuthErrorMessage(errorCode) {
    switch(errorCode) {
        case 'auth/email-already-in-use':
            return "This email is already registered! Please use a different email or try logging in instead.\n\nیہ ای میل پہلے سے استعمال ہو چکی ہے۔ براہ کرم دوسری ای میل استعمال کریں یا لاگ ان کریں۔";
        case 'auth/weak-password':
            return "Password is too weak. Please use at least 6 characters.\n\nپاسورڈ کمزور ہے، کم از کم 6 حروف استعمال کریں۔";
        case 'auth/invalid-email':
            return "Invalid email format. Please enter a valid email address.\n\nای میل کی شکل غلط ہے۔";
        case 'auth/user-not-found':
            return "No account found with this email. Please sign up first.\n\nاس ای میل سے کوئی اکاؤنٹ نہیں ملا۔ پہلے سائن اپ کریں۔";
        case 'auth/wrong-password':
            return "Incorrect password. Please try again or use 'Forgot Password'.\n\nپاسورڈ غلط ہے۔ دوبارہ کوشش کریں یا 'Forgot Password' استعمال کریں۔";
        case 'auth/too-many-requests':
            return "Too many failed attempts. Please try again later.\n\nبہت زیادہ کوششیں ہو گئیں، تھوڑی دیر بعد دوبارہ کوشش کریں۔";
        case 'auth/invalid-credential':
            return "Invalid credentials. Please check your email and password.\n\nای میل یا پاسورڈ غلط ہے۔";
        case 'auth/network-request-failed':
            return "Network error. Please check your internet connection.\n\nانٹرنیٹ سے کنکشن نہیں ہو سکا۔";
        default:
            return "An unexpected error occurred. Please try again.\n\nایک غیر متوقع خرابی ہو گئی۔";
    }
}

function handleSocialLogin(e) {
    if (!auth) {
        alert("Firebase not configured properly.");
        return;
    }

    const isLocalFile = window.location.protocol === 'file:';
    if (isLocalFile) {
        alert("❌ Social Login Restricted!\n\n" + 
              "Firebase Social Login (Google/Facebook) does not work when opening index.html directly from your folders.\n\n" +
              "براہ کرم اس ایپ کو ایک ویب سرور (جیسے npx serve) پر چلائیں یا ای میل اور پاسورڈ کے ذریعے لاگ ان کریں۔");
        return;
    }

    const providerStr = e.detail;
    let provider;
    
    if (providerStr === 'google') {
        provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
    } else if (providerStr === 'facebook') {
        provider = new firebase.auth.FacebookAuthProvider();
    }

    if (provider) {
        // Try popup first as it is more user friendly
        auth.signInWithPopup(provider)
            .then((result) => {
                console.log(`${providerStr} login successful`, result.user);
                document.getElementById('login-modal').classList.add('hidden');
                window.dispatchEvent(new CustomEvent('authSuccess', { 
                    detail: { username: result.user.displayName || result.user.email, role: 'user', silent: false }
                }));
            }).catch((error) => {
                console.warn(`${providerStr} Popup Error, trying redirect...`, error);
                
                if (error.code === 'auth/operation-not-supported-in-this-environment') {
                    alert("❌ Operation Not Supported!\n\n" + 
                          "This environment does not support Popups. Please ensure you are using a secure browser or server environment.\n\n" +
                          "یہ براؤزر یا ماحول سوشل لاگ ان پاپ اپ کو سپورٹ نہیں کرتا۔");
                    return;
                }

                // Fallback to redirect for mobile devices or restrictive environments
                try {
                    auth.signInWithRedirect(provider);
                } catch(err) {
                    console.error("Redirect Auth Error:", err);
                    alert("Social login is unavailable in this environment.");
                }
            });
    }
}

// Forgot Password Handler
window.addEventListener('resetPassword', (e) => {
    const { email, onSuccess, onError } = e.detail;
    if (!auth) {
        if (onError) onError("Firebase Auth is not initialized.");
        return;
    }
    
    auth.sendPasswordResetEmail(email)
        .then(() => {
            if (onSuccess) onSuccess();
        })
        .catch((error) => {
            console.error("Password reset error:", error);
            if (onError) onError(error.message);
        });
});

// ==========================================
// JOB ALERTS LOGIC (FIRESTORE)
// ==========================================

window.addEventListener('fetchJobs', async (e) => {
    const { onSuccess, onError } = e.detail;
    if (!db) {
        if (onError) onError("Firebase not active.");
        return;
    }
    try {
        const snap = await db.collection('job_alerts').orderBy('createdAt', 'desc').get();
        const jobs = [];
        snap.forEach(doc => {
            jobs.push({ id: doc.id, ...doc.data() });
        });
        if (onSuccess) onSuccess(jobs);
    } catch(err) {
        console.error("Error fetching jobs:", err);
        if (onError) onError(err.message);
    }
});

window.addEventListener('addJob', async (e) => {
    const { jobData, onSuccess, onError } = e.detail;
    if (!db) {
        if (onError) onError("Firebase not active.");
        return;
    }
    try {
        jobData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const docRef = await db.collection('job_alerts').add(jobData);
        if (onSuccess) onSuccess(docRef.id);
    } catch(err) {
        console.error("Error adding job:", err);
        if (onError) onError(err.message);
    }
});

window.addEventListener('deleteJob', async (e) => {
    const { jobId, onSuccess, onError } = e.detail;
    if (!db) {
        if (onError) onError("Firebase not active.");
        return;
    }
    try {
        await db.collection('job_alerts').doc(jobId).delete();
        if (onSuccess) onSuccess();
    } catch(err) {
        console.error("Error deleting job:", err);
        if (onError) onError(err.message);
    }
});

// ==========================================
// CLOUD SYNC LOGIC (FIRESTORE)
// ==========================================

async function fetchCloudData(uid) {
    try {
        const docRef = db.collection('users').doc(uid);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            console.log("Cloud data fetched:", data);

            // Sync the userRole back to script.js if it exists
            if (data.role) {
                // We dispatch an event or simply use localStorage if script.js relies on it
                localStorage.setItem('userRole', data.role);
                // Also trigger UI update event indirectly
                window.dispatchEvent(new CustomEvent('authRoleLoaded', { detail: data.role }));
            }

            // Dispatch event to script.js to update local state like stats
            window.dispatchEvent(new CustomEvent('cloudDataLoaded', {
                detail: data
            }));
        } else {
            console.log("No cloud data found. Starting fresh.");
        }
    } catch (e) {
        console.error("Error fetching cloud data:", e);
    }
}

// Listen to local saves and push to cloud
window.addEventListener('saveToCloud', (e) => {
    if (!currentUser || !db) return; // Ignore if not logged in

    const { type, data } = e.detail;
    const uid = currentUser.uid;
    const docRef = db.collection('users').doc(uid);

    // Prepare update object based on what was saved locally
    const updatePayload = {};
    if (type === 'stats') {
        updatePayload.userStats = data;
    } else if (type === 'bookmarks') {
        updatePayload.bookmarks = data;
    } else if (type === 'mistakes') {
        updatePayload.mistakesBank = data;
    } else if (type === 'completedQuizzes') {
        updatePayload.completedQuizzes = data;
    }

    docRef.set(updatePayload, { merge: true })
        .then(() => {
            console.log(`Successfully synced ${type} to cloud.`);
            // Update displayName for leaderboard if it's the first time
            docRef.set({ displayName: currentUser.displayName }, { merge: true });
        })
        .catch(err => console.error(`Error syncing ${type}:`, err));
});

// Listener for Leaderboard
window.addEventListener('requestLeaderboard', async () => {
    if (!db) return;
    try {
        const querySnapshot = await db.collection('users')
            .orderBy('userStats.totalCorrect', 'desc')
            .limit(50)
            .get();

        const leaderboardData = [];
        querySnapshot.forEach(doc => {
            leaderboardData.push(doc.data());
        });

        window.dispatchEvent(new CustomEvent('leaderboardDataLoaded', { detail: leaderboardData }));
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        window.dispatchEvent(new CustomEvent('leaderboardDataLoaded', { detail: [] }));
    }
});

// ==========================================
// PHASE 7: LIVE DATABASE SYNC (FIRESTORE)
// ==========================================

// Function to initiate real-time listener on the mcq_data collection
function initFirestoreSync() {
    if (!db) return;

    window.dispatchEvent(new CustomEvent('firebaseDataLoaded'));

    // Listen to chunked subcategory documents
    db.collection('mcq_data').onSnapshot((snapshot) => {
        if (snapshot.empty) {
            console.log("Firestore is empty. App is using local data.js.");
            return;
        }

        const cloudQuizData = [];
        const mainCatMap = new Map();

        // Reconstruct the nested mainQuizData structure from flat subcategory docs
        snapshot.forEach(doc => {
            const data = doc.data();
            const mainName = data.mainCategoryName;
            const mainIcon = data.mainCategoryIcon;

            if (!mainCatMap.has(mainName)) {
                mainCatMap.set(mainName, {
                    name: mainName,
                    icon: mainIcon,
                    subcategories: []
                });
                cloudQuizData.push(mainCatMap.get(mainName));
            }

            mainCatMap.get(mainName).subcategories.push({
                category: data.subCategoryName,
                icon: data.subCategoryIcon,
                questions: data.questions
            });
        });

        // Disconnected legacy mainQuizData sync to prioritize modular subjectsIndex
        // window.mainQuizData = cloudQuizData; 
        console.log("Background: Real-time data received from Firestore (Chunked). [Modular Mode: Cloud data ignored for metadata]");
        window.dispatchEvent(new CustomEvent('firebaseDataLoaded'));
    }, (error) => {
        console.error("Firestore sync error:", error);
    });
}

// Admin utility to migrate the local data.js file to Firestore
// Chunked by subcategory to avoid 1MB document limit
window.migrateDataToFirestore = async function() {
    if (!db) {
        alert("Firebase is not initialized.\n\nPlease make sure you are logged in and Firebase is connected.");
        return;
    }
    const totalSubjects = window.subjectsIndex.length;
    const dataRef = db.collection('mcq_data');
    let successCount = 0;
    
    const migrateBtn = document.getElementById('admin-migrate-firebase-btn');
    if (migrateBtn) {
        migrateBtn.disabled = true;
        migrateBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Initializing Migration...';
    }

    for (const subjectMeta of window.subjectsIndex) {
        if (migrateBtn) {
            migrateBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Loading ${subjectMeta.name}...`;
        }
        
        const subjectData = await window.ensureSubjectLoaded(subjectMeta.slug);
        if (!subjectData) continue;

        for (const sub of subjectData.subcategories) {
            if (sub.isFolder && sub.subcategories) {
                // Migrate folder subcategories
                for (const nestedSub of sub.subcategories) {
                    const chunk = {
                        mainCategoryName: subjectData.name,
                        mainCategoryIcon: subjectData.icon || "fa-book",
                        subCategoryName: nestedSub.category,
                        subCategoryIcon: nestedSub.icon || "fa-file-lines",
                        questions: nestedSub.questions || []
                    };
                    const docId = (chunk.mainCategoryName + "_" + chunk.subCategoryName).replace(/\s+/g, '_').replace(/\//g, '-');
                    await dataRef.doc(docId).set(chunk);
                }
            } else {
                const chunk = {
                    mainCategoryName: subjectData.name,
                    mainCategoryIcon: subjectData.icon || "fa-book",
                    subCategoryName: sub.category,
                    subCategoryIcon: sub.icon || "fa-file-lines",
                    questions: sub.questions || []
                };
                const docId = (chunk.mainCategoryName + "_" + chunk.subCategoryName).replace(/\s+/g, '_').replace(/\//g, '-');
                await dataRef.doc(docId).set(chunk);
            }
            successCount++;
            if (migrateBtn) {
                migrateBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Migrating ${subjectData.name}... (${successCount})`;
            }
        }
    }
    }

    if (migrateBtn) {
        migrateBtn.disabled = false;
        migrateBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Migrate Offline Data to Firebase';
    }

    alert("✅ Migration Finished!\n" + successCount + " subcategory chunks processed.");
};

// Start the real-time sync after initialization
function onFirebaseReady() {
    initFirestoreSync();
}

// Write events receivers from script.js
window.addEventListener('submitPendingQuestion', async (e) => {
    const { userQ, onSuccess, onError } = e.detail;
    if (!db) {
        if(onError) onError("Firebase is not initialized.");
        return;
    }
    try {
        await db.collection('pending_mcqs').add(userQ);
        if(onSuccess) onSuccess();
    } catch (error) {
        console.error("Error submitting pending question:", error);
        if(onError) onError(error.message);
    }
});

window.addEventListener('updateCategoryInFirestore', async (e) => {
    const { mainCat, onSuccess, onError } = e.detail;
    if (!db) {
        if(onError) onError("Firebase is not initialized.");
        return;
    }
    try {
        const batch = db.batch();
        // Since we are now using chunked mcq_data, we need to update all chunks for this main category
        mainCat.subcategories.forEach(sub => {
            const docId = (mainCat.name + "_" + sub.category).replace(/\s+/g, '_').replace(/\//g, '-');
            const chunk = {
                mainCategoryName: mainCat.name,
                mainCategoryIcon: mainCat.icon || "fa-book",
                subCategoryName: sub.category,
                subCategoryIcon: sub.icon || "fa-file-lines",
                questions: sub.questions || []
            };
            const docRef = db.collection('mcq_data').doc(docId);
            batch.set(docRef, chunk);
        });
        
        await batch.commit();
        if(onSuccess) onSuccess();
    } catch (error) {
        console.error("Error updating category in Firestore:", error);
        if(onError) onError(error.message);
    }
});

// Admin: Fetch All Users
window.addEventListener('adminFetchUsers', () => {
    if (!db) return;
    
    db.collection('users').orderBy('createdAt', 'desc').get()
        .then(querySnapshot => {
            const users = [];
            querySnapshot.forEach(doc => {
                users.push({ uid: doc.id, ...doc.data() });
            });
            window.dispatchEvent(new CustomEvent('adminUsersLoaded', { detail: users }));
        })
        .catch(error => console.error("Error fetching users for admin:", error));
});

// Admin: Update Specific User Credentials & Profile
window.addEventListener('adminUpdateUser', (e) => {
    const { uid, displayName, role, email, password, onSuccess, onError } = e.detail;
    if (!db || !uid) return;
    
    const updateData = {
        displayName: displayName,
        role: role,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Add managed credential overrides if provided
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    db.collection('users').doc(uid).update(updateData)
    .then(() => {
        if (onSuccess) onSuccess();
    })
    .catch(error => {
        console.error("Error updating user:", error);
        if (onError) onError(error.message);
    });
});

// Admin: Delete User account from Auth AND Firestore
window.addEventListener('adminDeleteUser', async (e) => {
    const { uid, onSuccess, onError } = e.detail;
    if (!auth || !db || !uid) return;
    
    try {
        // Step 1: Fetch user's credentials from Firestore to perform Auth deletion
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            throw new Error("User record not found in database.");
        }
        
        const userData = userDoc.data();
        const email = userData.email;
        const password = userData.password;

        if (email && password) {
            console.log("Attempting background Auth deletion for:", email);
            
            // Step 2: Initialize secondary app to sign-in and delete the user
            const secondaryAppName = "DeleteUserApp_" + Date.now();
            const secondaryApp = firebase.initializeApp(firebaseConfig, secondaryAppName);
            const secondaryAuth = secondaryApp.auth();

            try {
                // Step 3: Sign in as the target user
                const userCredential = await secondaryAuth.signInWithEmailAndPassword(email, password);
                
                // Step 4: Delete the Auth account
                await userCredential.user.delete();
                console.log("Auth account deleted for:", email);
                
                // Clean up secondary app
                await secondaryApp.delete();
            } catch (authError) {
                console.warn("Auth deletion failed or user already gone. Proceeding with Firestore cleanup.", authError);
                // If the app was initialized, delete it
                if (secondaryApp) await secondaryApp.delete();
            }
        }

        // Step 5: Delete from Firestore (always do this as fallback)
        await db.collection('users').doc(uid).delete();
        
        if (onSuccess) onSuccess();
        
    } catch (error) {
        console.error("Critical error during user purge:", error);
        if (onError) onError(error.message);
    }
});

// Auth Override: Check Firestore for Managed Credentials
window.addEventListener('checkUserOverride', async (e) => {
    const { email, password, onSuccess, onFail } = e.detail;
    if (!db) {
        if (onFail) onFail();
        return;
    }
    
    try {
        // Search for a user in Firestore that has this email and this overridden password
        const snapshot = await db.collection('users')
            .where('email', '==', email)
            .where('password', '==', password)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            // Inject UID into the profile data
            userData.uid = snapshot.docs[0].id;
            if (onSuccess) onSuccess(userData);
        } else {
            if (onFail) onFail();
        }
    } catch (error) {
        console.error("Error checking user override:", error);
        if (onFail) onFail();
    }
});

// Admin Pending questions management
window.addEventListener('fetchPendingQuestions', async (e) => {
    const { onSuccess, onError } = e.detail;
    if (!db) {
        if(onError) onError("Firebase not active.");
        return;
    }
    try {
        const snap = await db.collection('pending_mcqs').get();
        const pending = [];
        snap.forEach(doc => {
            pending.push({ id: doc.id, ...doc.data() });
        });
        if(onSuccess) onSuccess(pending);
    } catch(err) {
        if (onError) onError(err.message);
    }
});

window.addEventListener('resolvePendingQuestion', async (e) => {
    const { action, docId, mcqData, targetMainObj, onSuccess, onError } = e.detail;
    if (!db) {
        if(onError) onError("Firebase not active.");
        return;
    }
    try {
        const batch = db.batch();
        // Remove from pending
        batch.delete(db.collection('pending_mcqs').doc(docId));
        
        // If approve, also update targeting main document
        if (action === 'approve' && targetMainObj) {
            // Update all chunks for this main category to ensure consistency
            targetMainObj.subcategories.forEach(sub => {
                const chunkDocId = (targetMainObj.name + "_" + sub.category).replace(/\s+/g, '_').replace(/\//g, '-');
                const chunk = {
                    mainCategoryName: targetMainObj.name,
                    mainCategoryIcon: targetMainObj.icon || "fa-book",
                    subCategoryName: sub.category,
                    subCategoryIcon: sub.icon || "fa-file-lines",
                    questions: sub.questions || []
                };
                const docRef = db.collection('mcq_data').doc(chunkDocId);
                batch.set(docRef, chunk);
            });
        }
        
        await batch.commit();
        if(onSuccess) onSuccess();
    } catch(err) {
        if(onError) onError(err.message);
    }
});

// ==========================================
// JOB ALERTS LOGIC
// ==========================================

window.addEventListener('fetchJobs', async (e) => {
    const { onSuccess, onError } = e.detail;
    if (!db) {
        if(onError) onError("Firebase not active.");
        return;
    }
    try {
        const snap = await db.collection('job_alerts').orderBy('createdAt', 'desc').get();
        const jobs = [];
        snap.forEach(doc => {
            jobs.push({ id: doc.id, ...doc.data() });
        });
        if(onSuccess) onSuccess(jobs);
    } catch(err) {
        console.error("Error fetching jobs:", err);
        if(onError) onError(err.message);
    }
});

window.addEventListener('addJob', async (e) => {
    const { jobData, onSuccess, onError } = e.detail;
    if (!db) {
        if(onError) onError("Firebase not active.");
        return;
    }
    try {
        jobData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const docRef = await db.collection('job_alerts').add(jobData);
        if(onSuccess) onSuccess(docRef.id);
    } catch(err) {
        console.error("Error adding job:", err);
        if(onError) onError(err.message);
    }
});

// Upload job image to Firebase Storage
window.addEventListener('uploadJobImage', async (e) => {
    const { file, onSuccess, onError } = e.detail;
    if (!storage) {
        if(onError) onError("Firebase Storage not initialized.");
        return;
    }
    try {
        const fileName = 'job_images/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const storageRef = storage.ref(fileName);
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        if(onSuccess) onSuccess(downloadURL);
    } catch(err) {
        console.error("Error uploading image:", err);
        if(onError) onError(err.message);
    }
});

window.addEventListener('editJob', async (e) => {
    const { jobId, jobData, onSuccess, onError } = e.detail;
    if (!db) {
        if(onError) onError("Firebase not active.");
        return;
    }
    try {
        jobData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('job_alerts').doc(jobId).update(jobData);
        if(onSuccess) onSuccess(jobId);
    } catch(err) {
        console.error("Error updating job:", err);
        if(onError) onError(err.message);
    }
});

window.addEventListener('deleteJob', async (e) => {
    const { jobId, onSuccess, onError } = e.detail;
    if (!db) {
        if(onError) onError("Firebase not active.");
        return;
    }
    try {
        await db.collection('job_alerts').doc(jobId).delete();
        if(onSuccess) onSuccess();
    } catch(err) {
        console.error("Error deleting job:", err);
        if(onError) onError(err.message);
    }
});

// Override the original initFirebase to include onFirebaseReady
const originalInitFirebase = initFirebase;
initFirebase = function() {
    originalInitFirebase();
    if (db) {
        onFirebaseReady();
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', initFirebase);

// Contact Form submission to Firestore
window.addEventListener('submitContactMessage', async (e) => {
    const { messageData, onSuccess, onError } = e.detail;
    if (!db) {
        if (onError) onError("Database not initialized.");
        return;
    }
    try {
        messageData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        messageData.status = 'unread'; // Default status
        
        await db.collection('contact_messages').add(messageData);
        if (onSuccess) onSuccess();
    } catch (error) {
        console.error("Error saving contact message:", error);
        if (onError) onError(error.message);
    }
});
