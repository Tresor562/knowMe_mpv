# Request tracing and stable API errors

Every HTTP response emitted by KnowMe carries an `x-request-id` header. The API generates a cryptographically random UUID for each request unless the deployment explicitly enables trusted proxy propagation with `TRUST_REQUEST_ID_HEADER=true` and the incoming identifier matches the accepted safe format.

The request ID is used for support, structured logs and audit records. It is never an authorization signal.

## Stable error envelope

```json
{
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Permission insuffisante.",
  "details": null,
  "requestId": "...",
  "timestamp": "...",
  "path": "/admin/reports"
}
```

Clients may display the request ID to the user as a support reference. Error codes are stable machine-readable identifiers; localized copy must not be inferred from raw framework exception names.

## Logging policy

The request logger records only method, route, status, duration, request ID, correlation ID and authenticated account ID when available. It never logs request bodies, passwords, access tokens, refresh tokens, cookies, authorization headers or uploaded file contents.

## Audit policy

Sensitive business actions should use `AuditService.record()`. The service automatically enriches records with the current request ID, correlation ID, IP address and user agent from the request context. Metadata must contain business facts only and must never include secrets.
