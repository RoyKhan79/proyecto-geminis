-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
