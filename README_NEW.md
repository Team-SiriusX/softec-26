# EquiWorker: Empowering Gig Workers through Evidence-Based Advocacy

**EquiWorker** is a comprehensive, production-grade analytics and advocacy platform designed to turn fragmented worker earnings and grievance data into courtroom-ready evidence. It addresses systemic injustices in the gig economy by providing transparency, detecting anomalies, and facilitating community-driven advocacy.

## 🚀 Vision

Turn gig worker data into socio-economic power. We help workers understand their earnings while providing advocates with the data-driven narratives needed to challenge platform exploitation.

## 🏗️ Architecture

The system follows a modern, distributed microservices architecture:

-   **Frontend & API Gateway**: Next.js 16 (App Router) + Hono.js for a typesafe RPC-based API layer.
-   **Multi-Service Backend**:
    -   **Anomaly Service (FastAPI)**: Detects shifts in platform behavior and worker exploitation using custom rule engines.
    -   **ML Service (FastAPI)**: Clusters grievances and analyzes earnings patterns using machine learning.
    -   **Certificate Service (Python)**: Generates legal-grade HTML/PDF certificates for worker verification.
    -   **Grievance Service (Node.js/Hono)**: Manages complex complaint lifecycles and escalations.
-   **Database**: PostgreSQL with Prisma ORM for type-safe data access.
-   **Authentication**: Better Auth for secure, session-based identity management.

## 🛠️ Tech Stack

### Frontend
-   **Framework**: Next.js 16 (React 19)
-   **Styling**: Tailwind CSS 4, Shadcn/ui, Framer Motion, GSAP
-   **State Management**: TanStack Query (React Query)
-   **Form Handling**: React Hook Form + Zod

### Backend (Next.js/Hono)
-   **API Framework**: Hono.js (integrated via Next.js routes)
-   **Validation**: Zod
-   **Client**: Typesafe Hono RPC

### Microservices
-   **Python (FastAPI)**: ML, Anomaly Detection, Certificate Generation
-   **Node.js**: Grievance Management
-   **Persistence**: Prisma + PostgreSQL

## 📊 Core Features

### For Gig Workers
-   **Earnings Intelligence**: 6 personalized charts tracking net earnings, commission rates, and city-wide benchmarks.
-   **Verification System**: Official digital certificates generated from verified earning screenshots.
-   **Support Tickets**: Direct line to advocacy and technical assistance.
-   **Community Board**: Verified peer interaction and collective news.

### For Advocates
-   **Advocacy Dashboard**: 7 high-level analytical charts including commission heatmaps and income histograms.
-   **Structural Insights**: Identification of platform-level exploitation and inequity diagnostics.
-   **Grievance Management**: Automated clustering of complaints to identify systemic issues.
-   **Anomaly Tracking**: Early warning signals for unfair platform adjustments or rating shifts.

## 📂 Project Structure

-   [src/app/api/](src/app/api/): Hono-powered API controllers and middleware.
-   [src/components/ui/](src/components/ui/): Rich, accessible UI components built with Radix and Tailwind.
-   [anomaly-service/](anomaly-service/): Python-based logic for detection and exploitation modeling.
-   [ml-service/](ml-service/): Machine learning modules for grievance clustering.
-   [certificate-service/](certificate-service/): Document rendering and legal validation logic.
-   [grievance-service/](grievance-service/): Specialized backend for ticket and grievance flows.
-   [prisma/](prisma/): Database schemas and migrations.

## 🛠️ Getting Started

### Prerequisites
-   [pnpm](https://pnpm.io/)
-   PostgreSQL
-   Python 3.10+ (for microservices)

### Installation

1.  **Clone the repository**
2.  **Install dependencies**:
    ```bash
    pnpm install
    ```
3.  **Setup Environment**:
    Create a `.env` file based on the provided configuration for database, Auth, and service URLs.
4.  **Database Setup**:
    ```bash
    pnpm generate
    pnpm dlx prisma migrate dev
    pnpm seed
    ```
5.  **Run Development Server**:
    ```bash
    pnpm dev
    ```

## 📄 Documentation

For detailed service specifications and competition requirements, see:
-   [docs/inter-service.md](docs/inter-service.md) - Service communication overview.
-   [roadmaps/services.md](roadmaps/services.md) - Project evolution and service goals.
-   [AGENTS.md](AGENTS.md) - Architecture rules and standards.

---
Built for **Softec 26** - Worker Justice Analytics Challenge.