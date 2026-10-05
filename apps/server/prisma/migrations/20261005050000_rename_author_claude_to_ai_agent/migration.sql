-- Rename the enum value in place (keeps any existing rows)
ALTER TYPE "Author" RENAME VALUE 'claude' TO 'ai_agent';
