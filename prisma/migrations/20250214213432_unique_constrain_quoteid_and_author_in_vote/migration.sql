/*
  Warnings:

  - A unique constraint covering the columns `[quoteId,author]` on the table `Vote` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Vote_quoteId_author_key" ON "Vote"("quoteId", "author");
