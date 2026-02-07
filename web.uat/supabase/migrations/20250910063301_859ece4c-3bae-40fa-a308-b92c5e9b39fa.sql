-- Enable full replica identity for proper real-time updates
ALTER TABLE topic_creation_jobs REPLICA IDENTITY FULL;