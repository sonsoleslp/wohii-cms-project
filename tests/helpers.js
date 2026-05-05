const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

async function resetDb() {
  await prisma.like.deleteMany();
  await prisma.post.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.user.deleteMany();
}

async function registerAndLogin(email = "a@test.io", name = "A") {
  await request(app)
    .post("/api/auth/register")
    .send({ email, password: "pw12345", name });
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "pw12345" });
  return res.body.token;
}

async function createPost(token, overrides = {}) {
  const res = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "T",
      date: "2026-01-01",
      content: "C",
      ...overrides,
    });
  return res.body;
}

module.exports = { resetDb, registerAndLogin, createPost, request, app, prisma };
