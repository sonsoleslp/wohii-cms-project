const CONFIG = {
  API_URL: "",
  ROUTES: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    POSTS: "/api/posts",
  },
  FIELDS: {
    LOGIN: ["email", "password"],
    REGISTER: ["email", "password", "name"],
    POST: ["title", "date", "content", "keywords"],
  },
  POSTS_PER_PAGE: 5,
  STORAGE_KEY: "jwt_token",
  API_FIELDS: {
    LIKE_COUNT: "likeCount",
    LIKED: "liked",
  },
};
