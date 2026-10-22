const STORAGE_KEYS = {
  menu: "cafe_menu",
  cart: "cafe_cart",
  orders: "cafe_orders",
};

const INITIAL_MENU = [
  { id: 1, name: "아메리카노", price: 4000, stock: 10, description: "고소하고 깔끔한 시그니처 커피", color: "#d9b18a", drink: "#8b5e3c" },
  { id: 2, name: "카페라떼", price: 4500, stock: 10, description: "부드러운 우유와 에스프레소", color: "#e8cda8", drink: "#c49a70" },
  { id: 3, name: "바닐라라떼", price: 5000, stock: 10, description: "달콤한 바닐라 향을 더한 라떼", color: "#edcfab", drink: "#a97952" },
  { id: 4, name: "카푸치노", price: 4500, stock: 10, description: "폭신한 우유 거품이 가득하게", color: "#dfc4a3", drink: "#b78962" },
  { id: 5, name: "카라멜 마키아토", price: 5500, stock: 10, description: "카라멜의 달콤함을 더한 한 잔", color: "#e8c09a", drink: "#9a6843" },
];

const elements = {
  menu: document.querySelector("#menu-list"),
  cart: document.querySelector("#cart-items"),
  cartCount: document.querySelector("#cart-count"),
  mobileCartCount: document.querySelector("#mobile-cart-count"),
  cartTotal: document.querySelector("#cart-total"),
  mobileCartTotal: document.querySelector("#mobile-cart-total"),
  myOrders: document.querySelector("#my-orders"),
  adminOrders: document.querySelector("#admin-orders"),
  stock: document.querySelector("#stock-list"),
  cartPanel: document.querySelector("#cart-panel"),
  mobileCartToggle: document.querySelector("#mobile-cart-toggle"),
  dialog: document.querySelector("#order-dialog"),
  toast: document.querySelector("#toast"),
};

