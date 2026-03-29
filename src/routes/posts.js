const express = require("express");
const router = express.Router();

const posts = require("../data/posts");

// GET /api/posts, /api/posts?keyword=http
router.get("/", (req, res) => {
    const {keyword} = req.query;

    if(!keyword) {
        return res.json(posts);
    }
    const filteredPosts = posts.filter(post => post.keywords.includes(keyword))
    
    res.json(filteredPosts);
});

// GET /api/posts/:postId
router.get("/:postId", (req, res) => {
    const postId = Number(req.params.postId);
    const post = posts.find(p=>p.id === postId);
    if (!post) {
        return res.status(404).json({message: "Post not found"});
    }
    res.json(post);
});

// POST /api/posts
router.post("/", (req, res) => {
    const { title, date, content, keywords} = req.body;

    if (!title || !date || !content) {
        return res.status(400).json({msg: "title, date and content are mandatory"});
    }

    const maxId = Math.max(...posts.map(p => p.id)); 

    const newPost = {
        id: posts.length ? maxId + 1 : 1,
        title, date, content,
        keywords: Array.isArray(keywords) ? keywords : []
    };
    posts.push(newPost);
    res.status(201).json(newPost);
});

// PUT /api/posts/:postId
router.put("/:postId", (req, res) => {
    const postId = Number(req.params.postId);
    const { title, date, content, keywords} = req.body;

    const post = posts.find(p => p.id === postId);

    if(!post) {
        return res.status(404).json({message: "Post not found"});
    }

    if (!title || !date || !content) {
        return res.status(400).json({msg: "title, date and content are mandatory"});
    }
    post.title = title;
    post.date = date;
    post.content = content;
    post.keywords = Array.isArray(keywords) ? keywords : [];

    res.json(post);

});

// DELETE /api/posts/:postId
router.delete("/:postId", (req, res) => {
    const postId = Number(req.params.postId);
    const postIndex = posts.findIndex(p => p.id === postId);

    if (postIndex === -1) {
        return res.status(404).json({ message: "Post not found" });
    }

    const deletedPost = posts.splice(postIndex, 1);

    res.json({
        message: "Post deleted successfully",
        post: deletedPost
    });

})

module.exports = router;