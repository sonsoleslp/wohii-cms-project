const {
  request,
  app,
  resetDb,
  registerAndLogin,
  createPost,
} = require("./helpers");

beforeEach(resetDb);

describe("POST /api/posts/:postId/like", () => {
  it("returns 404 when liking an unknown post", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/posts/99999/like")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 201 with liked=true and likeCount=1 on first like", async () => {
    const token = await registerAndLogin();
    const post = await createPost(token);
    const res = await request(app)
      .post(`/api/posts/${post.id}/like`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.liked).toBe(true);
    expect(res.body.likeCount).toBe(1);
  });

  it("is idempotent: liking twice still results in likeCount=1", async () => {
    const token = await registerAndLogin();
    const post = await createPost(token);

    await request(app)
      .post(`/api/posts/${post.id}/like`)
      .set("Authorization", `Bearer ${token}`);
    await request(app)
      .post(`/api/posts/${post.id}/like`)
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .get(`/api/posts/${post.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.likeCount).toBe(1);
    expect(res.body.liked).toBe(true);
  });
});

describe("DELETE /api/posts/:postId/like", () => {
  it("is idempotent: unliking when no like exists returns 200 with likeCount=0", async () => {
    const token = await registerAndLogin();
    const post = await createPost(token);
    const res = await request(app)
      .delete(`/api/posts/${post.id}/like`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.liked).toBe(false);
    expect(res.body.likeCount).toBe(0);
  });

  it("returns 200 with liked=false on unlike after a like", async () => {
    const token = await registerAndLogin();
    const post = await createPost(token);
    await request(app)
      .post(`/api/posts/${post.id}/like`)
      .set("Authorization", `Bearer ${token}`);
    const res = await request(app)
      .delete(`/api/posts/${post.id}/like`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.liked).toBe(false);
    expect(res.body.likeCount).toBe(0);
  });
});