let menu = loadMenu();
let cart = loadCart();
let orders = loadOrders();
let toastTimer;

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`Unable to read ${key} from localStorage.`, error);
    showToast("저장된 데이터를 불러오지 못했어요.");
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Unable to save ${key} to localStorage.`, error);
    showToast("저장에 실패했어요. 브라우저 저장 공간을 확인해 주세요.");
    return false;
  }
}

function parseStored(key, validate, fallback) {
  const stored = readStorage(key);
  if (stored === null) return fallback;
  try {
    const value = JSON.parse(stored);
    if (validate(value)) return value;
  } catch (error) {
    console.warn(`Invalid ${key} data; restoring defaults.`, error);
  }
  console.warn(`Invalid ${key} data; restoring defaults.`);
  writeStorage(key, fallback);
  return fallback;
}

function validMenu(value) {
  return Array.isArray(value)
    && value.length === INITIAL_MENU.length
    && INITIAL_MENU.every((item) => value.some((saved) => saved?.id === item.id && Number.isInteger(saved.stock) && saved.stock >= 0));
}

function loadMenu() {
  const saved = parseStored(STORAGE_KEYS.menu, validMenu, INITIAL_MENU.map(({ id, stock }) => ({ id, stock })));
  return INITIAL_MENU.map((item) => ({
    ...item,
    stock: saved.find((savedItem) => savedItem.id === item.id)?.stock ?? item.stock,
  }));
}

function validCart(value) {
  return Array.isArray(value) && value.every((item) =>
    Number.isInteger(item?.menuId)
    && INITIAL_MENU.some((menuItem) => menuItem.id === item.menuId)
    && typeof item.shot === "boolean"
    && typeof item.syrup === "boolean"
    && Number.isInteger(item.qty)
    && item.qty > 0,
  );
}

function loadCart() {
  const saved = parseStored(STORAGE_KEYS.cart, validCart, []);
  const totals = new Map();
  return saved.filter((item) => {
    const product = menu.find((menuItem) => menuItem.id === item.menuId);
    const total = (totals.get(item.menuId) ?? 0) + item.qty;
    if (!product || total > product.stock) return false;
    totals.set(item.menuId, total);
    return true;
  });
}

function validOrders(value) {
  return Array.isArray(value) && value.every((order) =>
    Number.isInteger(order?.id)
    && Array.isArray(order.items)
    && order.items.every((item) =>
      Number.isInteger(item?.menuId)
      && INITIAL_MENU.some((menuItem) => menuItem.id === item.menuId)
      && typeof item.shot === "boolean"
      && typeof item.syrup === "boolean"
      && Number.isInteger(item.qty)
      && item.qty > 0,
    )
    && Number.isFinite(order.total)
    && (order.status === "제조 중" || order.status === "제조 완료")
    && typeof order.createdAt === "string",
  );
}

function loadOrders() {
  return parseStored(STORAGE_KEYS.orders, validOrders, []);
}

function saveCart() {
  writeStorage(STORAGE_KEYS.cart, cart);
}

function saveMenu() {
  writeStorage(STORAGE_KEYS.menu, menu.map(({ id, stock }) => ({ id, stock })));
}

function formatPrice(amount) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function menuItem(menuId) {
  return menu.find((item) => item.id === menuId);
}

function unitPrice(product, item) {
  return product.price + (item.shot ? 500 : 0);
}

function optionText(item) {
  const options = [];
  if (item.shot) options.push("샷 추가");
  if (item.syrup) options.push("시럽 추가");
  return options.length ? options.join(" · ") : "기본";
}

function cartQuantity(menuId) {
  return cart.reduce((sum, item) => sum + (item.menuId === menuId ? item.qty : 0), 0);
}

function cartSubtotal(item) {
  return unitPrice(menuItem(item.menuId), item) * item.qty;
}

function cartGrandTotal() {
  return cart.reduce((sum, item) => sum + cartSubtotal(item), 0);
}

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function renderMenu() {
  elements.menu.innerHTML = menu.map((item) => {
    const soldOut = item.stock === 0;
    return `
      <article class="menu-card${soldOut ? " is-sold-out" : ""}" style="--art-bg:${item.color};--drink:${item.drink}">
        <div class="drink-art" aria-hidden="true"><span class="cup"></span>${soldOut ? '<span class="sold-out-label">품절</span>' : ""}</div>
        <div class="menu-card-content">
          <div class="menu-title-row"><h3>${item.name}</h3><span class="menu-price">${formatPrice(item.price)}</span></div>
          <p class="menu-description">${item.description}</p>
          <div class="option-row">
            <label class="option-label"><input type="checkbox" data-option="shot" data-menu-id="${item.id}" ${soldOut ? "disabled" : ""}> 샷 추가 <span class="option-price">+500원</span></label>
            <label class="option-label"><input type="checkbox" data-option="syrup" data-menu-id="${item.id}" ${soldOut ? "disabled" : ""}> 시럽 추가</label>
          </div>
          <p class="menu-stock${item.stock <= 3 ? " is-low" : ""}">${soldOut ? "현재 품절이에요" : `남은 수량 ${item.stock}개`}</p>
          <button class="button button-primary add-button" type="button" data-action="add" data-menu-id="${item.id}" ${soldOut ? "disabled" : ""}>${soldOut ? "품절" : "담기"}</button>
        </div>
      </article>`;
  }).join("");
}

function renderCart() {
  elements.cart.innerHTML = cart.length ? cart.map((item, index) => {
    const product = menuItem(item.menuId);
    const maxQty = cartQuantity(item.menuId) >= product.stock;
    return `
      <article class="cart-item">
        <div class="cart-item-top">
          <div><p class="cart-item-name">${product.name}</p><p class="cart-item-options">${optionText(item)} · ${formatPrice(unitPrice(product, item))}</p></div>
          <button class="remove-item" type="button" data-action="remove" data-index="${index}" aria-label="${product.name} 삭제">삭제</button>
        </div>
        <div class="cart-item-bottom">
          <div class="quantity-control" aria-label="${product.name} 수량">
            <button type="button" data-action="decrease" data-index="${index}" aria-label="수량 줄이기">−</button>
            <span>${item.qty}</span>
            <button type="button" data-action="increase" data-index="${index}" aria-label="수량 늘리기" ${maxQty ? "disabled" : ""}>+</button>
          </div>
          <span class="cart-item-total">${formatPrice(cartSubtotal(item))}</span>
        </div>
      </article>`;
  }).join("") : '<p class="empty-state">아직 담은 메뉴가 없어요.<br>마음에 드는 커피를 골라 보세요.</p>';

  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const total = formatPrice(cartGrandTotal());
  elements.cartCount.textContent = count;
  elements.mobileCartCount.textContent = count;
  elements.cartTotal.textContent = total;
  elements.mobileCartTotal.textContent = total;
  document.querySelector("#clear-cart").disabled = cart.length === 0;
  document.querySelector("#checkout").disabled = cart.length === 0;
  document.querySelector("#clear-cart").style.opacity = cart.length ? "1" : ".45";
}

function orderItemSummary(items) {
  return items.map((item) => {
    const product = menuItem(item.menuId);
    const option = item.shot || item.syrup ? ` (${optionText(item)})` : "";
    return `${product.name}${option} × ${item.qty}`;
  }).join(", ");
}

function renderMyOrders() {
  const latestOrders = [...orders].sort((a, b) => b.id - a.id);
  elements.myOrders.innerHTML = latestOrders.length ? latestOrders.map((order) => `
    <article class="order-card">
      <div class="order-card-head">
        <div><span class="order-number">#${order.id}</span><time class="order-time">${formatTime(order.createdAt)}</time></div>
        <span class="status-badge${order.status === "제조 완료" ? " is-complete" : ""}">${order.status}</span>
      </div>
      <p class="order-summary">${orderItemSummary(order.items)}</p>
      <p class="order-total">${formatPrice(order.total)}</p>
    </article>`).join("") : '<p class="empty-state">아직 주문이 없어요.<br>첫 주문을 기다리고 있어요.</p>';
}

function renderAdmin() {
  const latestOrders = [...orders].sort((a, b) => b.id - a.id);
  elements.adminOrders.innerHTML = latestOrders.length ? latestOrders.map((order) => `
    <article class="admin-order-card">
      <div class="admin-order-head">
        <div><span class="order-number">주문 #${order.id}</span><time class="order-time">${formatTime(order.createdAt)}</time></div>
        <span class="status-badge${order.status === "제조 완료" ? " is-complete" : ""}">${order.status}</span>
      </div>
      <p class="admin-order-items">${orderItemSummary(order.items)}</p>
      <div class="admin-order-foot">
        <strong>${formatPrice(order.total)}</strong>
        ${order.status === "제조 중"
          ? `<button class="button button-primary complete-button" type="button" data-action="complete" data-order-id="${order.id}">제조 완료</button>`
          : '<span class="completed-note">제조 완료</span>'}
      </div>
    </article>`).join("") : '<p class="empty-state">접수된 주문이 없어요.</p>';

  elements.stock.innerHTML = menu.map((item) => {
    const soldOut = item.stock === 0;
    return `
      <article class="stock-card${item.stock <= 3 ? " is-low" : ""}${soldOut ? " is-sold-out" : ""}">
        <p class="stock-name">${item.name}</p>
        <strong class="stock-value">${soldOut ? "품절" : `${item.stock}<small>개</small>`}</strong>
      </article>`;
  }).join("");
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function renderAll() {
  renderMenu();
  renderCart();
  renderMyOrders();
  renderAdmin();
}

function selectedOptions(menuId) {
  return {
    shot: document.querySelector(`[data-option="shot"][data-menu-id="${menuId}"]`).checked,
    syrup: document.querySelector(`[data-option="syrup"][data-menu-id="${menuId}"]`).checked,
  };
}

function addToCart(menuId) {
  const product = menuItem(menuId);
  if (!product || product.stock <= cartQuantity(menuId)) {
    showToast("재고가 부족해요.");
    return;
  }
  const options = selectedOptions(menuId);
  const existing = cart.find((item) => item.menuId === menuId && item.shot === options.shot && item.syrup === options.syrup);
  if (existing) existing.qty += 1;
  else cart.push({ menuId, ...options, qty: 1 });
  saveCart();
  renderCart();
  showToast(`${product.name}을(를) 장바구니에 담았어요.`);
}

function updateQuantity(index, change) {
  const item = cart[index];
  if (!item) return;
  if (change > 0 && cartQuantity(item.menuId) >= menuItem(item.menuId).stock) {
    showToast("재고가 부족해요.");
    return;
  }
  item.qty += change;
  if (item.qty < 1) cart.splice(index, 1);
  saveCart();
  renderCart();
}

function checkout() {
  if (!cart.length) {
    showToast("장바구니가 비어 있어요.");
    return;
  }
  const hasEnoughStock = cart.every((item) => menuItem(item.menuId).stock >= cartQuantity(item.menuId));
  if (!hasEnoughStock) {
    showToast("재고가 부족해요. 장바구니를 확인해 주세요.");
    return;
  }
  const orderItems = cart.map(({ menuId, shot, syrup, qty }) => ({ menuId, shot, syrup, qty }));
  const total = cartGrandTotal();
  const order = {
    id: orders.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    items: orderItems,
    total,
    status: "제조 중",
    createdAt: new Date().toISOString(),
  };
  const nextMenu = menu.map((product) => ({
    ...product,
    stock: product.stock - orderItems.reduce((sum, item) => sum + (item.menuId === product.id ? item.qty : 0), 0),
  }));
  if (!writeStorage(STORAGE_KEYS.orders, [order, ...orders])) return;
  if (!writeStorage(STORAGE_KEYS.menu, nextMenu.map(({ id, stock }) => ({ id, stock })))) {
    writeStorage(STORAGE_KEYS.orders, orders);
    return;
  }
  menu = nextMenu;
  orders = [order, ...orders];
  cart = [];
  saveCart();
  renderAll();
  elements.cartPanel.classList.remove("is-open");
  elements.mobileCartToggle.setAttribute("aria-expanded", "false");
  document.querySelector("#dialog-order-id").textContent = `#${order.id}`;
  if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
  else showToast(`주문이 접수됐어요! 주문 번호 #${order.id}`);
}

