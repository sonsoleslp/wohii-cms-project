const prisma = require("../lib/prisma");

async function isOwner(req, res, next) {
    const id = Number(req.params.postId);
    const post = await prisma.post.findUnique({
        where: {id},
        include: {keywords: true}
    });
    if (!post)  {
      return res.status(404).json({ message: "Post not found" });
    }
    if (post.userId !== req.user.userId) {
      return res.status(403).json({ error: "You can only modify your own posts" });
    }

    req.post = post;
    next();

}

module.exports = isOwner;