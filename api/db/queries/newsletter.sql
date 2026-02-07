-- CREATE

-- name: CreateNewsletterSubscription :exec
INSERT INTO newsletter (email, ip_address, user_agent)
VALUES ($1, $2, $3);


-- READ
