-- AlterTable
ALTER TABLE "oauth_client" DROP COLUMN "scopes",
ADD COLUMN     "scopes" JSONB,
DROP COLUMN "clientCredentialsScopes",
ADD COLUMN     "clientCredentialsScopes" JSONB,
DROP COLUMN "contacts",
ADD COLUMN     "contacts" JSONB,
DROP COLUMN "postLogoutRedirectUris",
ADD COLUMN     "postLogoutRedirectUris" JSONB,
DROP COLUMN "grantTypes",
ADD COLUMN     "grantTypes" JSONB,
DROP COLUMN "responseTypes",
ADD COLUMN     "responseTypes" JSONB,
ALTER COLUMN "metadata" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "oauth_resource" DROP COLUMN "allowedScopes",
ADD COLUMN     "allowedScopes" JSONB,
ALTER COLUMN "customClaims" SET DATA TYPE TEXT,
ALTER COLUMN "metadata" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "oauth_client_resource" ALTER COLUMN "metadata" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "oauth_refresh_token" DROP COLUMN "resources",
ADD COLUMN     "resources" JSONB,
DROP COLUMN "requestedUserInfoClaims",
ADD COLUMN     "requestedUserInfoClaims" JSONB,
ALTER COLUMN "confirmation" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "oauth_access_token" DROP COLUMN "resources",
ADD COLUMN     "resources" JSONB,
DROP COLUMN "requestedUserInfoClaims",
ADD COLUMN     "requestedUserInfoClaims" JSONB,
ALTER COLUMN "confirmation" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "oauth_consent" DROP COLUMN "resources",
ADD COLUMN     "resources" JSONB,
DROP COLUMN "requestedUserInfoClaims",
ADD COLUMN     "requestedUserInfoClaims" JSONB;

