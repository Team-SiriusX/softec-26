<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Package Manager Rules

- Use `pnpm` for all package management commands.
- Use `pnpm dlx` for one-off CLI execution instead of `npx`.
- Do not use `npm` or `npx` in this repository unless explicitly requested.

## Project Structure & Architecture

### API Architecture (Hono + Next.js RPC)

- **Framework**: Hono is used for the API layer within Next.js.
- **Location**: API routes are in [src/app/api/[[...route]]/route.ts](src/app/api/[[...route]]/route.ts).
- **Controllers**: Logic should be placed in [src/app/api/[[...route]]/controllers/](src/app/api/[[...route]]/controllers/).
- **RPC Client**: Use the Hono client from [src/lib/hono.ts](src/lib/hono.ts) for typesafe API calls.
- **Middleware**: Custom Hono middleware lives in [src/app/api/[[...route]]/middleware/](src/app/api/[[...route]]/middleware/).

### Database (Prisma)

- **Schema**: Defined in [prisma/schema.prisma](prisma/schema.prisma).
- **Client**: Generated to [src/generated/prisma/](src/generated/prisma/). **DO NOT** import from `@prisma/client` directly; use the generated client or the instance in [src/lib/db.ts](src/lib/db.ts).
- **Migrations**: Use `pnpm dlx prisma migrate dev` for schema changes.

### Authentication (Better Auth)

- **Setup**: Uses `Better Auth` for session management.
- **Client**: [src/lib/auth-client.ts](src/lib/auth-client.ts).
- **Server**: [src/lib/auth.ts](src/lib/auth.ts).
- **Routes**: Protected and public routes are listed in [src/routes.ts](src/routes.ts).

### Frontend & Components

- **Framework**: Next.js 16 (App Router) + React 19.
- **Styling**: Tailwind CSS 4 with `shadcn/ui`.
- **UI Components**: Located in [src/components/ui/](src/components/ui/).
- **Feature Co-location**: Use underscored directories (e.g., `_components`, `_api`) within feature folders (e.g., [src/sample/](src/sample/)) for private logic.
- **Icons**: Use `lucide-react`.

## Coding Standards

- **Strict Typing**: Ensure all API responses and component props are strictly typed.
- **Data Fetching**: Use `@tanstack/react-query` for client-side fetching.
- **Hooks**: Use custom hooks in [src/hooks/](src/hooks/) for shared logic.
- **File Naming**: Use kebab-case for filenames.
