         // ==========================================
        // DATA MODEL / ERD IN-MEMORY & LOCALSTORAGE
        // ==========================================
        
        const localFrontendHosts = ["localhost", "127.0.0.1"];
        const usesLocalBackend = localFrontendHosts.includes(window.location.hostname) ||
            window.location.port === "5000";
        const API_BASE_URL = usesLocalBackend
            ? window.location.port === "5000"
                ? window.location.origin
                : `${window.location.protocol}//${window.location.hostname}:5000`
            : "https://final-project-webmates-bsis2a-v2g3.onrender.com";
        const initialProducts = [];
        const removedProductIds = new Set(["P1", "P2", "P3", "P4"]);

        // System State
        let users = JSON.parse(localStorage.getItem("atudtaUsers") || "[]");
        users.forEach(user => { delete user.password; });
        localStorage.setItem("atudtaUsers", JSON.stringify(users));
        let products = JSON.parse(localStorage.getItem("atudtaProducts") || JSON.stringify(initialProducts))
            .filter(product => !removedProductIds.has(product.id));
        let orders = [];
        let reviews = [];
        let cart = [];
        localStorage.setItem("atudtaProducts", JSON.stringify(products));
        const DELIVERY_FEE = 58;
        let selectedCartProductIds = new Set();
        
        let currentUser = null;
        let selectedCategory = "All";
        let isRiderDuty = true;
        let riderCurrentLocation = null;
        let riderLocationRequestPending = false;
        let selectedProductId = null;

        function getCartStorageKey(userId) {
            return `atudtaCart:${encodeURIComponent(userId)}`;
        }

        function loadCartForUser(user) {
            if (!user?.id) {
                return [];
            }
            const savedCart = JSON.parse(localStorage.getItem(getCartStorageKey(user.id)) || "[]");
            return Array.isArray(savedCart)
                ? savedCart.filter(item => !removedProductIds.has(item.productId))
                : [];
        }

        function saveCartForCurrentUser() {
            if (!currentUser?.id) {
                throw new Error("Cannot save cart without a signed-in user.");
            }
            localStorage.setItem(getCartStorageKey(currentUser.id), JSON.stringify(cart));
        }

        function getProductStock(product) {
            const stock = Number(product.stock);
            return Number.isFinite(stock) && stock >= 0 ? stock : null;
        }

        function formatQuantity(quantity) {
            return Number(quantity).toLocaleString(undefined, { maximumFractionDigits: 2 });
        }

        function getStockUnitLabel(stockUnit) {
            return stockUnit === "kg" ? "kg" : "pcs";
        }

        function getCartQuantityStep(product) {
            return product?.stockUnit === "kg" ? 0.1 : 1;
        }

        async function apiRequest(path, options = {}) {
            const headers = { ...(options.headers || {}) };
            if (options.body !== undefined) {
                headers["Content-Type"] = "application/json";
            }
            const token = sessionStorage.getItem("atudtaAuthToken");
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            let response;
            try {
                response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
            } catch (error) {
                if (error instanceof TypeError) {
                    throw new Error("Could not reach the API server. Check the backend URL and CORS settings.");
                }
                throw error;
            }

            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (error) {
                throw new Error(
                    `The API returned a non-JSON response (HTTP ${response.status}). ` +
                    "Check that the backend URL points to your Render web service."
                );
            }
            if (!response.ok) {
                throw new Error(result?.error || result?.message || "The request could not be completed.");
            }
            return result;
        }

        async function loadProductsFromDatabase() {
            const loadedProducts = await apiRequest("/api/products");
            if (!Array.isArray(loadedProducts)) {
                throw new Error("The server returned an invalid product list.");
            }
            products = loadedProducts.filter(product => !removedProductIds.has(product.id));
            localStorage.setItem("atudtaProducts", JSON.stringify(products));
        }

        async function loadOrdersFromDatabase() {
            const loadedOrders = await apiRequest("/api/orders");
            if (!Array.isArray(loadedOrders)) {
                throw new Error("The server returned an invalid order list.");
            }
            orders = loadedOrders;
        }

        async function loadReviewsFromDatabase() {
            const loadedReviews = await apiRequest("/api/reviews");
            if (!Array.isArray(loadedReviews)) {
                throw new Error("The server returned an invalid review list.");
            }
            reviews = loadedReviews;
        }

        // Sound Effects via Web Audio API
        function playChime() {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2); // A5
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.25);
            } catch (e) {
                // Audio context muted or unsupported
            }
        }

        // Toasts
        function showToast(message, type = "success") {
            const container = document.getElementById("toastContainer");
            const toast = document.createElement("div");
            const bgColor = type === "success" ? "bg-emerald-600" : "bg-spink-600";
            toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center justify-between toast-slide pointer-events-auto`;
            toast.innerHTML = `<span>${message}</span> <button onclick="this.parentElement.remove()" class="ml-3 font-bold">✕</button>`;
            container.appendChild(toast);
            playChime();
            setTimeout(() => { toast.remove(); }, 4000);
        }

        let confirmationDialogSequence = 0;

        function showConfirmation({
            title,
            message,
            confirmLabel,
            danger = false,
            summaryRows = [],
            highlightedTotal,
            footerMessage
        }) {
            return new Promise(resolve => {
                const previousFocus = document.activeElement;
                const dialogId = `confirmation-dialog-${++confirmationDialogSequence}`;
                const overlay = document.createElement("div");
                overlay.className = "fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4";

                const dialog = document.createElement("section");
                dialog.className = "w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl";
                dialog.setAttribute("role", "dialog");
                dialog.setAttribute("aria-modal", "true");
                dialog.setAttribute("aria-labelledby", `${dialogId}-title`);
                dialog.setAttribute("aria-describedby", `${dialogId}-message`);

                const heading = document.createElement("h2");
                heading.id = `${dialogId}-title`;
                heading.className = "text-xl font-bold text-slate-800";
                heading.textContent = title;

                const detail = document.createElement("p");
                detail.id = `${dialogId}-message`;
                detail.className = "mt-3 whitespace-pre-line text-sm leading-6 text-slate-600";
                detail.textContent = message;

                let summary;
                if (summaryRows.length || highlightedTotal) {
                    summary = document.createElement("div");
                    summary.className = "mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm";

                    summaryRows.forEach(row => {
                        const summaryRow = document.createElement("div");
                        summaryRow.className = "flex justify-between gap-3 text-slate-600";

                        const label = document.createElement("span");
                        label.textContent = row.label;

                        const value = document.createElement("span");
                        value.className = "font-semibold";
                        value.textContent = row.value;

                        summaryRow.append(label, value);
                        summary.appendChild(summaryRow);
                    });

                    if (highlightedTotal) {
                        const totalRow = document.createElement("div");
                        totalRow.className = "flex items-center justify-between gap-3 border-t border-rose-200 bg-rose-50 px-3 py-2";

                        const totalLabel = document.createElement("span");
                        totalLabel.className = "font-bold text-slate-700";
                        totalLabel.textContent = "Order total";

                        const totalValue = document.createElement("span");
                        totalValue.className = "text-xl font-black text-spink-600";
                        totalValue.textContent = highlightedTotal;

                        totalRow.append(totalLabel, totalValue);
                        summary.appendChild(totalRow);
                    }
                }

                let footer;
                if (footerMessage) {
                    footer = document.createElement("p");
                    footer.className = "mt-4 text-sm font-semibold text-slate-700";
                    footer.textContent = footerMessage;
                }

                const actions = document.createElement("div");
                actions.className = "mt-6 flex justify-end gap-3";

                const cancelButton = document.createElement("button");
                cancelButton.type = "button";
                cancelButton.className = "rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200";
                cancelButton.textContent = "Cancel";

                const confirmButton = document.createElement("button");
                confirmButton.type = "button";
                confirmButton.className = danger
                    ? "rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700"
                    : "rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700";
                confirmButton.textContent = confirmLabel;

                actions.append(cancelButton, confirmButton);
                dialog.append(heading, detail);
                if (summary) {
                    dialog.appendChild(summary);
                }
                if (footer) {
                    dialog.appendChild(footer);
                }
                dialog.appendChild(actions);
                overlay.appendChild(dialog);
                document.body.appendChild(overlay);

                let settled = false;
                const finish = confirmed => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    document.removeEventListener("keydown", handleKeydown);
                    overlay.remove();
                    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
                        previousFocus.focus();
                    }
                    resolve(confirmed);
                };
                const handleKeydown = event => {
                    if (event.key === "Escape") {
                        event.preventDefault();
                        finish(false);
                    } else if (event.key === "Tab") {
                        event.preventDefault();
                        (document.activeElement === cancelButton ? confirmButton : cancelButton).focus();
                    }
                };

                cancelButton.addEventListener("click", () => finish(false));
                confirmButton.addEventListener("click", () => finish(true));
                overlay.addEventListener("click", event => {
                    if (event.target === overlay) {
                        finish(false);
                    }
                });
                document.addEventListener("keydown", handleKeydown);
                cancelButton.focus();
            });
        }

        // Synchronization across tabs
        window.addEventListener('storage', async (e) => {
            if (e.key === "atudtaOrders") {
                try {
                    await loadOrdersFromDatabase();
                    renderAll();
                } catch (error) {
                    console.error("Could not refresh orders from MongoDB.", error);
                    showToast(error.message || "Could not refresh orders from MongoDB.", "error");
                }
            }
            if (e.key === "atudtaProducts") {
                try {
                    await loadProductsFromDatabase();
                    renderAll();
                    showToast("Product inventory refreshed from the database.");
                } catch (error) {
                    console.error("Could not refresh product inventory.", error);
                    showToast(error.message || "Could not refresh product inventory.", "error");
                }
            }
        });

        function saveData() {
            localStorage.setItem("atudtaUsers", JSON.stringify(users));
            localStorage.setItem("atudtaProducts", JSON.stringify(products));
            saveCartForCurrentUser();
        }

        // ==========================================
        // PAGE & AUTHENTICATION NAVIGATION LOGIC
        // ==========================================
        const rolePages = {
            Admin: "admin.html",
            Vendor: "vendor.html",
            Customer: "products.html",
            Rider: "rider.html"
        };
        const pageRoutes = {
            loginPage: "login.html",
            signupPage: "signup.html",
            customerPage: "customer.html",
            productsPage: "products.html",
            paymentPage: "payment.html",
            reviewsPage: "reviews.html",
            vendorPage: "vendor.html",
            riderPage: "rider.html",
            deliveryPage: "delivery.html"
        };
        let checkoutDraft = JSON.parse(sessionStorage.getItem("atudtaCheckoutDraft") || "null");

        function getVendorBusinessId(vendor) {
            const stallNumber = String(vendor?.stallNumber || "").trim().toLowerCase().replace(/\s+/g, " ");
            const stallName = String(vendor?.stallName || "").trim().toLowerCase().replace(/\s+/g, " ");
            return stallNumber && stallName
                ? `stall:${stallNumber}|${stallName}`
                : `vendor:${vendor?.id || ""}`;
        }

        function getProductBusinessId(product) {
            if (product.businessId) {
                return product.businessId;
            }
            const owner = users.find(user => user.id === product.vendorId);
            return owner ? getVendorBusinessId(owner) : `vendor:${product.vendorId || ""}`;
        }

        function isProductInCurrentVendorBusiness(product) {
            return Boolean(currentUser?.role === "Vendor" &&
                getProductBusinessId(product) === getVendorBusinessId(currentUser));
        }

        function getOrderItemsForCurrentVendorBusiness(order) {
            if (!currentUser || currentUser.role !== "Vendor") {
                return [];
            }
            return (order.items || []).filter(item => {
                if (item.businessId) {
                    return item.businessId === getVendorBusinessId(currentUser);
                }
                const product = products.find(candidate => candidate.id === item.productId);
                return product && isProductInCurrentVendorBusiness(product);
            });
        }

        function isOrderInCurrentVendorBusiness(order) {
            return getOrderItemsForCurrentVendorBusiness(order).length > 0;
        }

        function updateSignupRoleFields() {
            const role = document.getElementById("signupRole").value;
            const roleFields = {
                Vendor: document.getElementById("vendorSignupFields"),
                Rider: document.getElementById("riderSignupFields")
            };

            Object.entries(roleFields).forEach(([fieldRole, container]) => {
                const isVisible = role === fieldRole;
                container.classList.toggle("hidden", !isVisible);
                container.querySelectorAll("input, select").forEach(field => {
                    field.required = isVisible;
                });
            });
        }

        document.getElementById("signupRole")?.addEventListener("change", updateSignupRoleFields);
        if (document.getElementById("signupRole")) {
            updateSignupRoleFields();
        }

        document.getElementById("signupEmail")?.addEventListener("input", function() {
            this.value = this.value.trim().toLowerCase();
        });
        document.getElementById("loginEmail")?.addEventListener("input", function() {
            this.value = this.value.trim().toLowerCase();
        });

        function updateLoginButton() {
            const emailInput = document.getElementById("loginEmail");
            const passwordInput = document.getElementById("loginPassword");
            const button = document.getElementById("loginSubmitButton");
            if (!emailInput || !passwordInput || !button) {
                return;
            }
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const canSubmit = email.length > 0 && password.length > 0;

            button.disabled = !canSubmit;
            button.classList.toggle("bg-sage-600", canSubmit);
            button.classList.toggle("hover:bg-sage-700", canSubmit);
            button.classList.toggle("bg-slate-300", !canSubmit);
            button.classList.toggle("text-slate-500", !canSubmit);
            button.classList.toggle("cursor-not-allowed", !canSubmit);
        }

        document.getElementById("loginEmail")?.addEventListener("input", updateLoginButton);
        document.getElementById("loginPassword")?.addEventListener("input", updateLoginButton);
        if (document.getElementById("loginSubmitButton")) {
            updateLoginButton();
        }

        function togglePasswordVisibility(inputId, button) {
            const input = document.getElementById(inputId);
            const shouldShow = input.type === "password";
            input.type = shouldShow ? "text" : "password";
            button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
            button.setAttribute("aria-pressed", String(shouldShow));
            button.innerHTML = `<i class="fa-solid ${shouldShow ? "fa-eye-slash" : "fa-eye"}"></i>`;
        }

        function showPage(pageId) {
            const route = pageRoutes[pageId];
            if (!route) {
                throw new Error(`Unknown page route: ${pageId}`);
            }
            window.location.assign(route);
        }

        function renderAuthHeaderButtons() {
            const container = document.getElementById("headerAuthButtons");
            container.replaceChildren();
            if (currentUser) {
                const customerPage = document.getElementById("customerPage");
                if (currentUser.role === "Customer" && customerPage) {
                    const sidebarToggle = document.createElement("button");
                    sidebarToggle.id = "customerSidebarToggle";
                    sidebarToggle.type = "button";
                    sidebarToggle.className = "glass-card w-10 h-10 rounded-full shadow-sm text-sage-800 hover:bg-sage-50 transition flex items-center justify-center";
                    sidebarToggle.setAttribute("aria-expanded", "false");
                    sidebarToggle.setAttribute("aria-label", "Open customer menu");
                    sidebarToggle.title = "Open customer menu";
                    sidebarToggle.innerHTML = '<i class="fa-solid fa-bars text-lg" aria-hidden="true"></i>';
                    sidebarToggle.addEventListener("click", toggleCustomerSidebar);
                    container.appendChild(sidebarToggle);
                }

                const profileButton = document.createElement("button");
                profileButton.type = "button";
                profileButton.className = "w-10 h-10 rounded-full bg-white/15 text-white shadow hover:bg-white/25 transition flex items-center justify-center";
                profileButton.setAttribute("aria-label", "Settings");
                profileButton.title = "Settings";
                profileButton.innerHTML = '<i class="fa-solid fa-gear text-lg" aria-hidden="true"></i>';
                profileButton.addEventListener("click", () => toggleSettingsModal(true));

                const logoutButton = document.createElement("button");
                logoutButton.type = "button";
                logoutButton.className = "text-xs bg-rose-500 hover:bg-rose-600 text-white font-bold px-3 py-1.5 rounded-lg transition";
                logoutButton.textContent = "Logout";
                logoutButton.addEventListener("click", logout);
                container.append(profileButton, logoutButton);
            }
        }

        function addProfileDetail(label, value) {
            if (!value) {
                return;
            }

            const row = document.createElement("div");
            row.className = "flex justify-between gap-4 border-b border-slate-100 pb-2";
            const term = document.createElement("dt");
            term.className = "font-semibold text-slate-500";
            term.textContent = label;
            const description = document.createElement("dd");
            description.className = "text-right text-slate-800";
            description.textContent = value;
            row.append(term, description);
            document.getElementById("profileRoleDetails").appendChild(row);
        }

        function profileAddressValue(user) {
            return user.address ||
                [user.houseNumber, user.streetName, user.purok, user.barangay, "Polangui", "Albay"]
                    .filter(Boolean).join(", ");
        }

        function createSettingsMenuItem(label, description, iconClass, onClick, className = "") {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 ${className}`;
            const icon = document.createElement("i");
            icon.className = `${iconClass} w-5 text-center text-emerald-700`;
            icon.setAttribute("aria-hidden", "true");
            const text = document.createElement("span");
            text.className = "min-w-0 flex-1";
            const title = document.createElement("span");
            title.className = "block font-semibold text-slate-800";
            title.textContent = label;
            const detail = document.createElement("span");
            detail.className = "mt-0.5 block text-xs text-slate-500";
            detail.textContent = description;
            text.append(title, detail);
            const arrow = document.createElement("i");
            arrow.className = "fa-solid fa-chevron-right text-xs text-slate-400";
            arrow.setAttribute("aria-hidden", "true");
            button.append(icon, text, arrow);
            button.addEventListener("click", onClick);
            return button;
        }

        function ensureSettingsInterface() {
            const modalContent = document.querySelector("#profileModal > .glass-card");
            let profileView = document.getElementById("profileDetailsView");
            if (profileView) {
                return;
            }

            const closeButton = modalContent.querySelector('button[aria-label="Close profile"]');
            profileView = document.createElement("section");
            profileView.id = "profileDetailsView";
            profileView.className = "hidden";
            [...modalContent.children].forEach(child => {
                if (child !== closeButton) {
                    profileView.appendChild(child);
                }
            });

            const settingsHome = document.createElement("section");
            settingsHome.id = "settingsHome";
            settingsHome.className = "space-y-3";
            const settingsTitle = document.createElement("h2");
            settingsTitle.className = "mb-5 text-2xl font-bold text-sage-800";
            settingsTitle.textContent = "Settings";
            settingsHome.appendChild(settingsTitle);
            settingsHome.append(
                createSettingsMenuItem("My Profile", "View or update your profile details", "fa-solid fa-user", () => toggleProfileModal(true)),
                createSettingsMenuItem("Privacy and Policy", "Learn how account and order data is handled", "fa-solid fa-shield-halved", () => showSettingsView("settingsPrivacy")),
                createSettingsMenuItem("Account deletion", "Delete your account and sign out", "fa-solid fa-user-slash", event => deleteAccount(event), "border-rose-200 hover:border-rose-300 hover:bg-rose-50")
            );

            const adminUsersView = document.createElement("section");
            adminUsersView.id = "settingsAdminUsers";
            adminUsersView.className = "hidden space-y-4";
            const adminUsersBackButton = document.createElement("button");
            adminUsersBackButton.type = "button";
            adminUsersBackButton.className = "mb-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800";
            adminUsersBackButton.textContent = "← Settings";
            adminUsersBackButton.addEventListener("click", () => showSettingsView("settingsHome"));
            const adminUsersTitle = document.createElement("h2");
            adminUsersTitle.className = "text-2xl font-bold text-sage-800";
            adminUsersTitle.textContent = "Admin Users";
            const createAdminForm = document.getElementById("createAdminForm");
            if (currentUser?.role === "Admin" && currentUser.adminLevel === "super_admin" && createAdminForm) {
                settingsHome.appendChild(createSettingsMenuItem(
                    "Admin Users",
                    "Create another Admin account",
                    "fa-solid fa-user-shield",
                    () => showSettingsView("settingsAdminUsers")
                ));
                createAdminForm.classList.remove("hidden");
                adminUsersView.append(adminUsersBackButton, adminUsersTitle, createAdminForm);
            }

            const privacyView = document.createElement("section");
            privacyView.id = "settingsPrivacy";
            privacyView.className = "hidden space-y-4";
            const backButton = document.createElement("button");
            backButton.type = "button";
            backButton.className = "mb-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800";
            backButton.textContent = "← Settings";
            backButton.addEventListener("click", () => showSettingsView("settingsHome"));
            const privacyTitle = document.createElement("h2");
            privacyTitle.className = "text-2xl font-bold text-sage-800";
            privacyTitle.textContent = "Privacy and Policy";
            const privacyIntro = document.createElement("p");
            privacyIntro.className = "text-sm leading-6 text-slate-600";
            privacyIntro.textContent = "AtudTA uses account and marketplace information to provide its wet market ordering and delivery features.";
            const privacyList = document.createElement("ul");
            privacyList.className = "list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600";
            [
                "Account details such as your name, email, contact number, address, and role are used to identify your account and support orders and deliveries.",
                "Vendor stall information, product listings, orders, payments, deliveries, and reviews are stored in the platform database to operate marketplace features.",
                "Your profile details can be reviewed and updated from Settings. Do not share your password with others.",
                "If you delete your account, it is marked as deleted in the database, your active sessions are revoked, and you can no longer sign in. Existing marketplace records may remain for operational history."
            ].forEach(text => {
                const item = document.createElement("li");
                item.textContent = text;
                privacyList.appendChild(item);
            });
            privacyView.append(backButton, privacyTitle, privacyIntro, privacyList);

            const profileBackButton = document.createElement("button");
            profileBackButton.type = "button";
            profileBackButton.className = "mb-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800";
            profileBackButton.textContent = "← Settings";
            profileBackButton.addEventListener("click", () => showSettingsView("settingsHome"));
            profileView.insertBefore(profileBackButton, profileView.firstChild);

            modalContent.append(settingsHome, privacyView, profileView, adminUsersView);
        }

        function showSettingsView(viewId) {
            ensureSettingsInterface();
            ["settingsHome", "settingsPrivacy", "profileDetailsView", "settingsAdminUsers"].forEach(id => {
                const view = document.getElementById(id);
                if (view) {
                    view.classList.toggle("hidden", id !== viewId);
                }
            });
        }

        function toggleSettingsModal(open) {
            const modal = document.getElementById("profileModal");
            if (!modal) {
                return;
            }
            if (open) {
                if (!currentUser) {
                    return;
                }
                ensureSettingsInterface();
                showSettingsView("settingsHome");
            }
            modal.classList.toggle("hidden", !open);
        }

        function createProfileEditField(form, id, labelText, value, options = {}) {
            const wrapper = document.createElement("div");
            const label = document.createElement("label");
            label.htmlFor = id;
            label.className = "mb-1 block text-xs font-semibold uppercase text-slate-600";
            label.textContent = labelText;

            const input = document.createElement("input");
            input.id = id;
            input.name = id;
            input.type = options.type || "text";
            input.value = value || "";
            input.required = true;
            input.autocomplete = options.autocomplete || "off";
            input.className = "w-full rounded-xl border border-slate-300 px-4 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-sage-500";
            if (options.pattern) {
                input.pattern = options.pattern;
            }
            if (options.inputmode) {
                input.inputMode = options.inputmode;
            }
            if (options.title) {
                input.title = options.title;
            }

            wrapper.append(label, input);
            form.appendChild(wrapper);
        }

        function ensureProfileEditor() {
            const modalContent = document.getElementById("profileDetailsView") ||
                document.querySelector("#profileModal > .glass-card");
            let editor = document.getElementById("profileEditForm");
            if (editor) {
                return editor;
            }

            const container = document.createElement("div");
            container.id = "profileEditContainer";
            container.className = "mt-5";
            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700";
            editButton.textContent = "Edit Profile";

            editor = document.createElement("form");
            editor.id = "profileEditForm";
            editor.className = "hidden space-y-4";
            editor.addEventListener("submit", saveUserProfile);

            const heading = document.createElement("h3");
            heading.className = "font-bold text-slate-800";
            heading.textContent = "Update Profile";
            editor.appendChild(heading);
            createProfileEditField(editor, "profileEditName", "Full Name", "", { autocomplete: "name" });
            createProfileEditField(editor, "profileEditContact", "Contact Number", "", {
                autocomplete: "tel",
                inputmode: "numeric",
                pattern: "09[0-9]{9}",
                title: "Enter an 11-digit number starting with 09."
            });
            createProfileEditField(editor, "profileEditAddress", "Complete Address", "", {
                autocomplete: "street-address"
            });

            const vendorFields = [
                ["profileEditBusinessRole", "Role in the Business"],
                ["profileEditBadgeNumber", "Badge Number"],
                ["profileEditStallNumber", "Stall Number"],
                ["profileEditStallName", "Stall Name"]
            ];
            vendorFields.forEach(([id, label]) => {
                createProfileEditField(editor, id, label, "");
            });
            const badgeNumberInput = editor.querySelector("#profileEditBadgeNumber");
            badgeNumberInput.pattern = "\\d{3}-\\d{3}-\\d{3}";
            badgeNumberInput.title = "Use the 111-222-333 format.";

            createProfileEditField(editor, "profileEditLicenseNumber", "Driver's License Number", "");
            const licenseNumberInput = editor.querySelector("#profileEditLicenseNumber");
            licenseNumberInput.pattern = "[A-Za-z0-9]{12}";
            licenseNumberInput.title = "Enter 12 letters and/or numbers.";

            const actions = document.createElement("div");
            actions.className = "flex justify-end gap-2";
            const cancelButton = document.createElement("button");
            cancelButton.type = "button";
            cancelButton.className = "rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200";
            cancelButton.textContent = "Cancel";
            cancelButton.addEventListener("click", closeProfileEditor);
            const saveButton = document.createElement("button");
            saveButton.type = "submit";
            saveButton.className = "rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700";
            saveButton.textContent = "Save Profile";
            actions.append(cancelButton, saveButton);
            editor.appendChild(actions);

            editButton.addEventListener("click", () => openProfileEditor(editor, editButton));
            container.append(editButton, editor);
            modalContent.appendChild(container);
            document.getElementById("profileAddressEditButton")?.remove();
            document.getElementById("profileAddressEditor")?.remove();
            return editor;
        }

        async function deleteAccount(event) {
            if (!currentUser) {
                return;
            }
            if (!await showConfirmation({
                title: "Delete your account",
                message: "You will no longer be able to sign in. The account record will be retained in the database as deleted.",
                confirmLabel: "Delete Account",
                danger: true
            })) {
                return;
            }

            const button = event.currentTarget;
            button.disabled = true;
            try {
                await apiRequest("/api/auth/profile", { method: "DELETE" });
                users = users.filter(user => user.id !== currentUser.id);
                try {
                    localStorage.setItem("atudtaUsers", JSON.stringify(users));
                } catch (error) {
                    console.error("Deleted account could not be removed from this browser's cached users.", error);
                }
                sessionStorage.removeItem("atudtaAuthToken");
                sessionStorage.removeItem("atudtaSession");
                showToast("Your account has been deleted.");
                window.setTimeout(() => window.location.replace("login.html"), 1800);
            } catch (error) {
                button.disabled = false;
                console.error("Could not delete account.", error);
                showToast(error.message || "Could not delete your account.", "error");
            }
        }

        function openProfileEditor(editor, editButton) {
            if (!currentUser) {
                return;
            }

            document.getElementById("profileEditName").value = currentUser.name || "";
            document.getElementById("profileEditContact").value = currentUser.contact || currentUser.contactNumber || "";
            document.getElementById("profileEditAddress").value = profileAddressValue(currentUser);
            document.getElementById("profileEditBusinessRole").value = currentUser.businessRole || "";
            document.getElementById("profileEditBadgeNumber").value = currentUser.badgeNumber || "";
            document.getElementById("profileEditStallNumber").value = currentUser.stallNumber || "";
            document.getElementById("profileEditStallName").value = currentUser.stallName || "";
            document.getElementById("profileEditLicenseNumber").value = currentUser.licenseNumber || "";

            const isVendor = currentUser.role === "Vendor";
            const isRider = currentUser.role === "Rider";
            ["profileEditBusinessRole", "profileEditBadgeNumber", "profileEditStallNumber", "profileEditStallName"]
                .forEach(id => {
                    const input = document.getElementById(id);
                    input.parentElement.classList.toggle("hidden", !isVendor);
                    input.required = isVendor;
                    input.disabled = !isVendor;
                });
            const licenseInput = document.getElementById("profileEditLicenseNumber");
            licenseInput.parentElement.classList.toggle("hidden", !isRider);
            licenseInput.required = isRider;
            licenseInput.disabled = !isRider;
            editButton.classList.add("hidden");
            editor.classList.remove("hidden");
        }

        function closeProfileEditor() {
            document.getElementById("profileEditForm")?.classList.add("hidden");
            document.querySelector("#profileEditContainer > button")?.classList.remove("hidden");
        }

        async function saveUserProfile(event) {
            event.preventDefault();
            if (!currentUser) {
                return;
            }
            if (!window.confirm("Are you sure you want to save these profile changes?")) {
                return;
            }

            const form = event.currentTarget;
            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            const profileUpdates = {
                name: document.getElementById("profileEditName").value.trim(),
                contactNumber: document.getElementById("profileEditContact").value.trim(),
                address: document.getElementById("profileEditAddress").value.trim()
            };
            if (currentUser.role === "Vendor") {
                Object.assign(profileUpdates, {
                    businessRole: document.getElementById("profileEditBusinessRole").value.trim(),
                    badgeNumber: document.getElementById("profileEditBadgeNumber").value.trim(),
                    stallNumber: document.getElementById("profileEditStallNumber").value.trim(),
                    stallName: document.getElementById("profileEditStallName").value.trim()
                });
            } else if (currentUser.role === "Rider") {
                profileUpdates.licenseNumber = document.getElementById("profileEditLicenseNumber").value.trim();
            }

            try {
                const result = await apiRequest("/api/auth/profile", {
                    method: "PUT",
                    body: JSON.stringify(profileUpdates)
                });
                if (!result.user?.id) {
                    throw new Error("The server did not confirm the profile update.");
                }

                currentUser = { ...currentUser, ...result.user };
                users = users.map(user => user.id === currentUser.id ? currentUser : user);
                let localCopyFailed = false;
                try {
                    saveData();
                } catch (error) {
                    console.error("Profile was updated on the server, but browser data could not be saved.", error);
                    localCopyFailed = true;
                }

                const headerLabel = document.getElementById("headerUserLabel");
                headerLabel.textContent = `${currentUser.name} (${currentUser.role}) - ${currentUser.barangay || "Polangui"}`;
                toggleProfileModal(true);
                showToast(
                    localCopyFailed
                        ? "Your profile was saved, but this browser could not update its local copy."
                        : "Profile updated.",
                    localCopyFailed ? "error" : "success"
                );
            } catch (error) {
                console.error("Could not update profile.", error);
                showToast(error.message || "Could not update your profile.", "error");
            } finally {
                submitButton.disabled = false;
            }
        }

        function toggleProfileModal(open) {
            const modal = document.getElementById("profileModal");
            if (!modal) {
                return;
            }

            if (open) {
                if (!currentUser) {
                    return;
                }

                ensureSettingsInterface();
                document.getElementById("profileName").textContent = currentUser.name || "Not provided";
                document.getElementById("profileRole").textContent = currentUser.role || "Not provided";
                document.getElementById("profileBirthdate").textContent = currentUser.birthdate || "Not provided";
                document.getElementById("profileContact").textContent = currentUser.contact || "Not provided";
                document.getElementById("profileEmail").textContent = currentUser.email || "Not provided";
                const profilePicture = document.getElementById("profilePicture");
                const hasPicture = Boolean(currentUser.profilePicture);
                profilePicture.classList.toggle("hidden", !hasPicture);
                document.getElementById("profilePicturePlaceholder").classList.toggle("hidden", hasPicture);
                if (hasPicture) {
                    profilePicture.src = currentUser.profilePicture;
                } else {
                    profilePicture.removeAttribute("src");
                }

                const roleDetails = document.getElementById("profileRoleDetails");
                roleDetails.replaceChildren();
                ensureProfileEditor();
                closeProfileEditor();
                addProfileDetail("Address", profileAddressValue(currentUser));
                if (currentUser.role === "Vendor") {
                    addProfileDetail("Role in the Business", currentUser.businessRole);
                    addProfileDetail("Badge Number", currentUser.badgeNumber);
                    addProfileDetail("Stall Number", currentUser.stallNumber);
                    addProfileDetail("Stall Name", currentUser.stallName);
                } else if (currentUser.role === "Rider") {
                    addProfileDetail("Driver's License Number", currentUser.licenseNumber);
                }
                showSettingsView("profileDetailsView");
            }

            modal.classList.toggle("hidden", !open);
        }

        document.getElementById("profilePictureInput")?.addEventListener("change", function() {
            const file = this.files[0];
            if (!file) {
                return;
            }
            if (!file.type.startsWith("image/")) {
                showToast("Choose a valid image file.", "error");
                this.value = "";
                return;
            }
            if (file.size > 1024 * 1024) {
                showToast("Profile pictures must be 1 MB or smaller.", "error");
                this.value = "";
                return;
            }

            const reader = new FileReader();
            reader.addEventListener("load", () => {
                if (!currentUser || typeof reader.result !== "string") {
                    return;
                }

                const previousPicture = currentUser.profilePicture;
                currentUser.profilePicture = reader.result;
                users = users.map(user => user.id === currentUser.id ? currentUser : user);
                try {
                    saveData();
                } catch (error) {
                    currentUser.profilePicture = previousPicture;
                    users = users.map(user => user.id === currentUser.id ? currentUser : user);
                    console.error("Could not save profile picture.", error);
                    showToast("Could not save the profile picture. Browser storage may be full.", "error");
                    this.value = "";
                    return;
                }

                renderAuthHeaderButtons();
                toggleProfileModal(true);
                showToast("Profile picture updated.");
                this.value = "";
            });
            reader.addEventListener("error", () => {
                showToast("Could not read the selected image.", "error");
                this.value = "";
            });
            reader.readAsDataURL(file);
        });

        function initializeSignupBirthdatePicker() {
            const field = document.getElementById("signupBirthdateField");
            if (!field) {
                return;
            }

            const dateInput = document.getElementById("signupBirthdate");
            const trigger = document.getElementById("signupBirthdateButton");
            const display = document.getElementById("signupBirthdateDisplay");
            const picker = document.getElementById("signupBirthdatePicker");
            const monthSelect = document.getElementById("signupBirthdateMonth");
            const yearSelect = document.getElementById("signupBirthdateYear");
            const daysGrid = document.getElementById("signupBirthdateDays");
            const today = new Date();
            const currentYear = today.getUTCFullYear();
            const todayValue = today.toISOString().slice(0, 10);
            const months = Array.from({ length: 12 }, (_, month) =>
                new Intl.DateTimeFormat(undefined, { month: "long", timeZone: "UTC" })
                    .format(new Date(Date.UTC(2020, month, 1))));

            months.forEach((month, index) => {
                const option = document.createElement("option");
                option.value = String(index);
                option.textContent = month;
                monthSelect.appendChild(option);
            });
            for (let year = currentYear; year >= 1900; year -= 1) {
                const option = document.createElement("option");
                option.value = String(year);
                option.textContent = String(year);
                yearSelect.appendChild(option);
            }
            monthSelect.value = String(today.getUTCMonth());
            yearSelect.value = String(currentYear);

            const formatDate = value => new Intl.DateTimeFormat(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC"
            }).format(new Date(`${value}T00:00:00.000Z`));

            const closePicker = restoreFocus => {
                picker.classList.add("hidden");
                trigger.setAttribute("aria-expanded", "false");
                if (restoreFocus) {
                    trigger.focus();
                }
            };

            const renderDays = () => {
                const month = Number(monthSelect.value);
                const year = Number(yearSelect.value);
                const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
                const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
                daysGrid.replaceChildren();

                for (let index = 0; index < firstWeekday; index += 1) {
                    const spacer = document.createElement("span");
                    spacer.className = "h-9";
                    spacer.setAttribute("aria-hidden", "true");
                    daysGrid.appendChild(spacer);
                }

                for (let day = 1; day <= daysInMonth; day += 1) {
                    const dateValue = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isSelected = dateInput.value === dateValue;
                    const isFuture = dateValue > todayValue;
                    const dayButton = document.createElement("button");
                    dayButton.type = "button";
                    dayButton.textContent = String(day);
                    dayButton.disabled = isFuture;
                    dayButton.setAttribute("aria-label", formatDate(dateValue));
                    dayButton.setAttribute("aria-pressed", String(isSelected));
                    dayButton.className = `h-9 w-full rounded-lg text-sm transition ${
                        isSelected
                            ? "bg-sage-600 font-bold text-white"
                            : "text-slate-700 hover:bg-sage-50"
                    } disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent`;
                    dayButton.addEventListener("click", () => {
                        dateInput.value = dateValue;
                        display.textContent = formatDate(dateValue);
                        display.classList.remove("text-slate-500");
                        display.classList.add("text-slate-800");
                        trigger.setAttribute("aria-label", `Birthdate: ${formatDate(dateValue)}`);
                        document.getElementById("signupMessage").textContent = "";
                        closePicker(true);
                    });
                    daysGrid.appendChild(dayButton);
                }
            };

            const setCalendarDate = value => {
                const [year, month] = value.split("-").map(Number);
                if (year >= 1900 && year <= currentYear && month >= 1 && month <= 12) {
                    yearSelect.value = String(year);
                    monthSelect.value = String(month - 1);
                }
            };

            const openPicker = () => {
                if (dateInput.value) {
                    setCalendarDate(dateInput.value);
                }
                renderDays();
                picker.classList.remove("hidden");
                trigger.setAttribute("aria-expanded", "true");
                monthSelect.focus();
            };

            monthSelect.addEventListener("change", renderDays);
            yearSelect.addEventListener("change", renderDays);
            trigger.addEventListener("click", () => {
                if (picker.classList.contains("hidden")) {
                    openPicker();
                } else {
                    closePicker(false);
                }
            });
            document.getElementById("signupBirthdateClear").addEventListener("click", () => {
                dateInput.value = "";
                display.textContent = "Choose your birthdate";
                display.classList.add("text-slate-500");
                display.classList.remove("text-slate-800");
                trigger.setAttribute("aria-label", "Choose your birthdate");
                renderDays();
            });
            document.getElementById("signupBirthdateClose").addEventListener("click", () => closePicker(true));
            document.addEventListener("click", event => {
                if (!picker.classList.contains("hidden") && !field.contains(event.target)) {
                    closePicker(false);
                }
            });
            document.addEventListener("keydown", event => {
                if (event.key === "Escape" && !picker.classList.contains("hidden")) {
                    event.preventDefault();
                    closePicker(true);
                }
            });
        }

        initializeSignupBirthdatePicker();

        // SIGN UP FORM
        document.getElementById("signupForm")?.addEventListener("submit", async function(e) {
            e.preventDefault();
            const message = document.getElementById("signupMessage");
            const submitButton = e.currentTarget.querySelector('button[type="submit"]');
            const firstName = document.getElementById("signupFirstName").value.trim();
            const middleName = document.getElementById("signupMiddleName").value.trim();
            const lastName = document.getElementById("signupLastName").value.trim();
            const name = [firstName, middleName, lastName].filter(Boolean).join(" ");
            const contact = document.getElementById("signupContact").value.trim();
            const birthdate = document.getElementById("signupBirthdate").value;
            const address = document.getElementById("signupAddress").value.trim();
            const email = document.getElementById("signupEmail").value.trim().toLowerCase();
            const password = document.getElementById("signupPassword").value;
            const role = document.getElementById("signupRole").value;

            if (!birthdate) {
                message.textContent = "Please choose your birthdate.";
                const birthdateButton = document.getElementById("signupBirthdateButton");
                birthdateButton.focus();
                if (birthdateButton.getAttribute("aria-expanded") !== "true") {
                    birthdateButton.click();
                }
                return;
            }

            if (!Object.hasOwn(rolePages, role)) {
                document.getElementById("signupMessage").textContent = "Please select a valid account role.";
                return;
            }

            if (!address) {
                document.getElementById("signupMessage").textContent = "Please enter your complete address.";
                return;
            }

            const roleDetails = role === "Customer"
                ? {}
                : role === "Vendor"
                    ? {
                        businessRole: document.getElementById("signupBusinessRole").value.trim(),
                        badgeNumber: document.getElementById("signupBadgeNumber").value.trim(),
                        stallNumber: document.getElementById("signupStallNumber").value.trim(),
                        stallName: document.getElementById("signupStallName").value.trim()
                    }
                    : {
                        licenseNumber: document.getElementById("signupLicenseNumber").value.trim()
                    };

            if (role === "Vendor" &&
                (!roleDetails.businessRole || !roleDetails.badgeNumber || !roleDetails.stallNumber || !roleDetails.stallName)) {
                document.getElementById("signupMessage").textContent = "Complete your business role, badge number, stall number, and stall name.";
                return;
            }
            if (role === "Vendor" && !/^\d{3}-\d{3}-\d{3}$/.test(roleDetails.badgeNumber)) {
                message.textContent = "Badge number must use the 111-222-333 format.";
                document.getElementById("signupBadgeNumber").focus();
                return;
            }

            message.textContent = "";
            submitButton.disabled = true;
            try {
                const result = await apiRequest("/api/register", {
                    method: "POST",
                    body: JSON.stringify({
                        name, contactNumber: contact, birthdate, address, email, password, role, ...roleDetails
                    })
                });

                currentUser = result.user;
                users = users.filter(user => user.id !== currentUser.id);
                users.push(currentUser);
                cart = loadCartForUser(currentUser);
                selectedCartProductIds.clear();
                saveData();
                sessionStorage.setItem("atudtaAuthToken", result.sessionToken);
                sessionStorage.setItem("atudtaSession", currentUser.id);
                document.getElementById("signupForm").reset();
                updateSignupRoleFields();

                showToast(`Account created for ${currentUser.name}!`);
                openDashboard(currentUser.role);
            } catch (error) {
                message.textContent = error.message || "Could not connect to the server. Please try again.";
            } finally {
                submitButton.disabled = false;
            }
        });

        // LOGIN FORM
        document.getElementById("loginForm")?.addEventListener("submit", async function(e) {
            e.preventDefault();
            const email = document.getElementById("loginEmail").value.trim().toLowerCase();
            const password = document.getElementById("loginPassword").value;
            const message = document.getElementById("loginMessage");
            const submitButton = e.currentTarget.querySelector('button[type="submit"]');
            message.textContent = "";
            submitButton.disabled = true;
            try {
                const result = await apiRequest("/api/auth/login", {
                    method: "POST",
                    body: JSON.stringify({ email, password })
                });

                currentUser = result.user;
                users = users.filter(user => user.id !== currentUser.id);
                users.push(currentUser);
                cart = loadCartForUser(currentUser);
                selectedCartProductIds.clear();
                saveData();
                sessionStorage.setItem("atudtaAuthToken", result.sessionToken);
                sessionStorage.setItem("atudtaSession", currentUser.id);
                showToast(`Welcome back, ${currentUser.name}!`);
                openDashboard(currentUser.role);
            } catch (error) {
                message.textContent = error.message || "Could not connect to the server. Please try again.";
            } finally {
                submitButton.disabled = false;
            }
        });

        function openDashboard(role) {
            if (!Object.hasOwn(rolePages, role)) {
                currentUser = null;
                sessionStorage.removeItem("atudtaSession");
                window.location.assign("login.html");
                return;
            }

            window.location.assign(rolePages[role]);
        }

        function logout() {
            currentUser = null;
            cart = [];
            selectedCartProductIds.clear();
            riderCurrentLocation = null;
            riderLocationRequestPending = false;
            const locationButton = document.getElementById("riderLocationButton");
            if (locationButton) {
                locationButton.disabled = false;
                locationButton.classList.remove("opacity-60", "cursor-not-allowed");
            }
            const locationStatus = document.getElementById("riderLocationStatus");
            if (locationStatus) {
                locationStatus.textContent = "Get your location to review it before accepting a delivery.";
            }
            document.getElementById("riderLocationMapLink")?.classList.add("hidden");
            sessionStorage.removeItem("atudtaSession");
            sessionStorage.removeItem("atudtaAuthToken");
            showPage("loginPage");
        }

        // ==========================================
        // CUSTOMER DASHBOARD (OmniMarket)
        // ==========================================
        function toggleCustomerSidebar() {
            const button = document.getElementById("customerSidebarToggle");
            const isOpening = button.getAttribute("aria-expanded") !== "true";
            ["customerCategoriesPanel", "customerIncomingOrdersPanel", "customerReviewableOrdersPanel", "customerMyReviewsPanel"]
                .forEach(panelId => document.getElementById(panelId).classList.toggle("hidden", !isOpening));
            const layout = document.getElementById("customerCatalogLayout");
            const sidebar = document.getElementById("customerSidebar");
            const content = document.getElementById("customerCatalogContent");
            sidebar.classList.toggle("customer-sidebar-open", isOpening);
            document.getElementById("customerWelcomeBanner").classList.toggle("customer-menu-open", isOpening);
            layout.classList.toggle("lg:grid-cols-4", isOpening);
            sidebar.classList.toggle("lg:col-span-1", isOpening);
            content.classList.toggle("lg:col-span-3", isOpening);
            document.body.classList.toggle("overflow-hidden", isOpening);
            button.setAttribute("aria-expanded", String(isOpening));
            button.setAttribute("aria-label", isOpening ? "Close customer menu" : "Open customer menu");
            button.title = isOpening ? "Close customer menu" : "Open customer menu";
            button.innerHTML = `<i class="fa-solid ${isOpening ? "fa-xmark" : "fa-bars"} text-xl" aria-hidden="true"></i>`;
        }

        function filterCategory(cat) {
            selectedCategory = cat;
            document.querySelectorAll(".categoryBtn").forEach(btn => {
                const isActive = btn.textContent.includes(cat) || (cat === 'All' && btn.textContent.includes('All'));
                btn.className = `categoryBtn w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition ${
                    isActive ? 'bg-sage-600 text-white' : 'hover:bg-slate-100 text-slate-600'
                }`;
            });
            renderCustomerProducts();
        }

        function renderCustomerProducts() {
            const grid = document.getElementById("customerProductsGrid");
            const search = document.getElementById("productSearchInput").value.toLowerCase();

            const filtered = products.filter(p => {
                const matchesCat = selectedCategory === "All" || p.category === selectedCategory;
                const matchesSearch = p.name.toLowerCase().includes(search);
                return matchesCat && matchesSearch;
            });

            if (filtered.length === 0) {
                grid.innerHTML = `<p class="col-span-full text-center text-slate-400 py-10 font-semibold">No wet market products found.</p>`;
                return;
            }

            const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[character]);

            grid.innerHTML = filtered.map(p => {
                const vendor = users.find(user => user.id === p.vendorId);
                const storeName = p.vendorName || vendor?.stallName || "AtudTA Market Vendor";
                const stock = getProductStock(p);
                const isAvailable = p.inStock && (stock === null || stock > 0);
                const stockText = stock === null
                    ? "Stock not set"
                    : `Stock: ${formatQuantity(stock)} ${getStockUnitLabel(p.stockUnit)}`;
                return `
                <div class="glass-card rounded-2xl border border-slate-300 overflow-hidden shadow-xl hover:shadow-2xl transition flex flex-col justify-between">
                    <button type="button" onclick="openProductDetails('${p.id}')" class="w-full p-4 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sage-500">
                        <div class="w-full h-32 bg-sage-50 rounded-xl mb-3 flex items-center justify-center text-4xl overflow-hidden">
                            ${p.imageData
                                ? `<img src="${p.imageData}" alt="${p.name}" class="w-full h-full object-cover">`
                                : (p.category === 'Fruits' ? '🍎' : p.img === 'fish' ? '🐟' : p.img === 'pork' ? '🥩' : p.img === 'tomato' ? '🍅' : '🧄')}
                        </div>
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">${p.category}</span>
                        <h4 class="font-bold text-slate-800 text-base mt-1">${escapeHTML(p.name)}</h4>
                        <p class="text-xs text-slate-500 mt-1">Store: ${escapeHTML(storeName)}</p>
                        <p class="text-spink-600 font-extrabold text-lg mt-1">₱${p.price.toFixed(2)} / ${getStockUnitLabel(p.stockUnit)}</p>
                        <p class="text-xs font-semibold ${isAvailable ? 'text-emerald-700' : 'text-rose-600'} mt-1">${stockText}</p>
                        <span class="mt-2 inline-block text-xs font-semibold text-sage-700">View product details & customer reviews</span>
                    </button>
                    <div class="p-4 pt-0">
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="addToCart('${p.id}')" ${!isAvailable ? 'disabled' : ''} 
                                class="col-span-2 py-2 bg-spink-400 hover:bg-spink-600 disabled:bg-slate-200 text-white font-bold rounded-xl text-sm transition">
                                ${isAvailable ? 'Add to Cart' : 'Out of Stock'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
        }

        function addToCart(prodId) {
            const prod = products.find(p => p.id === prodId);
            if (!prod || !prod.inStock) return;

            const existing = cart.find(c => c.productId === prodId);
            const stock = getProductStock(prod);
            const step = getCartQuantityStep(prod);
            const quantityToAdd = existing
                ? step
                : stock !== null && stock < 1 ? stock : 1;
            if (stock !== null && (stock <= 0 || (existing?.quantity || 0) + quantityToAdd > stock + 1e-8)) {
                showToast("There is not enough stock available for that quantity.", "error");
                return;
            }
            if (existing) {
                existing.quantity = Math.round((existing.quantity + quantityToAdd) * 100) / 100;
            } else {
                cart.push({
                    productId: prod.id,
                    name: prod.name,
                    price: prod.price,
                    quantity: quantityToAdd,
                    stockUnit: prod.stockUnit || "piece",
                    vendorId: prod.vendorId,
                    businessId: getProductBusinessId(prod)
                });
            }

            updateCartUI();
            showToast(`Added ${prod.name} to cart!`);
        }

        function updateCartUI() {
            saveCartForCurrentUser();
            document.getElementById("cartBadgeCount").textContent = cart.length;

            const list = document.getElementById("cartItemsList");
            if (cart.length === 0) {
                list.innerHTML = `<p class="text-center text-slate-400 py-4">Your cart is empty.</p>`;
            } else {
                const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                })[character]);
                list.innerHTML = cart.map(item => {
                    const product = products.find(candidate => candidate.id === item.productId);
                    const vendor = product ? users.find(user => user.id === product.vendorId) : null;
                    const storeName = product?.vendorName || vendor?.stallName || "AtudTA Market Vendor";
                    const image = product?.imageData
                        ? `<img src="${product.imageData}" alt="${escapeHTML(item.name)}" class="w-20 h-20 rounded-xl object-cover">`
                        : `<div class="w-20 h-20 rounded-xl bg-sage-50 flex items-center justify-center text-3xl" aria-label="No product photo">${product?.category === "Fruits" ? "🍎" : product?.img === "fish" ? "🐟" : product?.img === "pork" ? "🥩" : product?.img === "tomato" ? "🍅" : "🧄"}</div>`;
                    return `
                        <article class="py-4 flex items-center gap-3 text-sm">
                            <input type="checkbox" ${selectedCartProductIds.has(item.productId) ? "checked" : ""}
                                onchange="setCartItemSelected('${item.productId}', this.checked)"
                                aria-label="Select ${escapeHTML(item.name)} for checkout"
                                class="h-5 w-5 shrink-0 accent-pink-600">
                            ${image}
                            <div class="min-w-0 flex-1">
                                <p class="font-bold text-slate-800 break-words">${escapeHTML(item.name)}</p>
                                <p class="text-xs text-slate-500 mt-1">${escapeHTML(product?.category || "Product")}</p>
                                <p class="text-xs text-slate-500">Store: ${escapeHTML(storeName)}</p>
                                <p class="text-xs text-slate-500 mt-1">₱${item.price.toFixed(2)} / ${getStockUnitLabel(product?.stockUnit || item.stockUnit)}</p>
                                <div class="flex items-center gap-2 mt-2">
                                    <button type="button" onclick="changeCartQuantity('${item.productId}', -1)"
                                        aria-label="Decrease ${escapeHTML(item.name)} quantity"
                                        class="w-7 h-7 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold">−</button>
                                    <span class="min-w-6 text-center font-semibold" aria-label="Quantity">${formatQuantity(item.quantity)} ${getStockUnitLabel(product?.stockUnit || item.stockUnit)}</span>
                                    <button type="button" onclick="changeCartQuantity('${item.productId}', 1)"
                                        ${product && getProductStock(product) !== null && item.quantity >= getProductStock(product) ? "disabled" : ""}
                                        aria-label="Increase ${escapeHTML(item.name)} quantity"
                                        class="w-7 h-7 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold disabled:opacity-40 disabled:cursor-not-allowed">+</button>
                                </div>
                                <p class="font-extrabold text-spink-600 mt-1">Subtotal: ₱${(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                            <button type="button" onclick="removeFromCart('${item.productId}')" aria-label="Remove ${escapeHTML(item.name)} from cart"
                                class="self-start text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-semibold text-xs px-2 py-1 rounded-lg">
                                Delete
                            </button>
                        </article>
                    `;
                }).join("");
            }

            selectedCartProductIds = new Set(cart
                .filter(item => selectedCartProductIds.has(item.productId))
                .map(item => item.productId));
            const selectedItems = cart.filter(item => selectedCartProductIds.has(item.productId));
            const selectAllCheckbox = document.getElementById("selectAllCartItems");
            selectAllCheckbox.disabled = cart.length === 0;
            selectAllCheckbox.checked = cart.length > 0 && selectedItems.length === cart.length;
            selectAllCheckbox.indeterminate = selectedItems.length > 0 && selectedItems.length < cart.length;
            const deleteSelectedButton = document.getElementById("deleteSelectedCartItemsButton");
            deleteSelectedButton.disabled = selectedItems.length === 0;
            deleteSelectedButton.innerHTML = `<i class="fa-solid fa-trash-can mr-1"></i> Delete selected${selectedItems.length ? ` (${selectedItems.length})` : ""}`;
            const totalPrice = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            document.getElementById("cartTotalPrice").textContent = `₱${totalPrice.toFixed(2)}`;
            const proceedButton = document.getElementById("proceedToCheckoutButton");
            const selectedQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
            proceedButton.disabled = selectedItems.length === 0;
            proceedButton.textContent = selectedItems.length
                ? `Continue to checkout (${selectedQuantity} item${selectedQuantity === 1 ? "" : "s"})`
                : "Select products to continue";
            if (!selectedItems.length && !document.getElementById("checkoutDetailsStep").classList.contains("hidden")) {
                returnToCartItems();
            }
        }

        function setCartItemSelected(prodId, isSelected) {
            if (isSelected) {
                selectedCartProductIds.add(prodId);
            } else {
                selectedCartProductIds.delete(prodId);
            }
            updateCartUI();
        }

        function setAllCartItemsSelected(isSelected) {
            selectedCartProductIds = isSelected
                ? new Set(cart.map(item => item.productId))
                : new Set();
            updateCartUI();
        }

        async function removeSelectedCartItems() {
            if (selectedCartProductIds.size === 0) {
                showToast("Select at least one product to delete.", "error");
                return;
            }

            const selectedIds = new Set(selectedCartProductIds);
            const selectedCount = cart.filter(item => selectedIds.has(item.productId)).length;
            if (!await showConfirmation({
                title: "Remove products from cart?",
                message: `Remove ${selectedCount} selected product${selectedCount === 1 ? "" : "s"} from your cart?`,
                confirmLabel: "Remove Products",
                danger: true
            })) {
                return;
            }

            cart = cart.filter(item => !selectedIds.has(item.productId));
            selectedCartProductIds.clear();
            updateCartUI();
            showToast(`${selectedCount} selected product${selectedCount === 1 ? "" : "s"} removed from your cart.`);
        }

        function changeCartQuantity(prodId, change) {
            const item = cart.find(cartItem => cartItem.productId === prodId);
            if (!item) {
                return;
            }
            const product = products.find(candidate => candidate.id === prodId);
            const step = getCartQuantityStep(product || item);
            const stock = product ? getProductStock(product) : null;
            const nextQuantity = Math.round((item.quantity + change * step) * 100) / 100;
            if (change > 0 && stock !== null && nextQuantity > stock + 1e-8) {
                showToast("There is not enough stock available for that quantity.", "error");
                return;
            }
            item.quantity = nextQuantity;
            if (item.quantity <= 0) {
                cart = cart.filter(cartItem => cartItem.productId !== prodId);
                selectedCartProductIds.delete(prodId);
            }
            updateCartUI();
        }

        async function removeFromCart(prodId) {
            const item = cart.find(cartItem => cartItem.productId === prodId);
            if (!item) {
                return;
            }
            if (!await showConfirmation({
                title: "Remove product from cart?",
                message: `Remove "${item.name}" from your cart?`,
                confirmLabel: "Remove Product",
                danger: true
            })) {
                return;
            }

            cart = cart.filter(c => c.productId !== prodId);
            selectedCartProductIds.delete(prodId);
            updateCartUI();
            showToast(`${item.name} was removed from your cart.`);
        }

        function toggleCartModal(open) {
            const modal = document.getElementById("cartModal");
            modal.classList.toggle("hidden", !open);
            if (open) {
                returnToCartItems();
            }
        }

        function startCheckout() {
            const selectedItems = cart
                .filter(item => selectedCartProductIds.has(item.productId))
                .map(item => ({ ...item }));
            if (!currentUser || currentUser.role !== "Customer") {
                showToast("Log in as a customer before checking out.", "error");
                return;
            }
            if (!selectedItems.length) {
                showToast("Select at least one product to continue.", "error");
                return;
            }

            checkoutDraft = selectedItems;
            sessionStorage.setItem("atudtaCheckoutDraft", JSON.stringify(checkoutDraft));
            window.location.assign("payment.html");
        }

        function returnToCartItems() {
            const checkoutDetailsStep = document.getElementById("checkoutDetailsStep");
            const cartItemsStep = document.getElementById("cartItemsStep");
            if (checkoutDetailsStep && cartItemsStep) {
                checkoutDetailsStep.classList.add("hidden");
                cartItemsStep.classList.remove("hidden");
                return;
            }
            window.location.assign("products.html");
        }

        function renderPaymentPage() {
            const list = document.getElementById("paymentSelectedItems");
            if (!list) {
                return;
            }
            if (!currentUser || currentUser.role !== "Customer") {
                return;
            }
            if (!Array.isArray(checkoutDraft) || checkoutDraft.length === 0) {
                list.innerHTML = `<p class="py-3 text-sm text-slate-500">No items selected for checkout. Return to the product page and select items in your cart.</p>`;
                document.querySelector("#checkoutForm button[type='submit']").disabled = true;
                return;
            }

            const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[character]);
            list.innerHTML = checkoutDraft.map(item => `
                <div class="py-2 flex justify-between gap-3 text-sm">
                    <span class="font-semibold text-slate-700">${escapeHTML(item.name)} × ${formatQuantity(item.quantity)} ${getStockUnitLabel(item.stockUnit)}</span>
                    <span class="font-bold text-slate-700">₱${(item.price * item.quantity).toFixed(2)}</span>
                </div>
            `).join("");
            const subtotal = checkoutDraft.reduce((sum, item) => sum + item.price * item.quantity, 0);
            document.getElementById("checkoutItemsSubtotal").textContent = `₱${subtotal.toFixed(2)}`;
            document.getElementById("checkoutDeliveryFee").textContent = `₱${DELIVERY_FEE.toFixed(2)}`;
            document.getElementById("checkoutTotalPrice").textContent = `₱${(subtotal + DELIVERY_FEE).toFixed(2)}`;
            document.getElementById("checkoutAddress").value =
                currentUser.address ||
                [currentUser.houseNumber && `House ${currentUser.houseNumber}`, currentUser.streetName,
                    currentUser.purok, currentUser.barangay, "Polangui", "Albay"]
                    .filter(Boolean).join(", ");
        }

        async function handleCheckout(e) {
            e.preventDefault();
            const submitButton = e.currentTarget.querySelector("button[type='submit']");
            if (submitButton.disabled) {
                return;
            }
            if (!currentUser || currentUser.role !== "Customer" ||
                !Array.isArray(checkoutDraft) || checkoutDraft.length === 0) {
                showToast("Your checkout session is empty. Return to products and select items again.", "error");
                return;
            }
            const selectedItems = checkoutDraft;
            const unavailableItem = selectedItems.find(item => {
                const product = products.find(candidate => candidate.id === item.productId);
                const stock = product ? getProductStock(product) : 0;
                return !product || !product.inStock || (stock !== null && (stock <= 0 || item.quantity > stock + 1e-8));
            });
            if (unavailableItem) {
                showToast(`${unavailableItem.name} no longer has enough stock. Please review your cart.`, "error");
                renderCustomerProducts();
                return;
            }

            const itemsSubtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const totalAmount = itemsSubtotal + DELIVERY_FEE;
            const address = document.getElementById("checkoutAddress").value;
            const paymentMethod = document.getElementById("checkoutPayment").value;
            const itemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
            if (!await showConfirmation({
                title: "Confirm Order",
                message: `Recipient: ${currentUser.name}\nDelivery address: ${address}`,
                confirmLabel: "Place Order",
                summaryRows: [
                    { label: "Items subtotal", value: `₱${itemsSubtotal.toFixed(2)}` },
                    { label: "Delivery fee", value: `₱${DELIVERY_FEE.toFixed(2)}` }
                ],
                highlightedTotal: `₱${totalAmount.toFixed(2)}`,
                footerMessage: `Place this order for ${itemCount} item(s)?`
            })) {
                return;
            }

            submitButton.disabled = true;
            let createdOrder;
            try {
                const result = await apiRequest("/api/orders/place", {
                    method: "POST",
                    body: JSON.stringify({
                        address,
                        paymentMethod,
                        items: selectedItems.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity
                        }))
                    })
                });
                if (!result.order?.databaseId || !Array.isArray(result.order.items)) {
                    throw new Error("The server did not confirm that your order was saved.");
                }
                createdOrder = result.order;
            } catch (error) {
                submitButton.disabled = false;
                console.error("Could not create customer order.", error);
                showToast(error.message || "Could not save your order.", "error");
                return;
            }

            orders.unshift(createdOrder);
            const selectedIds = new Set(selectedItems.map(item => item.productId));
            cart = cart.filter(item => !selectedIds.has(item.productId));
            try {
                saveData();
            } catch (error) {
                console.error("Order was saved to MongoDB, but local cart data could not be updated.", error);
                showToast("Your order was saved, but this browser could not update its cart.", "error");
            }

            sessionStorage.removeItem("atudtaCheckoutDraft");
            checkoutDraft = null;
            try {
                await loadProductsFromDatabase();
            } catch (error) {
                console.error("Order was saved, but product stock could not be refreshed.", error);
                showToast(error.message || "Order saved, but product stock could not be refreshed.", "error");
            }
            showToast(`Order ${createdOrder.id} placed successfully!`);
            window.location.assign("customer.html");
        }

        function getCustomerOrders() {
            return currentUser && currentUser.role === "Customer"
                ? orders.filter(order => order.userId === currentUser.id)
                : [];
        }

        function hasReviewedOrderItem(orderId, productId) {
            return reviews.some(review =>
                review.userId === currentUser?.id &&
                review.orderId === orderId &&
                review.productId === productId
            );
        }

        function formatOrderDateTime(value) {
            if (!value) {
                return "";
            }
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
        }

        function getCustomerOrderStatusDetails(status) {
            const statuses = {
                Pending: {
                    label: "Preparing",
                    description: "The vendor is preparing your order.",
                    badgeClass: "bg-amber-100 text-amber-700"
                },
                Packed: {
                    label: "Packed · Ready for rider pickup",
                    description: "Your order is packed and waiting for a rider.",
                    badgeClass: "bg-blue-100 text-blue-700"
                },
                "Out for Delivery": {
                    label: "Out for delivery",
                    description: "A rider is bringing your order to you.",
                    badgeClass: "bg-emerald-100 text-emerald-700"
                }
            };
            return statuses[status] || {
                label: "Status updated",
                description: "Your order status has been updated.",
                badgeClass: "bg-slate-100 text-slate-700"
            };
        }

        function renderCustomerOrderLists() {
            if (!document.getElementById("customerIncomingOrdersList") ||
                !document.getElementById("customerReviewableOrdersList")) {
                return;
            }
            const myOrders = getCustomerOrders();
            const incomingOrders = myOrders.filter(order => order.orderStatus !== "Delivered");
            const incomingList = document.getElementById("customerIncomingOrdersList");
            incomingList.innerHTML = incomingOrders.length
                ? incomingOrders.map(order => {
                    const status = getCustomerOrderStatusDetails(order.orderStatus);
                    const pickupAt = formatOrderDateTime(order.pickupAt);
                    const estimatedDeliveryAt = formatOrderDateTime(order.estimatedDeliveryAt);
                    return `
                    <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                        <div class="flex flex-wrap justify-between items-center gap-2 font-bold text-slate-700">
                            <span>${order.id}</span>
                            <span class="px-2 py-1 rounded-full ${status.badgeClass}">${status.label}</span>
                        </div>
                        <p class="text-slate-400 mt-1">${order.items.length} items • ₱${order.totalAmount.toFixed(2)}</p>
                        <p class="text-slate-600 mt-2">${status.description}</p>
                        ${pickupAt ? `<p class="text-slate-600 mt-2">Rider pickup: ${pickupAt}</p>` : ""}
                        ${estimatedDeliveryAt ? `<p class="font-semibold text-emerald-700 mt-1">Estimated delivery: ${estimatedDeliveryAt}</p>` : ""}
                    </div>
                `;
                }).join("")
                : `<p class="text-xs text-slate-400">No incoming orders.</p>`;

            const deliveredItems = myOrders
                .filter(order => order.orderStatus === "Delivered")
                .flatMap(order => order.items
                    .filter(item => item.productId && !hasReviewedOrderItem(order.id, item.productId))
                    .map(item => ({ order, item })));
            const reviewableList = document.getElementById("customerReviewableOrdersList");
            reviewableList.innerHTML = deliveredItems.length
                ? deliveredItems.map(({ order, item }) => `
                    <div class="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs">
                        <p class="font-bold text-slate-700">${item.name}</p>
                        <p class="text-slate-500 mt-1">Order ${order.id} • Delivered</p>
                        <button type="button" onclick="selectReviewItem('${order.id}', '${item.productId}')"
                            class="mt-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg">
                            Review this product
                        </button>
                    </div>
                `).join("")
                : `<p class="text-xs text-slate-400">Delivered products eligible for review will appear here.</p>`;

            const completedList = document.getElementById("customerCompletedOrdersList");
            if (completedList) {
                const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, character => ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                })[character]);
                const completedOrders = myOrders
                    .filter(order => order.orderStatus === "Delivered")
                    .slice()
                    .sort((a, b) => new Date(b.deliveryConfirmedAt || 0) - new Date(a.deliveryConfirmedAt || 0));
                completedList.innerHTML = completedOrders.length
                    ? completedOrders.map(order => {
                        const confirmedAt = order.deliveryConfirmedAt
                            ? new Date(order.deliveryConfirmedAt).toLocaleString()
                            : "Confirmation time unavailable";
                        const pickupAt = formatOrderDateTime(order.pickupAt);
                        const estimatedDeliveryAt = formatOrderDateTime(order.estimatedDeliveryAt);
                        const items = (order.items || []).map(item =>
                            `<li>${escapeHTML(item.name)} × ${formatQuantity(Number(item.quantity) || 0)} ${getStockUnitLabel(item.stockUnit)}</li>`
                        ).join("");
                        const photos = (Array.isArray(order.deliveryProof) ? order.deliveryProof : [])
                            .filter(photo => /^data:image\/(?:jpeg|png|webp);base64,/.test(photo.imageData || ""))
                            .map((photo, index) => `
                                <a href="${photo.imageData}" target="_blank" rel="noopener noreferrer"
                                    aria-label="Open delivery photo ${index + 1} for order ${escapeHTML(order.id)}">
                                    <img src="${photo.imageData}" alt="Delivery proof ${index + 1}"
                                        class="h-24 w-24 rounded-lg border border-slate-200 object-cover">
                                </a>
                            `).join("");
                        return `
                            <details class="rounded-xl border border-emerald-200 bg-white p-4">
                                <summary class="cursor-pointer list-none">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <p class="font-extrabold text-emerald-700">Order ${escapeHTML(order.id)}</p>
                                            <p class="mt-1 text-xs text-slate-500">Delivered ${escapeHTML(confirmedAt)}</p>
                                        </div>
                                        <span class="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Delivered · View details</span>
                                    </div>
                                </summary>
                                <div class="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
                                    <p><span class="font-semibold">Address:</span> ${escapeHTML(order.address)}</p>
                                    ${pickupAt ? `<p><span class="font-semibold">Rider pickup:</span> ${escapeHTML(pickupAt)}</p>` : ""}
                                    ${estimatedDeliveryAt ? `<p><span class="font-semibold">Estimated delivery:</span> ${escapeHTML(estimatedDeliveryAt)}</p>` : ""}
                                    <p><span class="font-semibold">Payment:</span> ${escapeHTML(order.paymentMethod)}</p>
                                    <p><span class="font-semibold">Total:</span> ₱${(Number(order.totalAmount) || 0).toFixed(2)}</p>
                                    ${items ? `<div><p class="font-semibold">Items:</p><ul class="mt-1 list-inside list-disc text-slate-600">${items}</ul></div>` : ""}
                                    ${photos ? `<div><p class="font-semibold">Delivery photos (click to open):</p><div class="mt-2 flex flex-wrap gap-2">${photos}</div></div>` : `<p class="text-xs text-slate-500">No delivery photos are available for this order.</p>`}
                                </div>
                            </details>
                        `;
                    }).join("")
                    : `<p class="text-xs text-slate-400">You don't have any completed orders yet.</p>`;
            }
        }

        function selectReviewItem(orderId, productId) {
            sessionStorage.setItem("atudtaProductReturnUrl", window.location.href);
            window.location.assign(`reviews.html?product=${encodeURIComponent(productId)}&order=${encodeURIComponent(orderId)}`);
        }

        function returnFromProductDetails() {
            const returnUrl = sessionStorage.getItem("atudtaProductReturnUrl");
            sessionStorage.removeItem("atudtaProductReturnUrl");
            if (returnUrl) {
                try {
                    const destination = new URL(returnUrl, window.location.origin);
                    if (destination.origin === window.location.origin) {
                        window.location.assign(destination.href);
                        return;
                    }
                } catch (error) {
                    console.error("Could not return to the previous product page.", error);
                }
            }

            if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
                window.history.back();
                return;
            }
            window.location.assign("products.html");
        }

        function openProductDetails(productId, preferredOrderId = "") {
            const product = products.find(item => item.id === productId);
            if (!product) {
                showToast("Product not found.", "error");
                return;
            }
            selectedProductId = productId;
            const imageContainer = document.getElementById("detailProductImage");
            imageContainer.replaceChildren();
            if (product.imageData) {
                const image = document.createElement("img");
                image.src = product.imageData;
                image.alt = product.name;
                image.className = "block h-auto w-full object-contain";
                imageContainer.appendChild(image);
            } else {
                imageContainer.textContent = product.category === "Fruits"
                    ? "🍎"
                    : product.img === "fish" ? "🐟"
                    : product.img === "pork" ? "🥩"
                    : product.img === "tomato" ? "🍅" : "🧄";
            }

            const vendor = users.find(user => user.id === product.vendorId);
            document.getElementById("detailProductCategory").textContent = product.category || "";
            document.getElementById("detailProductName").textContent = product.name;
            document.getElementById("detailProductStore").textContent =
                `Store: ${product.vendorName || vendor?.stallName || "AtudTA Market Vendor"}`;
            document.getElementById("detailProductPrice").textContent =
                `₱${product.price.toFixed(2)} / ${getStockUnitLabel(product.stockUnit)}`;
            const stock = getProductStock(product);
            document.getElementById("detailProductStock").textContent = stock === null
                ? "Stock quantity not set"
                : `${product.inStock && stock > 0 ? "Available" : "Out of stock"}: ${formatQuantity(stock)} ${getStockUnitLabel(product.stockUnit)}`;
            document.getElementById("productDetailsModal").classList.remove("hidden");
            renderProductReviews(preferredOrderId);
        }

        function closeProductDetails() {
            if (document.body.dataset.appPage === "reviews") {
                returnFromProductDetails();
                return;
            }
            document.getElementById("productDetailsModal").classList.add("hidden");
            selectedProductId = null;
        }

        // REVIEWS
        document.getElementById("addReviewForm")?.addEventListener("submit", async function(e) {
            e.preventDefault();
            if (!currentUser || currentUser.role !== "Customer") {
                showToast("Log in as a customer to submit a review.", "error");
                return;
            }

            const orderId = document.getElementById("reviewOrder").value;
            const productId = selectedProductId;
            const order = getCustomerOrders().find(customerOrder =>
                customerOrder.id === orderId && customerOrder.orderStatus === "Delivered"
            );
            const purchasedItem = order?.items.find(item => item.productId === productId);
            if (!order || !purchasedItem) {
                showToast("You can only review products from your delivered orders.", "error");
                renderReviews();
                return;
            }
            if (hasReviewedOrderItem(orderId, productId)) {
                showToast("You have already reviewed this product from that order.", "error");
                renderReviews();
                return;
            }

            const comments = document.getElementById("reviewComment").value.trim();
            if (!comments) {
                showToast("Write a comment before submitting your review.", "error");
                return;
            }
            const submissionError = document.getElementById("reviewSubmissionError");
            submissionError.textContent = "";
            submissionError.classList.add("hidden");
            const submitButton = document.getElementById("submitReviewButton");
            submitButton.disabled = true;
            try {
                const result = await apiRequest("/api/reviews/submit", {
                    method: "POST",
                    body: JSON.stringify({
                        orderID: order.databaseId,
                        productID: productId,
                        comments
                    })
                });
                if (!result.review?.id) {
                    throw new Error("The server did not confirm that your review was saved.");
                }
                reviews.unshift(result.review);
                this.reset();
            } catch (error) {
                console.error("Could not save product review to MongoDB.", error);
                submissionError.textContent = error.message || "Could not save your review. Please try again.";
                submissionError.classList.remove("hidden");
                showToast(error.message || "Could not save your review.", "error");
                renderReviews();
                return;
            }
            openProductDetails(productId);
            renderReviews();
            showToast("Thank you! Your review was saved to MongoDB.");
        });

        document.getElementById("reviewOrder")?.addEventListener("change", renderReviewOptions);

        function renderProductReviews(preferredOrderId = "") {
            const product = products.find(item => item.id === selectedProductId);
            if (!product) {
                return;
            }

            const productReviews = reviews.filter(review => review.productId === product.id);
            const reviewList = document.getElementById("detailProductReviews");
            reviewList.replaceChildren();
            if (productReviews.length === 0) {
                const emptyMessage = document.createElement("p");
                emptyMessage.className = "text-sm text-slate-400";
                emptyMessage.textContent = "No reviews for this product yet.";
                reviewList.appendChild(emptyMessage);
            } else {
                productReviews.forEach(review => {
                    const card = document.createElement("article");
                    card.className = "p-3 bg-slate-50 rounded-xl";
                    const heading = document.createElement("div");
                    heading.className = "flex justify-between gap-3 text-sm";
                    const author = document.createElement("strong");
                    author.className = "text-slate-700";
                    author.textContent = review.author || "Customer";
                    heading.append(author);
                    if (currentUser?.role === "Customer" && String(review.userId) === String(currentUser.id)) {
                        const deleteButton = document.createElement("button");
                        deleteButton.type = "button";
                        deleteButton.className = "text-xs font-semibold text-rose-600 hover:text-rose-800";
                        deleteButton.textContent = "Delete";
                        deleteButton.addEventListener("click", () => deleteReview(review));
                        heading.appendChild(deleteButton);
                    }
                    const comment = document.createElement("p");
                    comment.className = "mt-2 text-sm text-black whitespace-pre-wrap";
                    comment.textContent = review.comment || "";
                    const date = document.createElement("p");
                    date.className = "mt-1 text-xs text-slate-400";
                    date.textContent = review.date || "";
                    card.append(heading, comment, date);
                    reviewList.appendChild(card);
                });
            }

            const reviewForm = document.getElementById("addReviewForm");
            const orderSelect = document.getElementById("reviewOrder");
            const eligibleOrders = getCustomerOrders().filter(order =>
                order.orderStatus === "Delivered" &&
                order.items.some(item =>
                    item.productId === product.id &&
                    !hasReviewedOrderItem(order.id, product.id)
                )
            );
            reviewForm.classList.toggle("hidden", eligibleOrders.length === 0);

            orderSelect.replaceChildren();
            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = eligibleOrders.length
                ? "Choose your delivered order..."
                : "No eligible delivered order";
            orderSelect.appendChild(placeholder);
            eligibleOrders.forEach(order => {
                const option = document.createElement("option");
                option.value = order.id;
                option.textContent = `Order ${order.id}`;
                orderSelect.appendChild(option);
            });
            orderSelect.value = eligibleOrders.some(order => order.id === preferredOrderId)
                ? preferredOrderId
                : eligibleOrders[0]?.id || "";
            document.getElementById("submitReviewButton").disabled = eligibleOrders.length === 0;
            document.getElementById("reviewEligibilityMessage").textContent = eligibleOrders.length
                ? "Reviews are available only for this product in your delivered order."
                : "";
        }

        async function deleteReview(review) {
            if (!window.confirm("Delete your review? It will be removed from view but kept in the database.")) {
                return;
            }

            try {
                await apiRequest(`/api/reviews/${encodeURIComponent(review.id)}`, { method: "DELETE" });
                reviews = reviews.filter(item => item.id !== review.id);
                renderReviews();
                showToast("Review deleted. Its record remains in the database.");
            } catch (error) {
                console.error("Could not delete review.", error);
                showToast(error.message || "Could not delete your review.", "error");
            }
        }

        function renderReviewOptions() {
            const orderSelect = document.getElementById("reviewOrder");
            const selectedOrderId = orderSelect.value;
            const productId = selectedProductId;
            const eligibleOrders = getCustomerOrders().filter(order =>
                order.orderStatus === "Delivered" &&
                order.items.some(item =>
                    item.productId === productId &&
                    !hasReviewedOrderItem(order.id, productId)
                )
            );

            const validSelectedOrder = eligibleOrders.some(order => order.id === selectedOrderId);
            document.getElementById("submitReviewButton").disabled = !validSelectedOrder;
        }

        function renderReviews() {
            renderCustomerOrderLists();
            renderMyReviewsPanel();
            if (selectedProductId && document.getElementById("detailProductReviews")) {
                renderProductReviews(document.getElementById("reviewOrder")?.value || "");
            }
        }

        function renderMyReviewsPanel() {
            const reviewList = document.getElementById("customerMyReviewsList");
            if (!reviewList || !currentUser) {
                return;
            }

            reviewList.replaceChildren();
            const myReviews = reviews.filter(review => String(review.userId) === String(currentUser.id));
            if (myReviews.length === 0) {
                const emptyMessage = document.createElement("p");
                emptyMessage.className = "text-sm text-slate-500";
                emptyMessage.textContent = "You haven't reviewed any products yet.";
                reviewList.appendChild(emptyMessage);
                return;
            }

            myReviews.forEach(review => {
                const card = document.createElement("article");
                card.className = "rounded-xl border border-slate-200 bg-white p-3";
                const heading = document.createElement("div");
                heading.className = "flex items-start justify-between gap-3";
                const productName = document.createElement("strong");
                productName.className = "text-sm text-slate-800";
                productName.textContent = review.target || "Product";
                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "shrink-0 text-xs font-semibold text-rose-600 hover:text-rose-800";
                deleteButton.textContent = "Delete review";
                deleteButton.addEventListener("click", () => deleteReview(review));
                heading.append(productName, deleteButton);

                const comment = document.createElement("p");
                comment.className = "mt-2 text-sm text-black whitespace-pre-wrap";
                comment.textContent = review.comment || "";
                const date = document.createElement("p");
                date.className = "mt-1 text-xs text-slate-400";
                date.textContent = review.date || "";
                card.append(heading, comment, date);
                reviewList.appendChild(card);
            });
        }

        // ==========================================
        // VENDOR DASHBOARD (OmniVendor)
        // ==========================================
        function toggleProductModal(open) {
            document.getElementById("productModal").classList.toggle("hidden", !open);
        }

        async function handleSaveProduct(e) {
            e.preventDefault();
            if (!currentUser || currentUser.role !== "Vendor") {
                showToast("Only signed-in vendors can post products.", "error");
                return;
            }

            const name = document.getElementById("prodName").value.trim();
            const price = parseFloat(document.getElementById("prodPrice").value);
            const category = document.getElementById("prodCategory").value;
            const stock = Number(document.getElementById("prodStock").value);
            const stockUnit = document.getElementById("prodStockUnit").value;
            const imageFile = document.getElementById("prodImageFile").files[0];
            let imageData = "";

            if (!Number.isFinite(price) || price < 0 ||
                !Number.isFinite(stock) || stock < 0 ||
                (stockUnit === "piece" && !Number.isInteger(stock)) ||
                Math.abs(stock * 100 - Math.round(stock * 100)) > 1e-8) {
                showToast("Enter a valid price and stock quantity. Piece stock must be a whole number; kilo stock allows up to 2 decimals.", "error");
                return;
            }

            if (imageFile) {
                const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
                if (!allowedImageTypes.includes(imageFile.type)) {
                    showToast("Choose a JPG, PNG, WEBP, or GIF product picture.", "error");
                    return;
                }
                if (imageFile.size > 1024 * 1024) {
                    showToast("Product pictures must be 1 MB or smaller.", "error");
                    return;
                }

                try {
                    imageData = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.addEventListener("load", () => {
                            if (typeof reader.result === "string") {
                                resolve(reader.result);
                            } else {
                                reject(new Error("Image file did not produce a readable result."));
                            }
                        });
                        reader.addEventListener("error", () => reject(new Error("Could not read the selected image.")));
                        reader.readAsDataURL(imageFile);
                    });
                } catch (error) {
                    console.error("Could not read product picture.", error);
                    showToast("Could not read the selected product picture.", "error");
                    return;
                }
            }

            try {
                const result = await apiRequest("/api/products", {
                    method: "POST",
                    body: JSON.stringify({
                        productName: name,
                        price,
                        category,
                        stock,
                        stockUnit,
                        imageData
                    })
                });
                if (!result.product?.id) {
                    throw new Error("The server did not return the saved product.");
                }
                products.unshift(result.product);
                saveData();
            } catch (error) {
                console.error("Could not save product.", error);
                showToast(error.message || "Could not save the product.", "error");
                return;
            }
            toggleProductModal(false);
            e.target.reset();
            showToast("Product added");
            renderAll();
        }

        async function toggleStock(prodId) {
            const product = products.find(item => item.id === prodId);
            if (!product || !isProductInCurrentVendorBusiness(product)) {
                showToast("You can only change stock for products in your business.", "error");
                return;
            }
            const nextAvailability = !product.inStock;
            if (!window.confirm(
                `Are you sure you want to mark "${product.name}" as ${nextAvailability ? "available" : "unavailable"}?`
            )) {
                return;
            }
            try {
                const result = await apiRequest(`/api/products/${encodeURIComponent(prodId)}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        productName: product.name,
                        price: product.price,
                        category: product.category,
                        stock: getProductStock(product) ?? 0,
                        stockUnit: product.stockUnit || "piece",
                        imageData: product.imageData || "",
                        inStock: nextAvailability
                    })
                });
                products = products.map(item => item.id === prodId ? result.product : item);
                saveData();
                renderAll();
            } catch (error) {
                console.error("Could not update product availability.", error);
                showToast(error.message || "Could not update product availability.", "error");
            }
        }

        async function updateProductStock(prodId) {
            const product = products.find(item => item.id === prodId);
            if (!product || !isProductInCurrentVendorBusiness(product)) {
                showToast("You can only change stock for products in your business.", "error");
                return;
            }

            const input = window.prompt(
                `Set available stock in ${getStockUnitLabel(product.stockUnit)}:`,
                String(getProductStock(product) ?? 0)
            );
            if (input === null) {
                return;
            }
            const stock = Number(input);
            if (!Number.isFinite(stock) || stock < 0 ||
                Math.abs(stock * 100 - Math.round(stock * 100)) > 1e-8 ||
                (product.stockUnit !== "kg" && !Number.isInteger(stock))) {
                showToast("Enter a non-negative stock amount with up to 2 decimals. Piece stock must be a whole number.", "error");
                return;
            }
            if (!window.confirm(
                `Are you sure you want to set "${product.name}" stock to ${formatQuantity(stock)} ${getStockUnitLabel(product.stockUnit)}?`
            )) {
                return;
            }

            try {
                const result = await apiRequest(`/api/products/${encodeURIComponent(prodId)}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        productName: product.name,
                        price: product.price,
                        category: product.category,
                        stock,
                        stockUnit: product.stockUnit || "piece",
                        imageData: product.imageData || "",
                        inStock: stock > 0
                    })
                });
                products = products.map(item => item.id === prodId ? result.product : item);
                saveData();
                renderAll();
            } catch (error) {
                console.error("Could not update product stock.", error);
                showToast(error.message || "Could not update product stock.", "error");
            }
        }

        async function deleteProduct(prodId) {
            const product = products.find(item => item.id === prodId);
            if (!product || !isProductInCurrentVendorBusiness(product)) {
                showToast("You can only delete products in your business.", "error");
                return;
            }
            if (!await showConfirmation({
                title: "Delete Product?",
                message: `Are you sure you want to archive "${product.name}"? It will be removed from the product listings but kept in the database.`,
                confirmLabel: "Delete Product",
                danger: true
            })) {
                return;
            }
            try {
                await apiRequest(`/api/products/${encodeURIComponent(prodId)}`, { method: "DELETE" });
                products = products.filter(item => item.id !== prodId);
                saveData();
                renderAll();
                showToast("Product deleted");
            } catch (error) {
                console.error("Could not delete product.", error);
                showToast(error.message || "Could not delete product.", "error");
            }
        }

        function handleVendorProductAction(select, prodId) {
            const action = select.value;
            select.value = "";

            if (action === "stock") {
                updateProductStock(prodId);
            } else if (action === "availability") {
                toggleStock(prodId);
            } else if (action === "delete") {
                deleteProduct(prodId);
            }
        }

        function updateVendorProductPhoto(prodId) {
            const product = products.find(item => item.id === prodId);
            if (!product || !isProductInCurrentVendorBusiness(product)) {
                showToast("You can only update photos for products in your business.", "error");
                return;
            }

            const input = document.getElementById("vendorProductImageInput");
            input.dataset.productId = prodId;
            input.value = "";
            input.click();
        }

        async function handleVendorProductPhotoUpdate(event) {
            const input = event.currentTarget;
            const imageFile = input.files[0];
            const prodId = input.dataset.productId;
            input.value = "";
            delete input.dataset.productId;
            if (!imageFile) {
                return;
            }

            const product = products.find(item => item.id === prodId);
            if (!product || !isProductInCurrentVendorBusiness(product)) {
                showToast("You can only update photos for products in your business.", "error");
                return;
            }

            const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
            if (!allowedImageTypes.includes(imageFile.type)) {
                showToast("Choose a JPG, PNG, WEBP, or GIF product picture.", "error");
                return;
            }
            if (imageFile.size > 1024 * 1024) {
                showToast("Product pictures must be 1 MB or smaller.", "error");
                return;
            }
            if (!window.confirm(`Are you sure you want to update the photo for "${product.name}"?`)) {
                return;
            }

            try {
                const imageData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.addEventListener("load", () => {
                        if (typeof reader.result === "string") {
                            resolve(reader.result);
                        } else {
                            reject(new Error("Image file did not produce a readable result."));
                        }
                    });
                    reader.addEventListener("error", () => reject(new Error("Could not read the selected image.")));
                    reader.readAsDataURL(imageFile);
                });
                const result = await apiRequest(`/api/products/${encodeURIComponent(prodId)}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        productName: product.name,
                        price: product.price,
                        category: product.category,
                        stock: getProductStock(product) ?? 0,
                        stockUnit: product.stockUnit || "piece",
                        imageData,
                        inStock: product.inStock
                    })
                });
                if (!result.product?.id) {
                    throw new Error("The server did not confirm the product picture update.");
                }
                products = products.map(item => item.id === prodId ? result.product : item);
                saveData();
                renderAll();
                showToast("Product picture updated.");
            } catch (error) {
                console.error("Could not update product picture.", error);
                showToast(error.message || "Could not update the product picture.", "error");
            }
        }

        function renderVendorDashboard() {
            document.getElementById("vendorDashboardStoreName").textContent =
                currentUser?.role === "Vendor" && currentUser.stallName
                    ? currentUser.stallName
                    : "Store name not set";
            const vendorProducts = currentUser
                ? products.filter(isProductInCurrentVendorBusiness)
                : [];
            const vendorOrders = currentUser
                ? orders.filter(isOrderInCurrentVendorBusiness)
                : [];

            // Metrics
            document.getElementById("vendorMetricTotalProducts").textContent = vendorProducts.length;
            const active = vendorOrders.filter(o => o.orderStatus !== 'Delivered');
            document.getElementById("vendorMetricActiveOrders").textContent = active.length;
            const rev = vendorOrders.reduce((sum, order) =>
                sum + getOrderItemsForCurrentVendorBusiness(order)
                    .reduce((itemTotal, item) => itemTotal + (item.price * item.quantity), 0), 0);
            document.getElementById("vendorMetricRevenue").textContent = `₱${rev.toFixed(2)}`;

            // Inventory Table
            const table = document.getElementById("vendorProductsTable");
            table.innerHTML = vendorProducts.map(p => {
                const stock = getProductStock(p);
                const isAvailable = p.inStock && (stock === null || stock > 0);
                return `
                <tr>
                    <td class="p-2.5 font-semibold text-slate-800">
                        <div class="flex items-center gap-2">
                            <div class="relative h-10 w-10 shrink-0">
                                ${p.imageData
                                    ? `<img src="${p.imageData}" alt="Product photo" class="h-10 w-10 rounded-lg object-cover">`
                                    : `<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><i class="fa-solid fa-image" aria-hidden="true"></i></div>`}
                                <button type="button" onclick="updateVendorProductPhoto('${p.id}')"
                                    aria-label="Update product photo" title="Update product photo"
                                    class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sage-600 text-white shadow hover:bg-sage-700">
                                    <i class="fa-solid fa-pen text-[9px]" aria-hidden="true"></i>
                                </button>
                            </div>
                            <span>${p.name}</span>
                        </div>
                    </td>
                    <td class="p-2.5 font-bold text-spink-600">₱${p.price.toFixed(2)} / ${getStockUnitLabel(p.stockUnit)}</td>
                    <td class="p-2.5">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                            ${stock === null ? 'Stock not set' : `${formatQuantity(stock)} ${getStockUnitLabel(p.stockUnit)} · ${isAvailable ? 'In Stock' : 'Out'}`}
                        </span>
                    </td>
                    <td class="p-2.5 text-right">
                        <select aria-label="Actions for product" onchange="handleVendorProductAction(this, '${p.id}')"
                            class="max-w-40 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sage-500">
                            <option value="" selected>Actions</option>
                            <option value="stock">Add / Set Stock</option>
                            <option value="availability">${isAvailable ? 'Mark Unavailable' : 'Mark Available'}</option>
                            <option value="delete">Delete Product</option>
                        </select>
                    </td>
                </tr>
                `;
            }).join('');

            // Incoming Orders Pipeline
            const pipeline = document.getElementById("vendorOrdersPipeline");
            if (vendorOrders.length === 0) {
                pipeline.innerHTML = `<p class="text-xs text-slate-400">No orders received yet.</p>`;
                return;
            }

            pipeline.innerHTML = vendorOrders.map(o => {
                const businessItems = getOrderItemsForCurrentVendorBusiness(o);
                const businessSubtotal = businessItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
                const vendorHasPacked = (o.packedBy || []).includes(currentUser.id);
                return `
                <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-extrabold text-slate-800">${o.id} • ${o.customerName}</span>
                        <span class="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">${o.orderStatus}</span>
                    </div>
                    <p class="text-xs text-slate-500">Address: ${o.address}</p>
                    <div class="text-xs text-slate-600">
                        ${businessItems.map(i => `${i.name} (${formatQuantity(i.quantity)} ${getStockUnitLabel(i.stockUnit)})`).join(', ')}
                    </div>
                    <div class="flex justify-between items-center pt-2">
                        <span class="font-bold text-spink-600 text-sm">Business items: ₱${businessSubtotal.toFixed(2)}</span>
                        ${o.orderStatus === 'Pending' && !vendorHasPacked ? `
                            <button onclick="updateOrderStatus('${o.id}', 'Packed')" class="px-3 py-1 bg-sage-600 text-white text-xs font-bold rounded-lg hover:bg-sage-700">
                                Pack Order
                            </button>
                        ` : o.orderStatus === 'Pending' ? `
                            <span class="text-xs text-amber-700 font-bold">Your items are packed; waiting for other vendors.</span>
                        ` : `<span class="text-xs text-emerald-600 font-bold"><i class="fa-solid fa-check"></i> Ready for Rider Pickup</span>`}
                    </div>
                </div>
            `;
            }).join('');
        }

        async function updateOrderStatus(orderId, status) {
            const order = orders.find(item => item.id === orderId);
            if (currentUser?.role === "Vendor" && (!order || !isOrderInCurrentVendorBusiness(order))) {
                showToast("You can only update orders containing products from your business.", "error");
                return;
            }
            if (!order?.databaseId) {
                showToast("This order is not connected to the database. Refresh the page and try again.", "error");
                return;
            }
            try {
                const result = await apiRequest(`/api/orders/${encodeURIComponent(order.databaseId)}/status`, {
                    method: "PUT",
                    body: JSON.stringify({ status })
                });
                if (!result.order?.databaseId) {
                    throw new Error("The server did not confirm the order update.");
                }
                orders = orders.map(item => item.id === orderId ? result.order : item);
                const waitingForOtherVendors =
                    status === "Packed" && result.order.orderStatus === "Pending";
                showToast(waitingForOtherVendors
                    ? `Your items in ${orderId} are packed; waiting for other vendors.`
                    : `Order ${orderId} status changed to ${result.order.orderStatus}.`);
                renderAll();
            } catch (error) {
                console.error("Could not update order status in MongoDB.", error);
                showToast(error.message || "Could not update the order status.", "error");
            }
        }

        // ==========================================
        // RIDER DASHBOARD (SwiftCourier)
        // ==========================================
        function updateRiderLocation() {
            const status = document.getElementById("riderLocationStatus");
            const button = document.getElementById("riderLocationButton");
            const mapLink = document.getElementById("riderLocationMapLink");
            if (!currentUser || currentUser.role !== "Rider") {
                showToast("Log in as a rider to view your location.", "error");
                return;
            }
            if (!navigator.geolocation) {
                status.textContent = "Location is not supported by this browser.";
                showToast("Your browser does not support location access.", "error");
                return;
            }
            if (riderLocationRequestPending) {
                return;
            }

            const requestingRiderId = currentUser.id;
            riderLocationRequestPending = true;
            button.disabled = true;
            button.classList.add("opacity-60", "cursor-not-allowed");
            status.textContent = "Getting your current location...";
            mapLink.classList.add("hidden");
            navigator.geolocation.getCurrentPosition(
                position => {
                    riderCurrentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        capturedAt: new Date()
                    };
                    if (currentUser?.id !== requestingRiderId || currentUser.role !== "Rider") {
                        riderCurrentLocation = null;
                        riderLocationRequestPending = false;
                        button.disabled = false;
                        button.classList.remove("opacity-60", "cursor-not-allowed");
                        return;
                    }
                    status.textContent = `Location: ${riderCurrentLocation.latitude.toFixed(5)}, ${riderCurrentLocation.longitude.toFixed(5)} • Updated ${riderCurrentLocation.capturedAt.toLocaleTimeString()}`;
                    mapLink.href = `https://www.google.com/maps?q=${riderCurrentLocation.latitude},${riderCurrentLocation.longitude}`;
                    mapLink.classList.remove("hidden");
                    riderLocationRequestPending = false;
                    button.disabled = false;
                    button.classList.remove("opacity-60", "cursor-not-allowed");
                    renderRiderDashboard();
                },
                error => {
                    riderLocationRequestPending = false;
                    button.disabled = false;
                    button.classList.remove("opacity-60", "cursor-not-allowed");
                    if (currentUser?.id !== requestingRiderId || currentUser.role !== "Rider") {
                        return;
                    }
                    status.textContent = error.code === 1
                        ? "Location permission was denied. Allow location access in your browser settings, then try again."
                        : error.code === 2
                            ? "Your current location is unavailable. Check your device location settings and try again."
                            : "Location request timed out. Please try again.";
                    showToast(status.textContent, "error");
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            );
        }

        function isAssignedToCurrentRider(order) {
            return Boolean(currentUser && (
                order.courierId === currentUser.id ||
                (!order.courierId && order.courierName === currentUser.name)
            ));
        }

        async function acceptRiderDelivery(orderId) {
            if (!currentUser || currentUser.role !== "Rider" || !isRiderDuty) {
                showToast("Go online as a rider before accepting a delivery.", "error");
                return;
            }
            if (!riderCurrentLocation) {
                showToast("Get your current location before accepting a delivery.", "error");
                return;
            }

            const order = orders.find(item => item.id === orderId);
            if (!order?.databaseId || order.orderStatus !== "Packed" ||
                order.courierName !== "Unassigned" || order.courierId ||
                (order.declinedBy || []).includes(currentUser.id)) {
                showToast("This delivery is no longer available to accept.", "error");
                renderAll();
                return;
            }

            try {
                const result = await apiRequest(`/api/orders/${encodeURIComponent(order.databaseId)}/accept`, {
                    method: "PUT"
                });
                if (!result.order?.databaseId) {
                    throw new Error("The server did not confirm the delivery assignment.");
                }
                orders = orders.map(item => item.id === orderId ? result.order : item);
                showToast(`Delivery ${orderId} accepted.`);
                renderAll();
            } catch (error) {
                console.error("Could not accept delivery in MongoDB.", error);
                showToast(error.message || "Could not accept this delivery.", "error");
            }
        }

        async function declineRiderDelivery(orderId) {
            if (!currentUser || currentUser.role !== "Rider" || !isRiderDuty) {
                showToast("Go online as a rider before responding to delivery offers.", "error");
                return;
            }
            const order = orders.find(item => item.id === orderId);
            if (!order?.databaseId || order.orderStatus !== "Packed" ||
                order.courierName !== "Unassigned" || order.courierId) {
                showToast("This delivery is no longer available to decline.", "error");
                renderAll();
                return;
            }

            try {
                await apiRequest(`/api/orders/${encodeURIComponent(order.databaseId)}/decline`, {
                    method: "PUT"
                });
                orders = orders.filter(item => item.id !== orderId);
                showToast(`Delivery ${orderId} declined.`);
                renderAll();
            } catch (error) {
                console.error("Could not decline delivery in MongoDB.", error);
                showToast(error.message || "Could not decline this delivery.", "error");
            }
        }

        function updateRiderDeliveryStatus(orderId, status) {
            const order = orders.find(item => item.id === orderId);
            const validTransition = (status === "Out for Delivery" && order?.orderStatus === "Packed") ||
                (status === "Delivered" && order?.orderStatus === "Out for Delivery");
            if (!currentUser || currentUser.role !== "Rider" || !order ||
                !isAssignedToCurrentRider(order) || !validTransition) {
                showToast("This delivery cannot be updated by your rider account.", "error");
                renderAll();
                return;
            }
            updateOrderStatus(orderId, status);
        }

        function toggleRiderDuty() {
            isRiderDuty = !isRiderDuty;
            const btn = document.getElementById("riderDutyToggleBtn");
            if (!btn) {
                return;
            }
            if (isRiderDuty) {
                btn.className = "px-4 py-2 rounded-xl text-sm font-bold bg-emerald-500 text-white shadow";
                btn.textContent = "🟢 Online & Available";
            } else {
                btn.className = "px-4 py-2 rounded-xl text-sm font-bold bg-slate-400 text-white shadow";
                btn.textContent = "⚪ Offline";
            }
            renderRiderDashboard();
        }

        function renderRiderDashboard() {
            const assigned = orders.filter(o =>
                isAssignedToCurrentRider(o) && (o.orderStatus === 'Packed' || o.orderStatus === 'Out for Delivery')
            );
            const available = isRiderDuty && currentUser?.role === "Rider"
                ? orders.filter(o =>
                    o.orderStatus === "Packed" &&
                    o.courierName === "Unassigned" &&
                    !(o.declinedBy || []).includes(currentUser.id)
                )
                : [];
            const completed = orders.filter(o => o.orderStatus === "Delivered");
            const codTotal = completed.reduce((sum, o) => sum + (o.paymentMethod === 'Cash on Delivery' ? o.totalAmount : 0), 0);

            document.getElementById("riderMetricAssigned").textContent = assigned.length + available.length;
            document.getElementById("riderMetricCompleted").textContent = completed.length;
            document.getElementById("riderMetricCOD").textContent = `₱${codTotal.toFixed(2)}`;

            const queue = document.getElementById("riderDeliveriesQueue");
            if (queue && assigned.length === 0 && available.length === 0) {
                queue.innerHTML = `<p class="col-span-full text-center text-slate-400 py-6">No delivery jobs currently in queue.</p>`;
            } else if (queue) {
                queue.innerHTML = [
                ...available.map(o => `
                <div class="glass-card p-4 rounded-2xl border border-emerald-200 space-y-3">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-extrabold text-emerald-700">${o.id}</span>
                        <span class="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">Available</span>
                    </div>
                    <div>
                        <p class="font-bold text-sm text-slate-800">${o.customerName}</p>
                        <p class="text-xs text-slate-500"><i class="fa-solid fa-location-dot text-rose-500"></i> ${o.address}</p>
                    </div>
                    <div class="flex flex-wrap justify-between items-center gap-2 text-xs pt-2 border-t border-slate-100">
                        <span class="font-extrabold text-slate-700">Collect COD: ₱${o.totalAmount.toFixed(2)}</span>
                        <div class="flex gap-2">
                            <button onclick="declineRiderDelivery('${o.id}')" class="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition">
                                Decline
                            </button>
                            <button onclick="acceptRiderDelivery('${o.id}')" ${riderCurrentLocation ? "" : "disabled"}
                                class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition">
                                Accept Delivery
                            </button>
                        </div>
                    </div>
                    ${riderCurrentLocation ? "" : `<p class="text-xs text-amber-700">Get your current location before accepting.</p>`}
                </div>
            `),
                ...assigned.map(o => `
                <div class="glass-card p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-extrabold text-blue-600">${o.id}</span>
                        <span class="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">${o.orderStatus}</span>
                    </div>
                    <div>
                        <p class="font-bold text-sm text-slate-800">${o.customerName}</p>
                        <p class="text-xs text-slate-500"><i class="fa-solid fa-location-dot text-rose-500"></i> ${o.address}</p>
                        ${o.pickupAt ? `<p class="text-xs text-slate-600 mt-1">Pickup: ${formatOrderDateTime(o.pickupAt)}</p>` : ""}
                        ${o.estimatedDeliveryAt ? `<p class="text-xs font-semibold text-emerald-700 mt-1">Estimated arrival: ${formatOrderDateTime(o.estimatedDeliveryAt)}</p>` : ""}
                    </div>
                    <div class="flex justify-between items-center text-xs pt-2 border-t border-slate-100">
                        <span class="font-extrabold text-slate-700">Collect COD: ₱${o.totalAmount.toFixed(2)}</span>
                        ${o.orderStatus === 'Packed' ? `
                            <button onclick="updateRiderDeliveryStatus('${o.id}', 'Out for Delivery')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition">
                                Start Delivery
                            </button>
                        ` : `
                            <button onclick="updateRiderDeliveryStatus('${o.id}', 'Delivered')"
                                class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition">
                                Mark Delivered
                            </button>
                        `}
                    </div>
                </div>
            `)
                ].join("");
            }

            const completedList = document.getElementById("riderCompletedDeliveries");
            if (!completedList) {
                return;
            }
            if (completed.length === 0) {
                completedList.innerHTML = `<p class="col-span-full text-center text-slate-400 py-6">No completed deliveries yet.</p>`;
                return;
            }

            const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[character]);
            completedList.innerHTML = completed
                .slice()
                .sort((a, b) => new Date(b.deliveryConfirmedAt || 0) - new Date(a.deliveryConfirmedAt || 0))
                .map(order => {
                    const confirmedAt = order.deliveryConfirmedAt
                        ? new Date(order.deliveryConfirmedAt).toLocaleString()
                        : "Confirmation time unavailable";
                    const items = (order.items || []).map(item =>
                        `<li>${escapeHTML(item.name)} × ${formatQuantity(Number(item.quantity) || 0)} ${getStockUnitLabel(item.stockUnit)}</li>`
                    ).join("");
                    const photos = (Array.isArray(order.deliveryProof) ? order.deliveryProof : [])
                        .filter(photo => /^data:image\/(?:jpeg|png|webp);base64,/.test(photo.imageData || ""))
                        .map((photo, index) => `
                            <a href="${photo.imageData}" target="_blank" rel="noopener noreferrer"
                                aria-label="Open delivery photo ${index + 1} for order ${escapeHTML(order.id)}">
                                <img src="${photo.imageData}" alt="Delivery proof ${index + 1}"
                                    class="h-24 w-24 rounded-lg border border-slate-200 object-cover">
                            </a>
                        `).join("");
                    return `
                        <details class="glass-card rounded-2xl border border-emerald-200 p-4">
                            <summary class="cursor-pointer list-none">
                                <div class="flex items-start justify-between gap-3">
                                    <div>
                                        <p class="font-extrabold text-emerald-700">Order ${escapeHTML(order.id)}</p>
                                        <p class="mt-1 text-sm text-slate-700">${escapeHTML(order.customerName)}</p>
                                        <p class="mt-1 text-xs text-slate-500">Delivered ${escapeHTML(confirmedAt)}</p>
                                    </div>
                                    <span class="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Delivered · View details</span>
                                </div>
                            </summary>
                            <div class="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
                                <p><span class="font-semibold">Address:</span> ${escapeHTML(order.address)}</p>
                                <p><span class="font-semibold">Payment:</span> ${escapeHTML(order.paymentMethod)}</p>
                                <p><span class="font-semibold">Total:</span> ₱${(Number(order.totalAmount) || 0).toFixed(2)}</p>
                                ${items ? `<div><p class="font-semibold">Items:</p><ul class="mt-1 list-inside list-disc text-slate-600">${items}</ul></div>` : ""}
                                ${photos ? `<div><p class="font-semibold">Delivery photos (click to open):</p><div class="mt-2 flex flex-wrap gap-2">${photos}</div></div>` : `<p class="text-xs text-slate-500">No delivery photos are available for this order.</p>`}
                            </div>
                        </details>
                    `;
                }).join("");
        }

        function renderAdminUsersTable(accounts) {
            const tableBody = document.getElementById("adminUsersTableBody");
            if (!tableBody) {
                return;
            }

            if (!accounts.length) {
                const row = document.createElement("tr");
                const cell = document.createElement("td");
                cell.colSpan = 5;
                cell.className = "px-4 py-8 text-center text-slate-500";
                cell.textContent = "No accounts found.";
                row.appendChild(cell);
                tableBody.replaceChildren(row);
                return;
            }

            const rows = accounts.map(account => {
                const row = document.createElement("tr");
                const creator = account.createdBy;
                const creatorId = creator && typeof creator === "object"
                    ? creator.id || creator._id
                    : creator;
                const creatorName = creator && typeof creator === "object"
                    ? creator.name || creator.email
                    : null;
                const creatorLabel = creatorId
                    ? String(creatorId) === String(currentUser?.id)
                        ? "You"
                        : creatorName || "Admin"
                    : account.role === "Admin"
                        ? "Super Admin"
                        : "—";
                const values = [
                    account.name || "—",
                    account.email || "—",
                    account.role || "—",
                    account.deletedAt ? "Suspended" : "Active",
                    creatorLabel
                ];
                values.forEach((value, index) => {
                    const cell = document.createElement("td");
                    cell.className = index === 4
                        ? "px-4 py-3 text-right text-slate-400"
                        : "px-4 py-3 text-slate-700";
                    cell.textContent = value;
                    row.appendChild(cell);
                });
                return row;
            });
            tableBody.replaceChildren(...rows);
        }

        async function renderAdminDashboard() {
            const createAdminForm = document.getElementById("createAdminForm");
            const isSuperAdmin = currentUser?.role === "Admin" &&
                currentUser.adminLevel === "super_admin";
            if (createAdminForm) {
                if (isSuperAdmin) {
                    ensureSettingsInterface();
                    createAdminForm.classList.remove("hidden");
                } else {
                    createAdminForm.classList.add("hidden");
                }
            }

            try {
                const [dashboard, accounts] = await Promise.all([
                    apiRequest("/api/admin/dashboard"),
                    apiRequest("/api/admin/users")
                ]);
                const values = {
                    adminActiveUsers: dashboard.users?.active,
                    adminSuspendedUsers: dashboard.users?.suspended,
                    adminCustomers: dashboard.users?.customers,
                    adminVendors: dashboard.users?.vendors,
                    adminRiders: dashboard.users?.riders,
                    adminProducts: dashboard.products,
                    adminOrders: dashboard.orders,
                    adminDeliveries: dashboard.deliveries
                };
                Object.entries(values).forEach(([id, value]) => {
                    const element = document.getElementById(id);
                    if (element && Number.isFinite(Number(value))) {
                        element.textContent = String(value);
                    }
                });
                if (!Array.isArray(accounts)) {
                    throw new Error("The server returned an invalid account list.");
                }
                renderAdminUsersTable(accounts);
            } catch (error) {
                console.error("Could not load admin dashboard.", error);
                const tableBody = document.getElementById("adminUsersTableBody");
                if (tableBody) {
                    const row = document.createElement("tr");
                    const cell = document.createElement("td");
                    cell.colSpan = 5;
                    cell.className = "px-4 py-8 text-center text-rose-700";
                    cell.textContent = error.message || "Could not load accounts.";
                    row.appendChild(cell);
                    tableBody.replaceChildren(row);
                }
                showToast(error.message || "Could not load admin dashboard.", "error");
            }
        }

        async function createAdminUser(event) {
            event.preventDefault();
            if (currentUser?.role !== "Admin" || currentUser.adminLevel !== "super_admin") {
                showToast("Only the ATUDTA Super Admin can create Admin Users.", "error");
                return;
            }

            const form = event.currentTarget;
            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            try {
                const result = await apiRequest("/api/admin/users", {
                    method: "POST",
                    body: JSON.stringify({
                        name: document.getElementById("adminName").value.trim(),
                        email: document.getElementById("adminEmail").value.trim().toLowerCase(),
                        password: document.getElementById("adminPassword").value,
                        contactNumber: document.getElementById("adminContact").value.trim(),
                        address: document.getElementById("adminAddress").value.trim()
                    })
                });
                form.reset();
                showToast(result.message || "Admin User created successfully.");
                await renderAdminDashboard();
            } catch (error) {
                showToast(error.message || "Could not create the Admin User account.", "error");
            } finally {
                submitButton.disabled = false;
            }
        }

        // Render All Views
        function renderAll() {
            const page = document.body.dataset.appPage;
            if (page === "products") {
                renderCustomerProducts();
                updateCartUI();
                renderReviews();
            } else if (page === "customer") {
                renderCustomerOrderLists();
            } else if (page === "reviews") {
                renderReviews();
            } else if (page === "payment") {
                renderPaymentPage();
            } else if (page === "vendor") {
                renderVendorDashboard();
            } else if (page === "rider" || page === "delivery") {
                renderRiderDashboard();
            } else if (page === "admin") {
                void renderAdminDashboard();
            }
        }

        // ==========================================
        // INITIALIZATION ON LOAD
        // ==========================================
        window.addEventListener("load", async () => {
            const savedSession = sessionStorage.getItem("atudtaSession");
            const authToken = sessionStorage.getItem("atudtaAuthToken");
            if (savedSession && !authToken) {
                sessionStorage.removeItem("atudtaSession");
                window.location.replace("login.html");
                return;
            }
            if (savedSession) {
                currentUser = users.find(user => user.id === savedSession || user.email === savedSession) || null;
                if (currentUser) {
                    cart = loadCartForUser(currentUser);
                }
            }

            const page = document.body.dataset.appPage;
            const publicPages = ["login", "signup"];
            const rolePageAllowed = {
                Admin: ["admin"],
                Customer: ["customer", "products", "payment", "reviews"],
                Vendor: ["vendor"],
                Rider: ["rider", "delivery"]
            };

            if (!currentUser) {
                if (!publicPages.includes(page)) {
                    window.location.replace("login.html");
                    return;
                }
                renderAuthHeaderButtons();
                return;
            }
            if (!Object.hasOwn(rolePages, currentUser.role)) {
                sessionStorage.removeItem("atudtaSession");
                window.location.replace("login.html");
                return;
            }
            if (publicPages.includes(page)) {
                window.location.replace(rolePages[currentUser.role]);
                return;
            }
            if (!rolePageAllowed[currentUser.role]?.includes(page)) {
                window.location.replace(rolePages[currentUser.role]);
                return;
            }

            document.querySelectorAll(".userName").forEach(el => { el.textContent = currentUser.name; });
            document.getElementById("headerUserLabel").textContent =
                `${currentUser.name} (${currentUser.role}) - ${currentUser.barangay || "Polangui"}`;
            renderAuthHeaderButtons();
            try {
                await loadProductsFromDatabase();
            } catch (error) {
                console.error("Could not load products from MongoDB.", error);
                showToast(error.message || "Could not load products from MongoDB.", "error");
            }
            try {
                await loadOrdersFromDatabase();
            } catch (error) {
                orders = [];
                console.error("Could not load orders from MongoDB.", error);
                showToast(error.message || "Could not load orders from MongoDB.", "error");
            }
            if (currentUser.role === "Customer") {
                try {
                    await loadReviewsFromDatabase();
                } catch (error) {
                    reviews = [];
                    console.error("Could not load reviews from MongoDB.", error);
                    showToast(error.message || "Could not load reviews from MongoDB.", "error");
                }
            }
            let orderRefreshErrorShown = false;
            window.setInterval(async () => {
                if (document.hidden || !["customer", "vendor", "rider", "delivery"].includes(page)) {
                    return;
                }
                try {
                    await loadOrdersFromDatabase();
                    orderRefreshErrorShown = false;
                    renderAll();
                } catch (error) {
                    console.error("Could not refresh orders from MongoDB.", error);
                    if (!orderRefreshErrorShown) {
                        showToast(error.message || "Could not refresh orders from MongoDB.", "error");
                        orderRefreshErrorShown = true;
                    }
                }
            }, 15000);
            if (page === "reviews") {
                const params = new URLSearchParams(window.location.search);
                const productId = params.get("product") || sessionStorage.getItem("atudtaReviewProductId");
                const orderId = params.get("order") || sessionStorage.getItem("atudtaReviewOrderId") || "";
                sessionStorage.removeItem("atudtaReviewProductId");
                sessionStorage.removeItem("atudtaReviewOrderId");
                if (productId) {
                    openProductDetails(productId, orderId);
                } else {
                    showToast("Choose a product to view its reviews.", "error");
                    window.location.replace("products.html");
                    return;
                }
            }
            renderAll();
        });