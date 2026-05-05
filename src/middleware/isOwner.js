const prisma = require("../lib/prisma");
const { NotFoundError, ForbiddenError } = require("../lib/errors");

async function isOwner(req, res, next) {
  const id = Number(req.params.postId);
  const post = await prisma.post.findUnique({
    where: { id },
    include: { keywords: true },
  });
  if (!post) {
    throw new NotFoundError("Post not found");
  }
  if (post.userId !== req.user.userId) {
    throw new ForbiddenError("You can only modify your own posts");
  }

  req.post = post;
  next();
}

module.exports = isOwner;
