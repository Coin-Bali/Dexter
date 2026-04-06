-- CreateEnum
CREATE TYPE "PreferredNetwork" AS ENUM ('base_sepolia', 'base');

-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('system', 'light', 'dark');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "preferred_network" "PreferredNetwork" NOT NULL DEFAULT 'base_sepolia',
ADD COLUMN     "registration_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role_description" TEXT,
ADD COLUMN     "theme_mode" "ThemeMode" NOT NULL DEFAULT 'system';

-- CreateTable
CREATE TABLE "auth_nonces" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_agent_wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "network" "PreferredNetwork" NOT NULL,
    "address" TEXT NOT NULL,
    "cdp_wallet_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_agent_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_nonces_nonce_key" ON "auth_nonces"("nonce");

-- CreateIndex
CREATE INDEX "auth_nonces_wallet_address_created_at_idx" ON "auth_nonces"("wallet_address", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_session_token_hash_key" ON "user_sessions"("session_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_expires_at_idx" ON "user_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_agent_wallets_address_key" ON "user_agent_wallets"("address");

-- CreateIndex
CREATE INDEX "user_agent_wallets_network_idx" ON "user_agent_wallets"("network");

-- CreateIndex
CREATE UNIQUE INDEX "user_agent_wallets_user_id_network_key" ON "user_agent_wallets"("user_id", "network");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_agent_wallets" ADD CONSTRAINT "user_agent_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
