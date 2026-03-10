# Schema Provisioning Monitoring - Deployment Guide

**File**: `docs/monitoring/SCHEMA_PROVISIONING_MONITORING.md`  
**Created**: 2026-02-16  
**Status**: CRITICAL - Production deployment required before schema initialization launch

---

## Overview

This guide covers deployment of production-grade monitoring for Zidney's tenant schema provisioning
system. Includes:

- **Grafana Dashboard**: Real-time metrics visualization
- **Prometheus Alerts**: Automated incident detection
- **Notification Channels**: Slack, Email, PagerDuty integration
- **Infrastructure-as-Code**: Terraformed deployment

---

## Prerequisites

- Prometheus 2.30+ running and scraping metrics from schema provisioning app
- Grafana 8.0+ with admin API access
- Terraform 1.0+ configured
- Network access to Slack webhook, PagerDuty, SMTP (for alerts)
- Monitoring service account with Grafana admin permissions

---

## Deployment Steps

### Step 1: Verify Metrics Collection

Ensure Prometheus is scraping metrics from the provisioning worker:

```bash
# Check Prometheus targets
curl http://prometheus:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job == "schema-provisioning")'

# Verify specific metrics exist
curl http://prometheus:9090/api/v1/query?query=provisioning_tasks_total
```

Expected metrics to be present:

- `provisioning_tasks_total{status,workspace_id}`
- `provisioning_task_duration_seconds_bucket`
- `provisioning_tasks_stuck_duration_seconds`
- `provisioning_tasks_retry_count`

### Step 2: Deploy Dashboard

**Manual Export from Grafana** (if not using Terraform):

1. In Grafana UI, import dashboard JSON:
   - Settings → Dashboards → Import
   - Paste contents of `docs/monitoring/dashboard-schema-provisioning.json`
   - Select Prometheus datasource
   - Click Import

**Via Terraform**:

```bash
cd terraform/modules/monitoring/schema-provisioning

terraform init

terraform plan \
  -var="grafana_url=grafana.internal:3000" \
  -var="grafana_api_key=${GRAFANA_TOKEN}" \
  -var="prometheus_url=http://prometheus:9090" \
  -var="alert_webhook_url=${SLACK_WEBHOOK_URL}" \
  -var="alert_email=ops@internal"

terraform apply
```

### Step 3: Configure Alert Rules

**Manual Deployment** (Prometheus config file):

1. Add to `prometheus.yml`:

```yaml
rule_files:
  - /etc/prometheus/alerts/schema-provisioning.yaml

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093
```

2. Copy alert rules file:

```bash
cp docs/monitoring/alerts-schema-provisioning.json /etc/prometheus/alerts/schema-provisioning.yaml
```

3. Reload Prometheus:

```bash
curl -X POST http://prometheus:9090/-/reload
```

**Via Terraform**:

Automatically handled by `terraform apply` (outputs path to alert rules file).

### Step 4: Configure Notification Channels

**Slack Integration**:

1. Create Slack app: https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Get webhook URL: `https://hooks.slack.com/services/T.../B.../X...`
4. Provide to Terraform:

```bash
terraform apply \
  -var="alert_webhook_url=https://hooks.slack.com/services/T.../B.../X..."
```

**Email Integration**:

SMTP must be configured in Grafana:

```bash
# In /etc/grafana/grafana.ini
[smtp]
enabled = true
host = smtp.internal:587
user = grafana@internal
password = ${SMTP_PASSWORD}
from_address = grafana-alerts@internal
```

**PagerDuty Integration**:

1. Create escalation policy in PagerDuty
2. Configure service with email integration
3. Get integration key from PagerDuty API
4. Provide to Terraform:

```bash
terraform apply \
  -var="pagerduty_integration_key=https://events.pagerduty.com/v2/enqueue"
```

### Step 5: Verify Deployment

**Dashboard Verification**:

1. Navigate to dashboard: `https://grafana.internal/d/schema-provisioning`
2. Verify panels display data (may need to wait for task execution)
3. Check time range selector works (shift to 1h, 24h, 7d)

**Alert Rule Verification**:

1. In Prometheus UI: Alerts → Schema-Provisioning
2. Verify all 8 alert rules are present
3. Check rule expressions evaluate without errors

**Notification Channel Verification**:

1. Probe each channel:

```bash
# Slack test
curl -X POST ${SLACK_WEBHOOK_URL} \
  -H 'Content-Type: application/json' \
  -d '{"text": "Test alert from Zidney Schema Provisioning"}'

# Email test (via Grafana UI)
curl -X POST http://grafana:3000/api/annotations \
  -H "Authorization: Bearer ${GRAFANA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"text": "Zidney schema provisioning test", "tags": ["test"]}'
```

