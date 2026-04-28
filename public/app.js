// --- State ---
let isRegisterMode = false;

// --- Helpers ---
function getCurrentUserId() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.userId;
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem(CONFIG.STORAGE_KEY);
}

function setToken(token) {
  localStorage.setItem(CONFIG.STORAGE_KEY, token);
}

function removeToken() {
  localStorage.removeItem(CONFIG.STORAGE_KEY);
}

async function apiFetch(route, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = { ...options.headers };
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${CONFIG.API_URL}${route}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.msg || "Request failed");
  return data;
}

// --- Auth ---
function showAuth() {
  document.getElementById("auth-section").style.display = "block";
  document.getElementById("app-section").style.display = "none";
  document.getElementById("logout-btn").style.display = "none";
  renderAuthForm();
}

function renderAuthForm() {
  const fields = isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
  const title = isRegisterMode ? "Sign Up" : "Log In";
  const switchText = isRegisterMode
    ? 'Already have an account? <a href="#" id="switch-mode">Log in</a>'
    : 'Don\'t have an account? <a href="#" id="switch-mode">Sign up</a>';

  const formHTML = `
    <h2>${title}</h2>
    <form id="auth-form">
      ${fields
        .map((f) => {
          const type = f === "password" ? "password" : f === "email" ? "email" : "text";
          const label = f.charAt(0).toUpperCase() + f.slice(1);
          return `
          <div class="form-group">
            <label for="${f}">${label}</label>
            <input type="${type}" id="${f}" name="${f}" required />
          </div>`;
        })
        .join("")}
      <button type="submit">${title}</button>
    </form>
    <p class="switch-text">${switchText}</p>
    <p id="auth-error" class="error"></p>
  `;

  document.getElementById("auth-section").innerHTML = formHTML;
  document.getElementById("auth-form").addEventListener("submit", handleAuth);
  document.getElementById("switch-mode").addEventListener("click", (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    renderAuthForm();
  });
}

