-- AlterTable
ALTER TABLE "board" ADD COLUMN     "customColors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "customFonts" TEXT[] DEFAULT ARRAY[]::TEXT[];
