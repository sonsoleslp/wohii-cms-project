const {
  request,
  app,
  prisma,
  resetDb,
  registerAndLogin,
  createPost,
} = require("./helpers");

beforeEach(resetDb);

describe("auth on protected endpoints", () => {
  it("returns 401 when the Authorization header is missing", async () => {
    const res = await request(app).get("/api/posts");
    expect(res.status).toBe(401);
  });

  it("returns 401 when the header does not start with 'Bearer '", async () => {
    const res = await request(app)
      .get("/api/posts")
      .set("Authorization", "Token abc");
    expect(res.status).toBe(401);
  });

  it("returns 403 when the token is malformed", async () => {
    const res = await request(app)
      .get("/api/posts")
      .set("Authorization", "Bearer not.a.real.jwt");
    expect(res.status).toBe(403);
  });
});

describe("GET /api/posts", () => {
  it("returns posts with data, page, limit, total, totalPages", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get("/api/posts")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      page: expect.any(Number),
      limit: expect.any(Number),
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it("does not include user.password in any post in the response", async () => {
    const token = await registerAndLogin();
    await createPost(token);
    const res = await request(app)
      .get("/api/posts")
      .set("Authorization", `Bearer ${token}`);
    expect(JSON.stringify(res.body)).not.toContain("password");
  });
});

describe("GET /api/posts/:postId", () => {
  it("returns 404 for an unknown post", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get("/api/posts/99999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Post not found");
  });

  it("returns 200 with the correct shape for a known post", async () => {
    const token = await registerAndLogin();
    const created = await createPost(token, { title: "Hello" });
    const res = await request(app)
      .get(`/api/posts/${created.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.id,
      title: "Hello",
      userName: "A",
      likeCount: 0,
      liked: false,
    });
  });
});

describe("POST /api/posts (validation)", () => {
  it("returns 400 when title is missing", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2026-01-01", content: "hi" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when date is not a valid date string", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "T", date: "not-a-date", content: "hi" });
    expect(res.status).toBe(400);
  });

  it("sets userId from the JWT, not from the body", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "T",
        date: "2026-01-01",
        content: "hi",
        userId: 99999,
      });
    expect(res.status).toBe(201);
    const post = await prisma.post.findUnique({ where: { id: res.body.id } });
    expect(post.userId).not.toBe(99999);
  });
});

describe("PUT /api/posts/:postId (authorization)", () => {
  it("returns 403 when editing someone else's post", async () => {
    const aliceToken = await registerAndLogin("alice@test.io", "Alice");
    const post = await createPost(aliceToken, { title: "Alice's post" });

    const bobToken = await registerAndLogin("bob@test.io", "Bob");
    const res = await request(app)
      .put(`/api/posts/${post.id}`)
      .set("Authorization", `Bearer ${bobToken}`)
      .send({ title: "hijacked", date: "2026-01-01", content: "x" });

    expect(res.status).toBe(403);

    const after = await prisma.post.findUnique({ where: { id: post.id } });
    expect(after.title).toBe("Alice's post");
  });
});

describe("DELETE /api/posts/:postId", () => {
  it("returns 200 and removes the post from the database", async () => {
    const token = await registerAndLogin();
    const post = await createPost(token);
    const res = await request(app)
      .delete(`/api/posts/${post.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const after = await prisma.post.findUnique({ where: { id: post.id } });
    expect(after).toBeNull();
  });
});

describe("unknown routes", () => {
  it("returns 404 with a message for an unknown route", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Not found");
  });
});

describe("body parsing", () => {
  it("returns 400 (not 500) for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{not valid json");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid JSON in request body");
  });

  it("returns 400 when Content-Type is not JSON", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "text/plain")
      .send('{"email":"a@b.io","password":"pw12345","name":"A"}');
    expect(res.status).toBe(400);
  });
});