---

## Alert Rules Reference

| Alert                             | Severity | Threshold         | Action                                         |
| --------------------------------- | -------- | ----------------- | ---------------------------------------------- |
| SchemaProvisioningTaskFailed      | Warning  | Any failed task   | Check worker logs                              |
| SchemaProvisioningDLQEscalation   | Critical | Task in DLQ       | Manual intervention (check tampering_detected) |
| SchemaProvisioningStuckTask       | Warning  | >1 hour stuck     | Restart worker, check DB locks                 |
| SchemaProvisioningHighFailureRate | Critical | >5% fail rate     | Investigate provisioning DB / network          |
| SchemaTampering Detected          | Critical | Checksum mismatch | SECURITY INCIDENT - Contact security team      |
| ConnectionPoolExhaustion          | Warning  | >80% utilization  | Scale connection pool                          |
| MissingTenantDatabase             | Critical | DB not found      | Restore from backup                            |
| TaskRetryStormDetected            | Warning  | >10 retries/5min  | Check for transient DB issues                  |

---

## Runbook Links

All alert annotations reference runbooks. These should be published to your internal wiki:

- `https://wiki.internal/runbooks/schema-provisioning-failed`
- `https://wiki.internal/runbooks/schema-provisioning-dlq`
- `https://wiki.internal/runbooks/schema-provisioning-stuck`
- `https://wiki.internal/runbooks/schema-provisioning-failure-rate`
- `https://wiki.internal/runbooks/schema-tampering`
- `https://wiki.internal/runbooks/connection-pool-exhaustion`
- `https://wiki.internal/runbooks/missing-tenant-database`
- `https://wiki.internal/runbooks/retry-storm`

---

## Maintenance

### Updating Dashboard

To update dashboard panels:

1. Modify `docs/monitoring/dashboard-schema-provisioning.json`
2. Re-apply Terraform: `terraform apply`
3. Or manually import updated JSON in Grafana UI

### Updating Alert Rules

To add/modify rules:

1. Edit `docs/monitoring/alerts-schema-provisioning.json`
2. Validate syntax: `jq . <filename>`
3. Copy to Prometheus: `cp docs/monitoring/alerts-schema-provisioning.json /etc/prometheus/alerts/`
4. Reload Prometheus: `curl -X POST http://prometheus:9090/-/reload`

### Health Check

Run periodically (recommend: daily during deployment phase):

```bash
# Verify dashboard is accessible
curl -s https://grafana.internal/api/dashboards/uid/schema-provisioning | jq '.dashboard.title'

# Verify alerts are present
curl -s http://prometheus:9090/api/v1/rules | jq '.data.groups[] | select(.name == "zidney.schema-provisioning").rules | length'

# Should return 8 for 8 alert rules
```

---

## Troubleshooting

**No data in dashboard panels**:

1. Verify metrics are being scraped: `curl http://prometheus:9090/api/v1/targets`
2. Check Prometheus storage: `ls -lh /var/lib/prometheus/`
3. Verify datasource in Grafana: Settings → Data Sources → Prometheus

**Alert rules not firing**:

1. Check rule syntax: `curl http://prometheus:9090/api/v1/rules | jq .`
2. Verify alert conditions: Prometheus UI → Expression Browser → test query
3. Check Alertmanager: `curl http://alertmanager:9093/api/v1/status`

**Notifications not received**:

1. Check notification channel config:
   `jq . terraform/modules/monitoring/schema-provisioning/main.tf`
2. Verify webhook URL: `curl -v ${WEBHOOK_URL}`
3. Check Grafana logs: `docker logs grafana` (if containerized)

---

## Production Readiness Checklist

- [ ] Prometheus metrics being scraped (not "Firing" state, health checks green)
- [ ] Dashboard accessible at public URL
- [ ] All 8 alert rules present in Prometheus
- [ ] Test alert fired successfully (manual trigger)
- [ ] Slack messages received
- [ ] Email notifications confirmed received
- [ ] PagerDuty incidents created (if configured)
- [ ] Runbook links validated (HTTP 200)
- [ ] Team trained on alert response procedures
- [ ] Escalation contacts updated in notification channels

---

## Version History

| Version | Date       | Changes                                                       |
| ------- | ---------- | ------------------------------------------------------------- |
| 1.0.0   | 2026-02-16 | Initial release - 8 alerts, Slack/Email/PagerDuty integration |

---

**Status**: CRITICAL - This monitoring is production-blocking. Schema provisioning cannot launch
without dashboards + alerts operational.

For questions: ops-team@internal | #zidney-alerts