async function handleAuth(e) {
  e.preventDefault();
  const errorEl = document.getElementById("auth-error");
  errorEl.textContent = "";

  const fields = isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
  const route = isRegisterMode ? CONFIG.ROUTES.REGISTER : CONFIG.ROUTES.LOGIN;

  const body = {};
  fields.forEach((f) => {
    body[f] = document.getElementById(f).value;
  });

  try {
    const data = await apiFetch(route, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setToken(data.token);
    showApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

// --- App ---
async function showApp() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("app-section").style.display = "block";
  document.getElementById("logout-btn").style.display = "inline-block";
  await loadPosts();
}

async function loadPosts(keyword = "", page = 1) {
  const container = document.getElementById("posts-container");
  container.innerHTML = "<p>Loading posts...</p>";

  try {
    const params = new URLSearchParams({ page, limit: CONFIG.POSTS_PER_PAGE });
    if (keyword) params.set("keyword", keyword);
    const result = await apiFetch(`${CONFIG.ROUTES.POSTS}?${params}`);
    const { data: posts, total, totalPages } = result;
    const currentUserId = getCurrentUserId();

    let html = `
      <div class="toolbar">
        <button class="btn btn-primary" id="new-post-btn">+ New Post</button>
        <div class="search-bar">
          <input type="text" id="keyword-input" placeholder="Search by keyword..." value="${keyword}" />
          <button class="btn btn-search" id="search-btn">Search</button>
          ${keyword ? `<button class="btn btn-clear" id="clear-btn">Clear</button>` : ""}
        </div>
      </div>`;

    if (posts.length === 0) {
      html += "<p>No posts found.</p>";
    } else {
      html += posts
        .map(
          (post) => `
        <article class="post-card">
          <h3><a href="#" class="post-link" data-id="${post.id}">${post.title}</a></h3>
          ${
            post.keywords && post.keywords.length
              ? `<div class="post-keywords">${post.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
              : ""
          }
          <div class="post-actions">
            <a href="#" class="read-more" data-id="${post.id}">Read more</a>
            <span class="like-count">&#9829; ${post[CONFIG.API_FIELDS.LIKE_COUNT] ?? 0}</span>
            ${
              post.userId === currentUserId
                ? `<span class="owner-actions">
                    <button class="btn btn-edit" data-id="${post.id}">Edit</button>
                    <button class="btn btn-delete" data-id="${post.id}">Delete</button>
                  </span>`
                : ""
            }
          </div>
        </article>`
        )
        .join("");
    }

    if (totalPages > 1) {
      html += `
        <div class="pagination">
          <button class="btn btn-page" id="prev-btn" ${page <= 1 ? "disabled" : ""}>Previous</button>
          <span class="page-info">Page ${page} of ${totalPages} (${total} posts)</span>
          <button class="btn btn-page" id="next-btn" ${page >= totalPages ? "disabled" : ""}>Next</button>
        </div>`;
    }

    container.innerHTML = html;

    document.getElementById("new-post-btn").addEventListener("click", () => showPostForm());

    document.getElementById("search-btn").addEventListener("click", () => {
      loadPosts(document.getElementById("keyword-input").value.trim(), 1);
    });

    document.getElementById("keyword-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadPosts(e.target.value.trim(), 1);
    });

    const clearBtn = document.getElementById("clear-btn");
    if (clearBtn) clearBtn.addEventListener("click", () => loadPosts());

    const prevBtn = document.getElementById("prev-btn");
    if (prevBtn) prevBtn.addEventListener("click", () => loadPosts(keyword, page - 1));

    const nextBtn = document.getElementById("next-btn");
    if (nextBtn) nextBtn.addEventListener("click", () => loadPosts(keyword, page + 1));

    container.querySelectorAll(".post-link, .read-more").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        loadPostDetail(el.dataset.id);
      });
    });

    container.querySelectorAll(".btn-edit").forEach((el) => {
      el.addEventListener("click", () => showPostForm(el.dataset.id));
    });

    container.querySelectorAll(".btn-delete").forEach((el) => {
      el.addEventListener("click", () => deletePost(el.dataset.id));
    });
  } catch (err) {
    if (err.message === "No token provided" || err.message === "Invalid or expired token") {
      removeToken();
      showAuth();
      return;
    }
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function loadPostDetail(postId) {
  const container = document.getElementById("posts-container");
  container.innerHTML = "<p>Loading...</p>";

  try {
    const post = await apiFetch(`${CONFIG.ROUTES.POSTS}/${postId}`);
    const currentUserId = getCurrentUserId();
    const isOwner = post.userId === currentUserId;

    container.innerHTML = `
      <a href="#" id="back-btn" class="back-link">&larr; Back to posts</a>
      <article class="post-card post-detail">
        <h3>${post.title}</h3>
        <p class="post-meta">${post.date} &middot; by ${post.userName || "Unknown"}</p>
        ${post.imageUrl ? `<img class="post-image" src="${post.imageUrl}" alt="">` : ""}
        <p class="post-content">${post.content}</p>
        ${
          post.keywords && post.keywords.length
            ? `<div class="post-keywords">${post.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
            : ""
        }
        <div class="post-actions detail-actions">
          <button class="btn btn-like ${post[CONFIG.API_FIELDS.LIKED] ? "liked" : ""}" id="detail-like-btn">
            &#9829; <span id="detail-like-count">${post[CONFIG.API_FIELDS.LIKE_COUNT] ?? 0}</span>
          </button>
          ${
            isOwner
              ? `<button class="btn btn-edit" id="detail-edit-btn">Edit</button>
                 <button class="btn btn-delete" id="detail-delete-btn">Delete</button>`
              : ""
          }
        </div>
      </article>`;

    document.getElementById("back-btn").addEventListener("click", (e) => {
      e.preventDefault();
      loadPosts();
    });

    document.getElementById("detail-like-btn").addEventListener("click", () => toggleLike(postId, post[CONFIG.API_FIELDS.LIKED]));

    if (isOwner) {
      document.getElementById("detail-edit-btn").addEventListener("click", () => showPostForm(postId));
      document.getElementById("detail-delete-btn").addEventListener("click", () => deletePost(postId));
    }
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

// --- Create / Edit ---
async function showPostForm(postId) {
  const container = document.getElementById("posts-container");
  const isEdit = !!postId;
  let post = { title: "", date: "", content: "", keywords: [] };

  if (isEdit) {
    try {
      post = await apiFetch(`${CONFIG.ROUTES.POSTS}/${postId}`);
    } catch (err) {
      container.innerHTML = `<p class="error">${err.message}</p>`;
      return;
    }
  }

  container.innerHTML = `
    <a href="#" id="back-btn" class="back-link">&larr; Back to posts</a>
    <div class="post-form-wrapper">
      <h2>${isEdit ? "Edit Post" : "New Post"}</h2>
      <form id="post-form" enctype="multipart/form-data">
        <div class="form-group">
          <label for="post-title">Title</label>
          <input type="text" id="post-title" value="${post.title}" required />
        </div>
        <div class="form-group">
          <label for="post-date">Date</label>
          <input type="date" id="post-date" value="${post.date}" required />
        </div>
        <div class="form-group">
          <label for="post-content">Content</label>
          <textarea id="post-content" rows="6" required>${post.content}</textarea>
        </div>
        <div class="form-group">
          <label for="post-keywords">Keywords (comma-separated)</label>
          <input type="text" id="post-keywords" value="${post.keywords ? post.keywords.join(", ") : ""}" />
        </div>
        <div class="form-group">
          <label for="post-image">Image ${isEdit ? "(leave blank to keep current)" : "(optional)"}</label>
          <input type="file" id="post-image" accept="image/*" />
          ${isEdit && post.imageUrl ? `<img src="${post.imageUrl}" alt="" style="max-width:200px;margin-top:0.5rem;border-radius:4px" />` : ""}
        </div>
        <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Create Post"}</button>
      </form>
      <p id="post-form-error" class="error"></p>
    </div>`;

  document.getElementById("back-btn").addEventListener("click", (e) => {
    e.preventDefault();
    loadPosts();
  });

  document.getElementById("post-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("post-form-error");
    errorEl.textContent = "";

    const body = new FormData();
    body.append("title", document.getElementById("post-title").value);
    body.append("date", document.getElementById("post-date").value);
    body.append("content", document.getElementById("post-content").value);
    body.append("keywords", document.getElementById("post-keywords").value);
    const imageFile = document.getElementById("post-image").files[0];
    if (imageFile) body.append("image", imageFile);

    try {
      if (isEdit) {
        await apiFetch(`${CONFIG.ROUTES.POSTS}/${postId}`, { method: "PUT", body });
      } else {
        await apiFetch(CONFIG.ROUTES.POSTS, { method: "POST", body });
      }
      loadPosts();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// --- Like ---
async function toggleLike(postId, liked) {
  try {
    const method = liked ? "DELETE" : "POST";
    await apiFetch(`${CONFIG.ROUTES.POSTS}/${postId}/like`, { method });
    loadPostDetail(postId);
  } catch (err) {
    alert(err.message);
  }
}

// --- Delete ---
async function deletePost(postId) {
  if (!confirm("Are you sure you want to delete this post?")) return;

  try {
    await apiFetch(`${CONFIG.ROUTES.POSTS}/${postId}`, { method: "DELETE" });
    loadPosts();
  } catch (err) {
    alert(err.message);
  }
}

function handleLogout() {
  removeToken();
  showAuth();
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn").addEventListener("click", handleLogout);
  if (getToken()) {
    showApp();
  } else {
    showAuth();
  }
});
