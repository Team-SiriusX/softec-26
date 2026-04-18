## Plan: Workers Community Implementation (Instagram Style)

This plan implements an Instagram-style worker community feed where workers can post updates (images and videos), share grievances anonymously, and interact. It features content moderation via the existing AI service.

**Steps**

1. **Schema & Database Updates (Prisma)**
   - Add `Post` model (media_url, media_type: IMAGE/VIDEO, caption, author (optional/nullable for anonymity), timestamps, moderation_status).
   - Add `Comment` model (content, author, post references).
   - Add `Like` model (user, post references).
   - _Depends on: existing `User` model._
2. **Backend API & Moderation (Hono + Next.js RPC)**
   - Create `POST /api/community/posts` (create post, trigger async AI moderation via `ml-service`, UploadThing for media).
   - Create `GET /api/community/posts` (fetch feed, filter by `moderation_status = APPROVED`, implement pagination).
   - Create Like/Comment endpoints.
   - _Depends on step 1._
3. **Frontend Components & Board UI (Next.js)**
   - Create `PostCard` (Instagram layout: avatar/anonymous badge, Image/Video player, Like/Comment/Share, Caption, Comments).
   - Create `CreatePostDialog` (media upload for image/video, toggle for "Post Anonymously").
   - Create `Feed` (infinite scroll using `@tanstack/react-query`).
   - _parallel with step 2._
4. **Document Product Specs**
   - Update `roadmaps/community.md` with the feature specifications, UI/UX flow, and moderation policy.

**Relevant files**

- [prisma/schema.prisma](prisma/schema.prisma) — Add new models.
- [src/app/api/[[...route]]/controllers/community.ts](src/app/api/[[...route]]/controllers/community.ts) — API endpoints for feed.
- [src/app/community/board/page.tsx](src/app/community/board/page.tsx) — Main feed view template.
- [src/app/community/board/\_components/post-card.tsx](src/app/community/board/_components/post-card.tsx) — Feed item component.
- [src/app/community/board/\_components/create-post.tsx](src/app/community/board/_components/create-post.tsx) — Post creation dialog.
- [roadmaps/community.md](roadmaps/community.md) — UX flow and features documentation.

**Verification**

1. Run `pnpm dlx prisma migrate dev` to verify relations.
2. Upload a test image and video to check UploadThing integration.
3. Test anonymous post creation — verify it saves without user relation but displays as "Anonymous".
4. Ping AI service endpoints from Next.js to ensure moderation triggers correctly.

**Decisions**

- Support both Images and Videos.
- Support Anonymous mode for worker safety.
- Include AI moderation workflow.
