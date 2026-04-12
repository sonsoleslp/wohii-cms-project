const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");


function formatPost(post) {
  return {
    ...post,
    date: post.date.toISOString().split("T")[0],
    keywords: post.keywords.map((k) => k.name),
  };
}


// GET /api/posts, /api/posts?keyword=http
router.get("/", async (req, res) => {
    const {keyword} = req.query;

    const where = keyword ? 
    { keywords: { some: { name: keyword } } } : {};

    const filteredPosts = await prisma.post.findMany({
        where,
        include: {keywords: true},
        orderBy: { id: "asc" }
    });
    
    res.json(filteredPosts.map(formatPost));
});

// GET /api/posts/:postId
router.get("/:postId", async (req, res) => {
    const postId = Number(req.params.postId);
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { keywords: true },
    });

    if (!post) {
        return res.status(404).json({message: "Post not found"});
    }
    res.json(formatPost(post));
});

// POST /api/posts
router.post("/", async (req, res) => {
    const { title, date, content, keywords} = req.body;

    if (!title || !date || !content) {
        return res.status(400).json({msg: "title, date and content are mandatory"});
    }

    const keywordsArray = Array.isArray(keywords) ? keywords : [];

    const newPost = await prisma.post.create({
        data: {
        title, date: new Date(date), content,
        keywords: {
            connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw }, create: { name: kw },
            })), },
        },
        include: { keywords: true },
    });

    res.status(201).json(formatPost(newPost));
});

// PUT /api/posts/:postId
router.put("/:postId", async (req, res) => {
    const postId = Number(req.params.postId);
    const { title, date, content, keywords} = req.body;

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if(!post) {
        return res.status(404).json({message: "Post not found"});
    }

    if (!title || !date || !content) {
        return res.status(400).json({msg: "title, date and content are mandatory"});
    }
    const keywordsArray = Array.isArray(keywords) ? keywords : [];
    const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: {
        title, date: new Date(date), content,
        keywords: {
            set: [],
            connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
            })),
        },
        },
        include: { keywords: true },
    });
    res.json(formatPost(updatedPost));

});

// DELETE /api/posts/:postId
router.delete("/:postId", async (req, res) => {
    const postId = Number(req.params.postId);
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { keywords: true },
    });
    if (!post) {
        return res.status(404).json({ message: "Post not found" });
    }
    await prisma.post.delete({ where: { id: postId } });

    res.json({
        message: "Post deleted successfully",
        post: formatPost(post),
    });
})

module.exports = router;