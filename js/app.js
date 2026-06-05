const API_URL    = "./menu.json";
const TVA        = 0.20;
const MAX_ORDERS = 5;

// je garde le panier et les commandes en localStorage pour que ça reste même après un rafraîchissement.
let cart   = JSON.parse(localStorage.getItem("cart"))   || [];
let orders = JSON.parse(localStorage.getItem("orders")) || [];

// Je crée une classe d'erreur personnalisée pour les erreurs de commande.
class OrderError extends Error {
    constructor(msg) {
        super(msg);
        this.name = "OrderError";
    }
}

// je crée une classe MenuItem pour représenter un plat du menu.
class MenuItem {
    #id;
    #name;
    #price;
    #image;

    constructor(plat) {
        this.#id    = plat.id;
        this.#name  = plat.name;
        this.#price = plat.price;
        this.#image = plat.image;
    }

    get id()    { return this.#id; }
    get name()  { return this.#name; }
    get price() { return this.#price; }
    get image() { return this.#image; }
}

// je crée une classe CartItem qui hérite de MenuItem car un article du panier est un plat du menu avec en plus une quantité.
class CartItem extends MenuItem {
    #quantity;

    constructor(plat) {
        super(plat);
        this.#quantity = 1;
    }

    get quantity() { return this.#quantity; }
    set quantity(val) { this.#quantity = val; }

    toJSON() {
        return {
            id:       this.id,
            name:     this.name,
            price:    this.price,
            image:    this.image,
            quantity: this.#quantity,
        };
    }
}

// je créer une classe Order pour représenter une commande
class Order {
    #id;
    #items;
    #totalTTC;
    #status;
    #createdAt;

    constructor(items, totalTTC) {
        this.#id        = Date.now();
        this.#items     = [...items];
        this.#totalTTC  = totalTTC;
        this.#status    = "preparation";
        this.#createdAt = new Date().toLocaleTimeString();
    }

    get id()        { return this.#id; }
    get items()     { return this.#items; }
    get totalTTC()  { return this.#totalTTC; }
    get status()    { return this.#status; }
    get createdAt() { return this.#createdAt; }

    setStatus(newStatus) { this.#status = newStatus; }

    toJSON() {
        return {
            id:        this.#id,
            items:     this.#items,
            totalTTC:  this.#totalTTC,
            status:    this.#status,
            createdAt: this.#createdAt,
        };
    }
}
// je créer la fonction "formatPrice" pour afficher les prix  et la fonction "delay" pour faire une pause dans une fonction async.
const formatPrice = (n) => n.toFixed(2) + " €";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Je calcule combien coûte tout le panier.
const computeCartTotal = (items) =>
    items.reduce((sum, item) => sum + item.price * item.quantity, 0);

// Je garde le panier et les commandes en local.
const save = () => {
    localStorage.setItem("cart",   JSON.stringify(cart));
    localStorage.setItem("orders", JSON.stringify(orders));
};

// j'affiche une alerte
const showToast = (msg, type = "success") => {
    const el = document.getElementById("notification");
    el.querySelector(".toast-body").textContent = msg;
    el.className = `toast ${type === "error" ? "bg-danger text-white" : "bg-success text-white"}`;
    new bootstrap.Toast(el, { delay: 3000 }).show();
};


//Je vais chercher le menu sur le serveur et je l'affiche, Si ça rate, j'affiche un message d'erreur.
const fetchMenu = async () => {
    try {
        const res  = await fetch(API_URL);
        if (!res.ok) throw new Error("Impossible de charger le menu.");
        const menu = await res.json();
        renderMenu(menu);
    } catch (e) {
        document.getElementById("menu").innerHTML =
            `<p class="text-danger">${e.message}</p>`;
    }
};

// je créer le dom pour une carte de plat
const createMenuCard = (plat) => {
    const col = document.createElement("div");
    col.className = "col-sm-6 col-md-4";
    col.innerHTML = `
        <div class="card h-100 shadow-sm">
            <img src="${plat.image}" class="card-img-top" alt="${plat.name}"
                style="height:160px;object-fit:cover"
                onerror="this.src='https://via.placeholder.com/300x160?text=${encodeURIComponent(plat.name)}'">
            <div class="card-body d-flex flex-column">
                <h5 class="card-title">${plat.name}</h5>
                <p class="card-text text-muted small">${plat.description}</p>
                <div class="mt-auto d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-primary">${formatPrice(plat.price)}</span>
                    <button class="btn btn-sm btn-outline-primary" data-id="${plat.id}">+ Ajouter</button>
                </div>
            </div>
        </div>`;
    return col;
};

const renderMenu = (menu) => {
    const container = document.getElementById("menu");
    container.innerHTML = "";

    // je parcourt chaque plat et j'ajoute sa carte.
    menu.forEach((plat) => container.appendChild(createMenuCard(plat)));

    // Pour chaque bouton, j'ajoute un clic qui met le plat dans le panier.
    container.querySelectorAll("button[data-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const plat = menu.find((p) => p.id === parseInt(btn.dataset.id));
            addToCart(plat);
        });
    });
};

// J'ajoute le Panier
const addToCart = (plat) => {
    const existing = cart.find((item) => item.id === plat.id);

    if (existing) {
        existing.quantity++;
    } else {
        cart.push(new CartItem(plat));  // je crée un nouvel objet pour cet article grace à la classe CartItem.
    }

    save();
    renderCart();
    showToast(`"${plat.name}" ajouté !`);
};

// mise a jour de la quantite d'un article du panier
const updateCartItem = (id, action) => {
    const item = cart.find((i) => i.id === id);
    // je supprime l'article du panier on cliquant sur remove
    if (action === "remove" || (action === "dec" && item.quantity === 1)) {
        // j'utilise "filter" pour enlève l'article si on le supprime ou si la quantité tombe à zéro.
        cart = cart.filter((i) => i.id !== id);
    } else {
        item.quantity += action === "inc" ? 1 : -1;
    }

    save();
    renderCart();
};

// Je crée le html pour un article du panier.
const createCartItemHTML = (item) => `
    <div class="d-flex justify-content-between align-items-center mb-2">
        <div>
            <small class="fw-semibold">${item.name}</small><br>
            <small class="text-muted">${formatPrice(item.price)} / unité</small>
        </div>
        <div class="d-flex align-items-center gap-1">
            <button class="btn btn-sm btn-outline-secondary" data-action="dec" data-id="${item.id}">−</button>
            <span class="px-2">${item.quantity}</span>
            <button class="btn btn-sm btn-outline-secondary" data-action="inc" data-id="${item.id}">+</button>
            <button class="btn btn-sm btn-outline-danger" data-action="remove" data-id="${item.id}">✕</button>
        </div>
    </div>`;

const renderCart = () => {
    const container = document.getElementById("cart-items");
    const btnOrder  = document.getElementById("btn-order");

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-muted">Votre panier est vide. fais pas le Rat et ajoute des plats !</p>';
        document.getElementById("cart-total").textContent = "0.00 €";
        btnOrder.disabled = true;
        return;
    }

    // map — transformer chaque item en HTML (cours p.48)
    container.innerHTML = cart.map(createCartItemHTML).join("");

    container.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", () =>
            updateCartItem(parseInt(btn.dataset.id), btn.dataset.action)
        );
    });

    document.getElementById("cart-total").textContent = formatPrice(computeCartTotal(cart));
    btnOrder.disabled = false;
};
const fakePostCommande = () => new Promise((resolve, reject) => {
    setTimeout(() => {
        Math.random() < 0.05
            ? reject(new OrderError("Erreur réseau, réessaie."))
            : resolve();
    }, 800);
});

// Je créele html du résumé de commande.
const buildOrderSummaryHTML = (items, ht, tva) => {
    // j'utilise la méthode "map" pour créer une ligne HTML pour chaque article du panier, puis je les joins tous ensemble avec "join".
    const lignes = items.map((i) => `
        <li class="list-group-item d-flex justify-content-between">
            <span>${i.name} × ${i.quantity}</span>
            <span>${formatPrice(i.price * i.quantity)}</span>
        </li>`).join("");

    return `
        <ul class="list-group list-group-flush mb-3">${lignes}</ul>
        <div class="d-flex justify-content-between"><span>Total HT</span><span>${formatPrice(ht)}</span></div>
        <div class="d-flex justify-content-between text-muted"><span>TVA (20%)</span><span>${formatPrice(tva)}</span></div>
        <hr>
        <div class="d-flex justify-content-between fw-bold"><span>Total TTC</span><span>${formatPrice(ht + tva)}</span></div>`;
};

// Le bouton "commander" affiche le résumer de la commande dans un modal
document.getElementById("btn-order").addEventListener("click", () => {
    try {
        if (orders.length >= MAX_ORDERS) {
            throw new OrderError(`Max ${MAX_ORDERS} commandes simultanées.`);
        }

        const ht  = computeCartTotal(cart);
        const tva = ht * TVA;

        document.getElementById("order-summary").innerHTML =
            buildOrderSummaryHTML(cart, ht, tva);

        new bootstrap.Modal(document.getElementById("orderModal")).show();

    } catch (e) {
        if (e instanceof OrderError) showToast(e.message, "error");
    }
});

// Le bouton "confirmer" sa envoie la commande et on attend une réponse.
document.getElementById("btn-confirm-order").addEventListener("click", async () => {
    bootstrap.Modal.getInstance(document.getElementById("orderModal")).hide();

    try {
        await fakePostCommande();  // je simule une requete pour envoyer la commande au serveur
        const order = new Order(cart, computeCartTotal(cart) * (1 + TVA));
        orders.push(order);
        cart = [];
        save();
        renderCart();
        renderOrders();
        showToast("Commande validée ! En préparation");
        simulateOrderProgress(order.id);

    } catch (e) {
        showToast(e.message, "error");
    }
});

// Je change le statut de la commande
const simulateOrderProgress = async (id) => {
    await delay(4000);
    orders.find((o) => o.id === id).setStatus("livraison");
    save();
    renderOrders();
    showToast("En livraison !");

    await delay(6000);
    orders.find((o) => o.id === id).setStatus("livre");
    save();
    renderOrders();
    showToast("Livré ! Bonne appétit");
};

// j'affiche les commandes dans des cartes avec leur statut.
const STATUS_MAP = {
    preparation: { label: "En préparation", badge: "warning", step: 1 },
    livraison:   { label: "En livraison",   badge: "info",    step: 2 },
    livre:       { label: "Livré !",        badge: "success", step: 3 },
};

// Je crée le html d'une carte commande.
const createOrderCardHTML = (order) => {
    const status = STATUS_MAP[order.status] || { label: "Inconnu", badge: "secondary" };
    const itemsLabel = order.items.map((item) => `${item.name} x${item.quantity}`).join(", ");

    const cancelBtn = order.status === "preparation"
        ? `<button class="btn btn-sm btn-outline-danger btn-cancel" data-id="${order.id}">Annuler</button>`
        : "";

    return `
        <div class="col-md-6 col-lg-4">
            <div class="card shadow-sm h-100">
                <div class="card-header d-flex justify-content-between">
                    <span class="badge bg-${status.badge}">${status.label}</span>
                </div>
                <div class="card-body">
                    <p>${itemsLabel}</p>
                    <p class="fw-bold">${formatPrice(order.totalTTC)} TTC</p>
                </div>
                <div class="card-footer text-end">
                    ${cancelBtn}
                </div>
            </div>
        </div>`;
};

const renderOrders = () => {
    const container = document.getElementById("orders");

    if (orders.length === 0) {
        container.innerHTML = '<p class="text-muted">Aucune commande en cours.</p>';
        return;
    }

    // grace map je génère le HTML de chaque commande (vue dans le cours p.48)
    container.innerHTML = orders.map(createOrderCardHTML).join("");

    container.querySelectorAll(".btn-cancel").forEach((btn) => {
        btn.addEventListener("click", () => {
            // On enlève la commande quand on clique sur annuler.
            orders = orders.filter((o) => o.id !== parseInt(btn.dataset.id));
            save();
            renderOrders();
            showToast("Commande annulée.", "error");
        });
    });
};

// Au chargement de la page, je vais chercher le menu et j'affiche le panier et les commandes.
document.addEventListener("DOMContentLoaded", () => {
    fetchMenu();
    renderCart();
    renderOrders();
});