-- CreateView
CREATE VIEW quotes_with_score AS
SELECT
    q.id,
    q.text,
    q.createdAt,
    q.updatedAt,
    q.author,
    COALESCE(SUM(v.value), 0) as score
FROM Quote q
LEFT JOIN Vote v ON q.id = v.quoteId
GROUP BY q.id, q.text, q.createdAt, q.updatedAt, q.author
ORDER BY score DESC;
