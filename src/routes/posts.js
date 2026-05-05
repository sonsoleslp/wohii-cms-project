const express = require("express");
const path = require("path");
const multer = require("multer");
const { z } = require("zod");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const { NotFoundError, ValidationError } = require("../lib/errors");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new ValidationError("Only image files are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const PostInput = z.object({
  title: z.string().min(1).max(255),
  date: z.string().date(),
  content: z.string().min(1),
  keywords: z.union([z.string(), z.array(z.string())]).optional(),
});

function parseKeywords(keywords) {
  if (Array.isArray(keywords)) return keywords;
  if (typeof keywords === "string") {
    return keywords.split(",").map((k) => k.trim()).filter(Boolean);
  }
  return [];
}

function formatPost(post) {
  return {
    ...post,
    date: post.date.toISOString().split("T")[0],
    keywords: post.keywords.map((k) => k.name),
    userName: post.user?.name || null,
    likeCount: post._count?.likes ?? 0,
    liked: post.likes ? post.likes.length > 0 : false,
    user: undefined,
    likes: undefined,
    _count: undefined,
  };
}

router.use(authenticate);

// GET /api/posts?keyword=http&page=1&limit=5
router.get("/", async (req, res) => {
  const { keyword } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
  const skip = (page - 1) * limit;

  const where = keyword ? { keywords: { some: { name: keyword } } } : {};

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        keywords: true,
        user: true,
        likes: { where: { userId: req.user.userId }, take: 1 },
        _count: { select: { likes: true } },
      },
      orderBy: { id: "asc" },
      skip,
      take: limit,
    }),
    prisma.post.count({ where }),
  ]);

  res.json({
    data: posts.map(formatPost),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/posts/:postId
router.get("/:postId", async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId <= 0) {
    throw new NotFoundError("Post not found");
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      keywords: true,
      user: true,
      likes: { where: { userId: req.user.userId }, take: 1 },
      _count: { select: { likes: true } },
    },
  });

  if (!post) {
    throw new NotFoundError("Post not found");
  }
  res.json(formatPost(post));
});

// POST /api/posts
router.post("/", upload.single("image"), async (req, res) => {
  const { title, date, content, keywords } = PostInput.parse(req.body);

  const keywordsArray = parseKeywords(keywords);
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const newPost = await prisma.post.create({
    data: {
      title,
      date: new Date(date),
      content,
      imageUrl,
      userId: req.user.userId,
      keywords: {
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },
    },
    include: { keywords: true, user: true, _count: { select: { likes: true } } },
  });

  res.status(201).json(formatPost(newPost));
});

// PUT /api/posts/:postId
router.put("/:postId", upload.single("image"), isOwner, async (req, res) => {
  const postId = Number(req.params.postId);
  const { title, date, content, keywords } = PostInput.parse(req.body);

  const keywordsArray = parseKeywords(keywords);
  const data = {
    title,
    date: new Date(date),
    content,
    keywords: {
      set: [],
      connectOrCreate: keywordsArray.map((kw) => ({
        where: { name: kw },
        create: { name: kw },
      })),
    },
  };
  if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data,
    include: { keywords: true, user: true, _count: { select: { likes: true } } },
  });
  res.json(formatPost(updatedPost));
});

// POST /api/posts/:postId/like
router.post("/:postId/like", async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId <= 0) {
    throw new NotFoundError("Post not found");
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    throw new NotFoundError("Post not found");
  }

  const like = await prisma.like.upsert({
    where: { userId_postId: { userId: req.user.userId, postId } },
    update: {},
    create: { userId: req.user.userId, postId },
  });

  const likeCount = await prisma.like.count({ where: { postId } });

  res.status(201).json({
    id: like.id,
    postId,
    liked: true,
    likeCount,
    createdAt: like.createdAt,
  });
});

// DELETE /api/posts/:postId/like
router.delete("/:postId/like", async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId <= 0) {
    throw new NotFoundError("Post not found");
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    throw new NotFoundError("Post not found");
  }

  await prisma.like.deleteMany({
    where: { userId: req.user.userId, postId },
  });

  const likeCount = await prisma.like.count({ where: { postId } });

  res.json({ postId, liked: false, likeCount });
});

// DELETE /api/posts/:postId
router.delete("/:postId", isOwner, async (req, res) => {
  const postId = Number(req.params.postId);
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { keywords: true },
  });
  if (!post) {
    throw new NotFoundError("Post not found");
  }
  await prisma.like.deleteMany({ where: { postId } });
  await prisma.post.delete({ where: { id: postId } });

  res.json({
    message: "Post deleted successfully",
    post: formatPost({ ...post, _count: { likes: 0 }, likes: [] }),
  });
});

module.exports = router;
