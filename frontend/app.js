        // ==========================================
        // DATA MODEL / ERD IN-MEMORY & LOCALSTORAGE
        // ==========================================
        
        const initialProducts = [];
        const removedProductIds = new Set(["P1", "P2", "P3", "P4"]);

        // System State
        let users = JSON.parse(localStorage.getItem("atudtaUsers") || "[]");
        let products = JSON.parse(localStorage.getItem("atudtaProducts") || JSON.stringify(initialProducts))
            .filter(product => !removedProductIds.has(product.id));
        let orders = JSON.parse(localStorage.getItem("atudtaOrders") || "[]");
        let reviews = JSON.parse(localStorage.getItem("atudtaReviews") || "[]");
        let cart = JSON.parse(localStorage.getItem("atudtaCart") || "[]")
            .filter(item => !removedProductIds.has(item.productId));
        localStorage.setItem("atudtaProducts", JSON.stringify(products));
        localStorage.setItem("atudtaCart", JSON.stringify(cart));
        const DELIVERY_FEE = 58;
        let selectedCartProductIds = new Set();
        
        let currentUser = null;
        let selectedCategory = "All";
        let isRiderDuty = true;
        let riderCurrentLocation = null;
        let riderLocationRequestPending = false;
        let selectedProductId = null;

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

        // Synchronization across tabs
        window.addEventListener('storage', (e) => {
            if (e.key === "atudtaOrders" || e.key === "atudtaProducts") {
                orders = JSON.parse(localStorage.getItem("atudtaOrders") || "[]");
                products = JSON.parse(localStorage.getItem("atudtaProducts") || JSON.stringify(initialProducts))
                    .filter(product => !removedProductIds.has(product.id));
                localStorage.setItem("atudtaProducts", JSON.stringify(products));
                renderAll();
                showToast("System data updated from another window!");
            }
        });

        function saveData() {
            localStorage.setItem("atudtaUsers", JSON.stringify(users));
            localStorage.setItem("atudtaProducts", JSON.stringify(products));
            localStorage.setItem("atudtaOrders", JSON.stringify(orders));
            localStorage.setItem("atudtaReviews", JSON.stringify(reviews));
            localStorage.setItem("atudtaCart", JSON.stringify(cart));
        }

        // ==========================================
        // PAGE & AUTHENTICATION NAVIGATION LOGIC
        // ==========================================
        const rolePages = { Vendor: "vendor.html", Customer: "products.html", Rider: "rider.html" };
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
                profileButton.className = "w-10 h-10 rounded-full overflow-hidden bg-sage-100 text-sage-700 border-2 border-white shadow hover:ring-2 hover:ring-spink-300 transition flex items-center justify-center";
                profileButton.setAttribute("aria-label", "View profile");
                profileButton.title = "View profile";
                profileButton.addEventListener("click", () => toggleProfileModal(true));

                if (currentUser.profilePicture) {
                    const image = document.createElement("img");
                    image.src = currentUser.profilePicture;
                    image.alt = "";
                    image.className = "w-full h-full object-cover";
                    profileButton.appendChild(image);
                } else {
                    const icon = document.createElement("i");
                    icon.className = "fa-solid fa-user";
                    profileButton.appendChild(icon);
                }

                const logoutButton = document.createElement("button");
                logoutButton.type = "button";
                logoutButton.className = "text-xs bg-rose-500 hover:bg-rose-600 text-white font-bold px-3 py-1.5 rounded-lg transition";
                logoutButton.textContent = "Logout";
                logoutButton.addEventListener("click", logout);
                container.append(profileButton, logoutButton);
            } else {
                container.innerHTML = `
                    <button onclick="showPage('loginPage')" class="text-xs bg-spink-400 hover:bg-spink-600 text-white font-bold px-3 py-1.5 rounded-lg transition">
                        Log In
                    </button>
                `;
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

        function toggleProfileModal(open) {
            if (!currentUser) {
                return;
            }

            if (open) {
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
                document.getElementById("profileAddressEditButton").classList.toggle("hidden", currentUser.role !== "Customer");
                document.getElementById("profileAddressEditor").classList.add("hidden");
                if (currentUser.role === "Customer") {
                    if (currentUser.address) {
                        addProfileDetail("Address", currentUser.address);
                    } else {
                        addProfileDetail("House Number", currentUser.houseNumber);
                        addProfileDetail("Street Name", currentUser.streetName);
                        addProfileDetail("Purok Name/Number", currentUser.purok);
                        addProfileDetail("Barangay", currentUser.barangay);
                    }
                } else if (currentUser.role === "Vendor") {
                    addProfileDetail("Role in the Business", currentUser.businessRole);
                    addProfileDetail("Badge Number", currentUser.badgeNumber);
                    addProfileDetail("Stall Number", currentUser.stallNumber);
                    addProfileDetail("Stall Name", currentUser.stallName);
                } else if (currentUser.role === "Rider") {
                    addProfileDetail("Driver's License Number", currentUser.licenseNumber);
                }
            }

            document.getElementById("profileModal").classList.toggle("hidden", !open);
        }

        function openProfileAddressEditor() {
            if (!currentUser || currentUser.role !== "Customer") {
                showToast("Only customer accounts can edit a delivery address here.", "error");
                return;
            }

            document.getElementById("profileAddress").value = currentUser.address ||
                [currentUser.houseNumber, currentUser.streetName, currentUser.purok, currentUser.barangay, "Polangui", "Albay"]
                    .filter(Boolean).join(", ");
            document.getElementById("profileAddressEditButton").classList.add("hidden");
            document.getElementById("profileAddressEditor").classList.remove("hidden");
        }

        function closeProfileAddressEditor() {
            document.getElementById("profileAddressEditor").classList.add("hidden");
            document.getElementById("profileAddressEditButton").classList.toggle("hidden", currentUser?.role !== "Customer");
        }

        function saveProfileAddress(event) {
            event.preventDefault();
            if (!currentUser || currentUser.role !== "Customer") {
                showToast("Only customer accounts can edit a delivery address here.", "error");
                return;
            }

            const updatedUser = {
                ...currentUser,
                address: document.getElementById("profileAddress").value.trim()
            };
            const previousUsers = users;
            const previousUser = currentUser;
            currentUser = updatedUser;
            users = users.map(user => user.id === updatedUser.id ? updatedUser : user);
            try {
                saveData();
            } catch (error) {
                users = previousUsers;
                currentUser = previousUser;
                console.error("Could not save customer address.", error);
                showToast("Could not save your address. Browser storage may be full.", "error");
                return;
            }

            const headerLabel = document.getElementById("headerUserLabel");
            headerLabel.textContent = `${currentUser.name} (${currentUser.role}) - ${currentUser.barangay || "Polangui"}`;
            toggleProfileModal(true);
            showToast("Delivery address updated.");
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

        // SIGN UP FORM
        document.getElementById("signupForm")?.addEventListener("submit", function(e) {
            e.preventDefault();
            const firstName = document.getElementById("signupFirstName").value.trim();
            const middleName = document.getElementById("signupMiddleName").value.trim();
            const lastName = document.getElementById("signupLastName").value.trim();
            const name = [firstName, middleName, lastName].join(" ");
            const contact = document.getElementById("signupContact").value.trim();
            const address = document.getElementById("signupAddress").value.trim();
            const email = document.getElementById("signupEmail").value.trim().toLowerCase();
            const password = document.getElementById("signupPassword").value;
            const role = document.getElementById("signupRole").value;

            if (!Object.hasOwn(rolePages, role)) {
                document.getElementById("signupMessage").textContent = "Please select a valid account role.";
                return;
            }

            if (!address) {
                document.getElementById("signupMessage").textContent = "Please enter your complete address.";
                return;
            }

            if (users.some(user => user.contact === contact)) {
                document.getElementById("signupMessage").textContent = "Contact number already registered!";
                return;
            }

            if (users.some(user => user.email?.toLowerCase() === email)) {
                document.getElementById("signupMessage").textContent = "Email already registered!";
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
                document.getElementById("signupMessage").textContent = "Badge number must use the 111-222-333 format.";
                document.getElementById("signupBadgeNumber").focus();
                return;
            }

            const userId = "U_" + Date.now();
            currentUser = {
                id: userId,
                name,
                contact,
                address,
                email,
                password,
                role,
                ...roleDetails,
                ...(role === "Vendor" ? { businessId: getVendorBusinessId({ id: userId, ...roleDetails }) } : {})
            };
            users.push(currentUser);
            saveData();

            sessionStorage.setItem("atudtaSession", currentUser.id);
            document.getElementById("signupForm").reset();
            updateSignupRoleFields();
            document.getElementById("signupMessage").textContent = "";

            showToast(`Account created for ${currentUser.name}!`);
            openDashboard(currentUser.role);
        });

        // LOGIN FORM
        document.getElementById("loginForm")?.addEventListener("submit", function(e) {
            e.preventDefault();
            const email = document.getElementById("loginEmail").value.trim().toLowerCase();
            const password = document.getElementById("loginPassword").value;

            const user = users.find(candidate =>
                candidate.email?.toLowerCase() === email && candidate.password === password);
            if (!user) {
                document.getElementById("loginMessage").textContent = "Invalid email or password.";
                return;
            }
            if (!Object.hasOwn(rolePages, user.role)) {
                document.getElementById("loginMessage").textContent = "This account has no valid role. Please contact an administrator.";
                return;
            }

            currentUser = user;
            sessionStorage.setItem("atudtaSession", currentUser.id);
            document.getElementById("loginMessage").textContent = "";

            showToast(`Welcome back, ${currentUser.name}!`);
            openDashboard(currentUser.role);
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
            showPage("loginPage");
        }

        // ==========================================
        // CUSTOMER DASHBOARD (OmniMarket)
        // ==========================================
        function toggleCustomerSidebar() {
            const button = document.getElementById("customerSidebarToggle");
            const isOpening = button.getAttribute("aria-expanded") !== "true";
            ["customerCategoriesPanel", "customerIncomingOrdersPanel", "customerReviewableOrdersPanel"]
                .forEach(panelId => document.getElementById(panelId).classList.toggle("hidden", !isOpening));
            const layout = document.getElementById("customerCatalogLayout");
            const sidebar = document.getElementById("customerSidebar");
            const content = document.getElementById("customerCatalogContent");
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
                grid.innerHTML = `<p class="col-span-full text-center text-slate-400 py-10 font-semibold">No wet market produce found.</p>`;
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
                        <p class="text-spink-600 font-extrabold text-lg mt-1">₱${p.price.toFixed(2)}</p>
                        <span class="mt-2 inline-block text-xs font-semibold text-sage-700">View product details & customer reviews</span>
                    </button>
                    <div class="p-4 pt-0">
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="addToCart('${p.id}')" ${!p.inStock ? 'disabled' : ''} 
                                class="col-span-2 py-2 bg-spink-400 hover:bg-spink-600 disabled:bg-slate-200 text-white font-bold rounded-xl text-sm transition">
                                ${p.inStock ? 'Add to Cart' : 'Out of Stock'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
        }

        function addToCart(prodId) {
            const prod = products.find(p => p.id === prodId);
            if (!prod) return;

            const existing = cart.find(c => c.productId === prodId);
            if (existing) {
                existing.quantity++;
            } else {
                cart.push({
                    productId: prod.id,
                    name: prod.name,
                    price: prod.price,
                    quantity: 1,
                    vendorId: prod.vendorId,
                    businessId: getProductBusinessId(prod)
                });
            }

            updateCartUI();
            showToast(`Added ${prod.name} to cart!`);
        }

        function updateCartUI() {
            localStorage.setItem("atudtaCart", JSON.stringify(cart));
            const badge = document.getElementById("cartBadgeCount");
            badge.textContent = cart.length;

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
                                <p class="text-xs text-slate-500 mt-1">₱${item.price.toFixed(2)} each</p>
                                <div class="flex items-center gap-2 mt-2">
                                    <button type="button" onclick="changeCartQuantity('${item.productId}', -1)"
                                        aria-label="Decrease ${escapeHTML(item.name)} quantity"
                                        class="w-7 h-7 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold">−</button>
                                    <span class="min-w-6 text-center font-semibold" aria-label="Quantity">${item.quantity}</span>
                                    <button type="button" onclick="changeCartQuantity('${item.productId}', 1)"
                                        aria-label="Increase ${escapeHTML(item.name)} quantity"
                                        class="w-7 h-7 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold">+</button>
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

        function removeSelectedCartItems() {
            if (selectedCartProductIds.size === 0) {
                showToast("Select at least one product to delete.", "error");
                return;
            }

            const selectedCount = cart.filter(item => selectedCartProductIds.has(item.productId)).length;
            if (!window.confirm(`Delete ${selectedCount} selected product${selectedCount === 1 ? "" : "s"} from your cart?`)) {
                return;
            }

            cart = cart.filter(item => !selectedCartProductIds.has(item.productId));
            selectedCartProductIds.clear();
            updateCartUI();
            showToast(`${selectedCount} selected product${selectedCount === 1 ? "" : "s"} deleted from your cart.`);
        }

        function changeCartQuantity(prodId, change) {
            const item = cart.find(cartItem => cartItem.productId === prodId);
            if (!item) {
                return;
            }
            item.quantity += change;
            if (item.quantity <= 0) {
                cart = cart.filter(cartItem => cartItem.productId !== prodId);
                selectedCartProductIds.delete(prodId);
            }
            updateCartUI();
        }

        function removeFromCart(prodId) {
            cart = cart.filter(c => c.productId !== prodId);
            selectedCartProductIds.delete(prodId);
            updateCartUI();
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
                    <span class="font-semibold text-slate-700">${escapeHTML(item.name)} × ${item.quantity}</span>
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

        function handleCheckout(e) {
            e.preventDefault();
            if (!currentUser || currentUser.role !== "Customer" ||
                !Array.isArray(checkoutDraft) || checkoutDraft.length === 0) {
                showToast("Your checkout session is empty. Return to products and select items again.", "error");
                return;
            }
            const selectedItems = checkoutDraft;

            const itemsSubtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const totalAmount = itemsSubtotal + DELIVERY_FEE;
            const address = document.getElementById("checkoutAddress").value;
            const paymentMethod = document.getElementById("checkoutPayment").value;
            if (!window.confirm(`Confirm delivery to:\n${address}\n\nItems subtotal: ₱${itemsSubtotal.toFixed(2)}\nDelivery fee: ₱${DELIVERY_FEE.toFixed(2)}\nOrder total: ₱${totalAmount.toFixed(2)}\n\nPlace this order for ${selectedItems.reduce((sum, item) => sum + item.quantity, 0)} item(s)?`)) {
                return;
            }

            const newOrder = {
                id: "ORD-" + Math.floor(1000 + Math.random() * 9000),
                userId: currentUser ? currentUser.id : "U1",
                customerName: currentUser ? currentUser.name : "Guest Customer",
                address: address,
                items: selectedItems.map(item => {
                    const product = products.find(candidate => candidate.id === item.productId);
                    return {
                        ...item,
                        vendorId: item.vendorId || product?.vendorId,
                        businessId: item.businessId || (product ? getProductBusinessId(product) : "")
                    };
                }),
                itemsSubtotal: itemsSubtotal,
                deliveryFee: DELIVERY_FEE,
                totalAmount: totalAmount,
                paymentStatus: paymentMethod === 'Cash on Delivery' ? 'Pending COD' : 'Paid Digital',
                paymentMethod: paymentMethod,
                orderStatus: 'Pending',
                courierName: 'Unassigned',
                timestamp: new Date().toLocaleTimeString()
            };

            orders.unshift(newOrder);
            const previousOrders = orders.slice(1);
            const previousCart = cart;
            const selectedIds = new Set(selectedItems.map(item => item.productId));

            cart = cart.filter(item => !selectedIds.has(item.productId));
            try {
                saveData();
            } catch (error) {
                orders = previousOrders;
                cart = previousCart;
                console.error("Could not save customer order.", error);
                showToast("Could not save your order. Browser storage may be full.", "error");
                return;
            }

            sessionStorage.removeItem("atudtaCheckoutDraft");
            checkoutDraft = null;
            showToast(`Order ${newOrder.id} placed successfully!`);
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

        function renderCustomerOrderLists() {
            if (!document.getElementById("customerIncomingOrdersList") ||
                !document.getElementById("customerReviewableOrdersList")) {
                return;
            }
            const myOrders = getCustomerOrders();
            const incomingOrders = myOrders.filter(order => order.orderStatus !== "Delivered");
            const incomingList = document.getElementById("customerIncomingOrdersList");
            incomingList.innerHTML = incomingOrders.length
                ? incomingOrders.map(order => `
                    <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                        <div class="flex justify-between font-bold text-slate-700">
                            <span>${order.id}</span>
                            <span class="text-spink-600">${order.orderStatus}</span>
                        </div>
                        <p class="text-slate-400 mt-1">${order.items.length} items • ₱${order.totalAmount.toFixed(2)}</p>
                    </div>
                `).join("")
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
                        const items = (order.items || []).map(item =>
                            `<li>${escapeHTML(item.name)} × ${Number(item.quantity) || 0}</li>`
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
            if (document.body.dataset.appPage !== "reviews") {
                const orderParameter = preferredOrderId ? `&order=${encodeURIComponent(preferredOrderId)}` : "";
                window.location.assign(`reviews.html?product=${encodeURIComponent(productId)}${orderParameter}`);
                return;
            }

            selectedProductId = productId;
            const imageContainer = document.getElementById("detailProductImage");
            imageContainer.replaceChildren();
            if (product.imageData) {
                const image = document.createElement("img");
                image.src = product.imageData;
                image.alt = product.name;
                image.className = "w-full h-full object-cover";
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
            document.getElementById("detailProductPrice").textContent = `₱${product.price.toFixed(2)}`;
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
        document.getElementById("addReviewForm")?.addEventListener("submit", function(e) {
            e.preventDefault();
            if (!currentUser || currentUser.role !== "Customer") {
                showToast("Log in as a customer to submit a review.", "error");
                return;
            }

            const rating = document.getElementById("reviewRating").value;
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

            reviews.unshift({
                userId: currentUser.id,
                orderId,
                author: currentUser.name,
                rating,
                productId,
                target: purchasedItem.name,
                comment: document.getElementById("reviewComment").value.trim(),
                date: "Just now"
            });
            saveData();
            this.reset();
            openProductDetails(productId);
            renderReviews();
            showToast("Thank you for your product review!");
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
                    const rating = document.createElement("span");
                    rating.className = "text-amber-500";
                    rating.textContent = `${"⭐".repeat(Number(review.rating) || 0)} (${review.rating}/5)`;
                    heading.append(author, rating);
                    const comment = document.createElement("p");
                    comment.className = "mt-2 text-sm text-slate-600 whitespace-pre-wrap";
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
            if (selectedProductId && document.getElementById("detailProductReviews")) {
                renderProductReviews(document.getElementById("reviewOrder")?.value || "");
            }
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
            const imageFile = document.getElementById("prodImageFile").files[0];
            let imageData = "";

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

            const newProduct = {
                id: "P_" + Date.now(),
                vendorId: currentUser.id,
                businessId: getVendorBusinessId(currentUser),
                vendorName: currentUser.stallName,
                name, price, category, inStock: true, imageData
            };
            products.unshift(newProduct);

            try {
                saveData();
            } catch (error) {
                products = products.filter(product => product.id !== newProduct.id);
                console.error("Could not save product.", error);
                showToast("Could not save the product. Browser storage may be full.", "error");
                return;
            }
            toggleProductModal(false);
            e.target.reset();
            showToast("New wet market product listed!");
            renderAll();
        }

        function toggleStock(prodId) {
            const product = products.find(item => item.id === prodId);
            if (!product || !isProductInCurrentVendorBusiness(product)) {
                showToast("You can only change stock for products in your business.", "error");
                return;
            }
            products = products.map(p => p.id === prodId ? { ...p, inStock: !p.inStock } : p);
            saveData();
            renderAll();
        }

        function deleteProduct(prodId) {
            const product = products.find(item => item.id === prodId);
            if (!product || !isProductInCurrentVendorBusiness(product)) {
                showToast("You can only delete products in your business.", "error");
                return;
            }
            products = products.filter(p => p.id !== prodId);
            saveData();
            renderAll();
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
            table.innerHTML = vendorProducts.map(p => `
                <tr>
                    <td class="p-2.5 font-semibold text-slate-800">
                        <div class="flex items-center gap-2">
                            ${p.imageData ? `<img src="${p.imageData}" alt="" class="w-10 h-10 rounded-lg object-cover">` : ""}
                            <span>${p.name}</span>
                        </div>
                    </td>
                    <td class="p-2.5 font-bold text-spink-600">₱${p.price.toFixed(2)}</td>
                    <td class="p-2.5">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${p.inStock ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                            ${p.inStock ? 'In Stock' : 'Out'}
                        </span>
                    </td>
                    <td class="p-2.5 text-right space-x-1">
                        <button onclick="toggleStock('${p.id}')" class="text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">Toggle</button>
                        <button onclick="deleteProduct('${p.id}')" class="text-xs px-2 py-1 bg-rose-100 text-rose-600 rounded hover:bg-rose-200">Delete</button>
                    </td>
                </tr>
            `).join('');

            // Incoming Orders Pipeline
            const pipeline = document.getElementById("vendorOrdersPipeline");
            if (vendorOrders.length === 0) {
                pipeline.innerHTML = `<p class="text-xs text-slate-400">No orders received yet.</p>`;
                return;
            }

            pipeline.innerHTML = vendorOrders.map(o => {
                const businessItems = getOrderItemsForCurrentVendorBusiness(o);
                const businessSubtotal = businessItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
                return `
                <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-extrabold text-slate-800">${o.id} • ${o.customerName}</span>
                        <span class="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">${o.orderStatus}</span>
                    </div>
                    <p class="text-xs text-slate-500">Address: ${o.address}</p>
                    <div class="text-xs text-slate-600">
                        ${businessItems.map(i => `${i.name} (${i.quantity})`).join(', ')}
                    </div>
                    <div class="flex justify-between items-center pt-2">
                        <span class="font-bold text-spink-600 text-sm">Business items: ₱${businessSubtotal.toFixed(2)}</span>
                        ${o.orderStatus === 'Pending' ? `
                            <button onclick="updateOrderStatus('${o.id}', 'Packed')" class="px-3 py-1 bg-sage-600 text-white text-xs font-bold rounded-lg hover:bg-sage-700">
                                Pack Order
                            </button>
                        ` : `<span class="text-xs text-emerald-600 font-bold"><i class="fa-solid fa-check"></i> Ready for Rider Pickup</span>`}
                    </div>
                </div>
            `;
            }).join('');
        }

        function updateOrderStatus(orderId, status) {
            const order = orders.find(item => item.id === orderId);
            if (currentUser?.role === "Vendor" && (!order || !isOrderInCurrentVendorBusiness(order))) {
                showToast("You can only update orders containing products from your business.", "error");
                return;
            }
            if (status === "Delivered" && (!Array.isArray(order?.deliveryProof) || order.deliveryProof.length === 0)) {
                showToast("Upload delivery confirmation photos before marking this order delivered.", "error");
                return;
            }
            orders = orders.map(o => o.id === orderId ? { ...o, orderStatus: status } : o);
            saveData();
            showToast(`Order ${orderId} status changed to ${status}`);
            renderAll();
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

        function acceptRiderDelivery(orderId) {
            if (!currentUser || currentUser.role !== "Rider" || !isRiderDuty) {
                showToast("Go online as a rider before accepting a delivery.", "error");
                return;
            }
            if (!riderCurrentLocation) {
                showToast("Get your current location before accepting a delivery.", "error");
                return;
            }

            const order = orders.find(item => item.id === orderId);
            if (!order || order.orderStatus !== "Packed" ||
                order.courierName !== "Unassigned" || order.courierId ||
                (order.declinedBy || []).includes(currentUser.id)) {
                showToast("This delivery is no longer available to accept.", "error");
                renderAll();
                return;
            }

            orders = orders.map(item => item.id === orderId
                ? { ...item, courierName: currentUser.name, courierId: currentUser.id }
                : item);
            saveData();
            showToast(`Delivery ${orderId} accepted.`);
            renderAll();
        }

        function declineRiderDelivery(orderId) {
            if (!currentUser || currentUser.role !== "Rider" || !isRiderDuty) {
                showToast("Go online as a rider before responding to delivery offers.", "error");
                return;
            }
            const order = orders.find(item => item.id === orderId);
            if (!order || order.orderStatus !== "Packed" ||
                order.courierName !== "Unassigned" || order.courierId) {
                showToast("This delivery is no longer available to decline.", "error");
                renderAll();
                return;
            }

            orders = orders.map(item => item.id === orderId
                ? { ...item, declinedBy: [...new Set([...(item.declinedBy || []), currentUser.id])] }
                : item);
            saveData();
            showToast(`Delivery ${orderId} declined.`);
            renderAll();
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

        function updateDeliveryProofSelection(orderId) {
            const input = document.getElementById(`deliveryProof-${orderId}`);
            const button = document.getElementById(`markDelivered-${orderId}`);
            const status = document.getElementById(`deliveryProofStatus-${orderId}`);
            if (!input || !button || !status) {
                return;
            }

            const files = Array.from(input.files || []);
            const invalidFile = files.find(file =>
                !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 1024 * 1024
            );
            if (files.length > 3) {
                status.textContent = "Choose no more than 3 photos.";
                button.disabled = true;
                return;
            }
            if (invalidFile) {
                status.textContent = !["image/jpeg", "image/png", "image/webp"].includes(invalidFile.type)
                    ? "Choose a JPG, PNG, or WEBP photo."
                    : `${invalidFile.name} is larger than 1 MB.`;
                button.disabled = true;
                return;
            }

            button.disabled = files.length === 0;
            status.textContent = files.length
                ? `${files.length} photo${files.length === 1 ? "" : "s"} selected.`
                : "Upload at least one photo to enable delivery confirmation.";
        }

        function readDeliveryProofFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error(`Could not read ${file.name}. Please try another photo.`));
                reader.onload = () => {
                    const image = new Image();
                    image.onerror = () => reject(new Error(`Could not open ${file.name}. Please try another photo.`));
                    image.onload = () => {
                        const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
                        const canvas = document.createElement("canvas");
                        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                        const context = canvas.getContext("2d");
                        if (!context) {
                            reject(new Error("Your browser could not process the delivery photo."));
                            return;
                        }
                        context.fillStyle = "#FFFFFF";
                        context.fillRect(0, 0, canvas.width, canvas.height);
                        context.drawImage(image, 0, 0, canvas.width, canvas.height);
                        try {
                            resolve({
                                imageData: canvas.toDataURL("image/jpeg", 0.75),
                                fileName: file.name,
                                uploadedAt: new Date().toISOString()
                            });
                        } catch (error) {
                            reject(new Error(`Could not process ${file.name}. Please try another photo.`));
                        }
                    };
                    image.src = reader.result;
                };
                reader.readAsDataURL(file);
            });
        }

        async function confirmRiderDelivery(orderId) {
            const order = orders.find(item => item.id === orderId);
            const input = document.getElementById(`deliveryProof-${orderId}`);
            if (!currentUser || currentUser.role !== "Rider" || !order ||
                !isAssignedToCurrentRider(order) || order.orderStatus !== "Out for Delivery" || !input) {
                showToast("This delivery cannot be confirmed by your rider account.", "error");
                renderAll();
                return;
            }

            const files = Array.from(input.files || []);
            if (files.length < 1 || files.length > 3) {
                showToast("Upload between 1 and 3 delivery photos before marking delivered.", "error");
                return;
            }
            const invalidFile = files.find(file =>
                !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 1024 * 1024
            );
            if (invalidFile) {
                showToast(!["image/jpeg", "image/png", "image/webp"].includes(invalidFile.type)
                    ? "Only JPG, PNG, or WEBP photos can be used as delivery proof."
                    : `${invalidFile.name} is larger than 1 MB.`, "error");
                return;
            }

            const button = document.getElementById(`markDelivered-${orderId}`);
            const riderId = currentUser.id;
            button.disabled = true;
            button.textContent = "Saving photos...";
            try {
                const deliveryProof = await Promise.all(files.map(readDeliveryProofFile));
                const latestOrder = orders.find(item => item.id === orderId);
                if (!currentUser || currentUser.id !== riderId || !latestOrder ||
                    !isAssignedToCurrentRider(latestOrder) || latestOrder.orderStatus !== "Out for Delivery") {
                    showToast("The delivery changed before the photos could be saved. Please review the order.", "error");
                    renderAll();
                    return;
                }

                const previousOrders = orders;
                orders = orders.map(item => item.id === orderId
                    ? {
                        ...item,
                        orderStatus: "Delivered",
                        deliveryProof,
                        deliveryConfirmedAt: new Date().toISOString()
                    }
                    : item);
                try {
                    localStorage.setItem("atudtaOrders", JSON.stringify(orders));
                } catch (error) {
                    orders = previousOrders;
                    console.error("Could not save delivery proof.", error);
                    showToast("Could not save delivery photos. Browser storage may be full; remove some stored data and try again.", "error");
                    renderAll();
                    return;
                }
                showToast(`Delivery ${orderId} confirmed with ${deliveryProof.length} photo${deliveryProof.length === 1 ? "" : "s"}.`);
                renderAll();
            } catch (error) {
                console.error("Could not read delivery proof photos.", error);
                showToast(error.message || "Could not read the delivery photos. Please try again.", "error");
                button.textContent = "Mark Delivered";
                updateDeliveryProofSelection(orderId);
            }
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
                    </div>
                    <div class="flex justify-between items-center text-xs pt-2 border-t border-slate-100">
                        <span class="font-extrabold text-slate-700">Collect COD: ₱${o.totalAmount.toFixed(2)}</span>
                        ${o.orderStatus === 'Packed' ? `
                            <button onclick="updateRiderDeliveryStatus('${o.id}', 'Out for Delivery')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition">
                                Start Delivery
                            </button>
                        ` : `
                            <label for="deliveryProof-${o.id}" class="block w-full text-xs font-semibold text-slate-600">
                                Delivery confirmation photos (1-3 photos, max 1 MB each)
                            </label>
                            <input id="deliveryProof-${o.id}" type="file" accept="image/jpeg,image/png,image/webp" multiple
                                onchange="updateDeliveryProofSelection('${o.id}')"
                                class="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-bold file:text-emerald-700 hover:file:bg-emerald-100">
                            <p id="deliveryProofStatus-${o.id}" class="w-full text-xs text-slate-500" aria-live="polite">
                                Upload at least one photo to enable delivery confirmation.
                            </p>
                            <button id="markDelivered-${o.id}" onclick="confirmRiderDelivery('${o.id}')" disabled
                                class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition">
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
                        `<li>${escapeHTML(item.name)} × ${Number(item.quantity) || 0}</li>`
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
            }
        }

        // ==========================================
        // INITIALIZATION ON LOAD
        // ==========================================
        window.addEventListener("load", () => {
            const savedSession = sessionStorage.getItem("atudtaSession");
            if (savedSession) {
                currentUser = users.find(user => user.id === savedSession || user.email === savedSession) || null;
            }

            const page = document.body.dataset.appPage;
            const publicPages = ["login", "signup"];
            const rolePageAllowed = {
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