document.querySelector(".top-nav").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-view]");
  if (!tab) return;
  const isAdmin = tab.dataset.view === "admin";
  document.querySelectorAll(".nav-tab").forEach((button) => button.classList.toggle("is-active", button === tab));
  document.querySelector("#order-view").hidden = isAdmin;
  document.querySelector("#admin-view").hidden = !isAdmin;
  document.querySelector("#order-view").classList.toggle("is-active", !isAdmin);
  document.querySelector("#admin-view").classList.toggle("is-active", isAdmin);
  elements.cartPanel.classList.remove("is-open");
  elements.mobileCartToggle.setAttribute("aria-expanded", "false");
});

elements.menu.addEventListener("change", (event) => {
  const input = event.target.closest("[data-option]");
  if (!input) return;
  const product = menuItem(Number(input.dataset.menuId));
  const options = selectedOptions(product.id);
  const price = product.price + (options.shot ? 500 : 0);
  input.closest(".menu-card").querySelector(".menu-price").textContent = formatPrice(price);
});

elements.menu.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="add"]');
  if (button) addToCart(Number(button.dataset.menuId));
});

elements.cart.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const index = Number(button.dataset.index);
  if (button.dataset.action === "remove") {
    cart.splice(index, 1);
    saveCart();
    renderCart();
  } else if (button.dataset.action === "increase") {
    updateQuantity(index, 1);
  } else if (button.dataset.action === "decrease") {
    updateQuantity(index, -1);
  }
});

document.querySelector("#clear-cart").addEventListener("click", () => {
  if (!cart.length) return;
  cart = [];
  saveCart();
  renderCart();
  showToast("장바구니를 비웠어요.");
});

document.querySelector("#checkout").addEventListener("click", checkout);

elements.adminOrders.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="complete"]');
  if (!button) return;
  const order = orders.find((item) => item.id === Number(button.dataset.orderId));
  if (!order || order.status !== "제조 중") return;
  order.status = "제조 완료";
  if (!writeStorage(STORAGE_KEYS.orders, orders)) {
    order.status = "제조 중";
    return;
  }
  renderMyOrders();
  renderAdmin();
  showToast(`주문 #${order.id} 제조 완료로 변경했어요.`);
});

elements.mobileCartToggle.addEventListener("click", () => {
  const isOpen = elements.cartPanel.classList.toggle("is-open");
  elements.mobileCartToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelector("#close-dialog").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});

renderAll();
