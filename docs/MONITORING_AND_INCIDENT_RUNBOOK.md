# Enter-Flow Monitoring and Incident Response Runbook

Status: DRAFT — NOT APPROVED OR DEPLOYED
Scope: Proposed production operations for the Express API and MySQL database.

## 1. Current implementation

- HTTP requests receive server-generated X-Request-ID response headers.
- Completed requests generate structured JSON logs containing event, requestId, method, statusCode, and durationMs.
- Request logs exclude request URLs, query parameters, headers, cookies, and bodies.
- Generic authentication, startup, and shutdown error messages are implemented.
- Health endpoints: /api/health, /api/health/live, /api/health/ready.
- No centralized logging, production monitoring, alerts, or on-call service is configured.
- Request-ID propagation into database audit records is not verified.

## 2. Proposed monitoring

| Signal | Purpose | Proposed warning | Proposed critical |
| --- | --- | --- | --- |
| API liveness | Detect unavailable API processes | One failed check | Three consecutive failed checks |
| Database readiness | Detect database connectivity problems | One failed check | Three consecutive failed checks |
| HTTP 5xx rate | Detect server-side failures | Above 2% for 5 minutes | Above 5% for 5 minutes |
| API latency | Detect slow requests | p95 above 1 second for 5 minutes | p95 above 3 seconds for 5 minutes |
| Authentication failures | Detect unusual authentication activity | Establish a reviewed baseline | Escalate sustained abnormal activity |

All thresholds are proposals pending load testing and owner approval.
A minimum traffic threshold must be defined before enabling percentage-based alerts.

## 3. Proposed incident response

1. Record incident start time, environment, and assigned responder.
2. Check API liveness using GET /api/health/live.
3. Check database readiness using GET /api/health/ready.
4. Review recent HTTP status and latency trends.
5. Correlate affected HTTP requests using X-Request-ID.
6. Do not publish secrets, raw database errors, cookies, or request bodies.
7. Escalate suspected database, authentication, or security incidents to the approved owner.
8. Record mitigation actions, recovery evidence, and follow-up items.

Do not run migrations, reset databases, delete sessions, or alter RBAC during incident response without the required authorization.

## 4. Proposed recovery and rollback

- Use only a previously reviewed and approved deployment image.
- Preserve the database state and collect evidence before changing infrastructure.
- Confirm the approved rollback procedure and responsible operator.
- Verify liveness, readiness, authentication, and critical workflows after recovery.
- No automatic database schema rollback is provided.

## 5. Required production decisions

- Select and configure the centralized log collection platform.
- Define log retention periods, access permissions, and redaction rules.
- Approve alert thresholds, routing, and notification recipients.
- Assign primary and backup incident responders.
- Define security incident escalation and evidence retention.
- Verify production TLS, ingress, deployment, and rollback procedures.

## 6. Readiness statement

This runbook is documentation only. Monitoring, alerting, centralized logging,
incident ownership, and production rollback are not implemented or verified.
Task 32 remains PARTIAL pending the required approvals and deployment checks.
