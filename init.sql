-- TestPilot PostgreSQL + pgvector Initialization Script
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schema verification
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp');
