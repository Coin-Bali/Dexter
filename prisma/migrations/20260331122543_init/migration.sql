-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parts" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "user_wallet" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response_preview" TEXT,
    "tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_activities" (
    "id" TEXT NOT NULL,
    "user_wallet" TEXT,
    "tool_name" TEXT NOT NULL,
    "args" JSONB,
    "result" JSONB,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_compositions" (
    "id" TEXT NOT NULL,
    "creator_wallet" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "price" TEXT NOT NULL DEFAULT '$0.01',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "source_apis" JSONB NOT NULL,
    "ai_prompt" TEXT NOT NULL,
    "ai_model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "network" TEXT NOT NULL DEFAULT 'eip155:84532',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_compositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_calls" (
    "id" TEXT NOT NULL,
    "composition_id" TEXT NOT NULL,
    "caller_wallet" TEXT,
    "status" TEXT NOT NULL,
    "response_preview" TEXT,
    "source_results" JSONB,
    "ai_response" TEXT,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "payment_events_user_wallet_idx" ON "payment_events"("user_wallet");

-- CreateIndex
CREATE INDEX "agent_activities_user_wallet_idx" ON "agent_activities"("user_wallet");

-- CreateIndex
CREATE UNIQUE INDEX "api_compositions_slug_key" ON "api_compositions"("slug");

-- CreateIndex
CREATE INDEX "api_compositions_creator_wallet_idx" ON "api_compositions"("creator_wallet");

-- CreateIndex
CREATE INDEX "api_compositions_is_published_idx" ON "api_compositions"("is_published");

-- CreateIndex
CREATE INDEX "api_calls_composition_id_idx" ON "api_calls"("composition_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_user_wallet_fkey" FOREIGN KEY ("user_wallet") REFERENCES "users"("wallet_address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_compositions" ADD CONSTRAINT "api_compositions_creator_wallet_fkey" FOREIGN KEY ("creator_wallet") REFERENCES "users"("wallet_address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_calls" ADD CONSTRAINT "api_calls_composition_id_fkey" FOREIGN KEY ("composition_id") REFERENCES "api_compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
