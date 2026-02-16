/**
 * Terraform Module: Zidney Schema Provisioning Monitoring
 *
 * Purpose:
 * Deploy Grafana dashboard and Prometheus alert rules for tenant schema provisioning.
 * Ensures operational visibility and alerting for critical schema initialization processes.
 *
 * File: terraform/modules/monitoring/schema-provisioning/main.tf
 * Created: 2026-02-16
 * Status: PRODUCTION - Critical for operational observability
 *
 * Resources:
 * - Grafana dashboard (provisioned dashboard)
 * - Prometheus alert rules (Alertmanager rule group)
 * - Alert notification channels
 *
 * Usage:
 *   module "schema_provisioning_monitoring" {
 *     source = "./modules/monitoring/schema-provisioning"
 *
 *     grafana_url              = var.grafana_url
 *     grafana_api_key          = var.grafana_api_key
 *     prometheus_namespace     = "zidney"
 *     alert_webhook_url        = var.slack_webhook_url
 *     alert_email              = var.ops_team_email
 *   }
 */

terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 2.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

variable "grafana_url" {
  description = "Grafana API URL"
  type        = string
  sensitive   = false
}

variable "grafana_api_key" {
  description = "Grafana API key (admin)"
  type        = string
  sensitive   = true
}

variable "prometheus_namespace" {
  description = "Prometheus namespace"
  type        = string
  default     = "zidney"
}

variable "alert_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  sensitive   = true
}

variable "alert_email" {
  description = "Email for critical alerts"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# Load dashboard JSON
locals {
  dashboard_json = file("${path.module}/../../../docs/monitoring/dashboard-schema-provisioning.json")
  alerts_json    = file("${path.module}/../../../docs/monitoring/alerts-schema-provisioning.json")
}

# Grafana Dashboard
resource "grafana_dashboard" "schema_provisioning" {
  config_json = local.dashboard_json

  depends_on = [grafana_data_source.prometheus]
}

# Prometheus data source (for Grafana)
resource "grafana_data_source" "prometheus" {
  type            = "prometheus"
  name            = "Prometheus - ${var.environment}"
  url             = var.prometheus_url
  access_mode     = "proxy"
  is_default      = true
  json_data_encoded = jsonencode({
    httpMethod = "GET"
  })

  lifecycle {
    ignore_changes = [json_data_encoded]
  }
}

# Prometheus Alert Rules (via ConfigMap in Kubernetes or local file)
resource "local_file" "alert_rules" {
  content  = local.alerts_json
  filename = "${path.module}/../../../config/prometheus/alert-rules-schema-provisioning.yaml"

  lifecycle {
    ignore_changes = [content]
  }
}

# Alert notification channel
resource "grafana_notification_channel" "schema_provisioning_slack" {
  name                 = "Schema Provisioning - Slack"
  type                 = "slack"
  is_default           = false
  send_reminder        = true
  frequency            = "24h"
  upload_image         = true

  settings = {
    url      = var.alert_webhook_url
    channel  = "#zidney-alerts"
    username = "Grafana"
  }
}

resource "grafana_notification_channel" "schema_provisioning_email" {
  name          = "Schema Provisioning - Email"
  type          = "email"
  is_default    = false
  send_reminder = true

  settings = {
    addresses = var.alert_email
  }
}

# Alert notification policy
resource "grafana_notification_channel" "schema_provisioning_pagerduty" {
  name      = "Schema Provisioning - PagerDuty"
  type      = "pagerduty"
  is_default = false

  settings = {
    integrationKey = var.pagerduty_integration_key
  }
}

# Outputs
output "dashboard_url" {
  description = "URL to Grafana dashboard"
  value       = "https://${var.grafana_url}/d/${grafana_dashboard.schema_provisioning.id}"
}

output "alert_rules_file" {
  description = "Path to exported Prometheus alert rules"
  value       = local_file.alert_rules.filename
}

output "notification_channels" {
  description = "Configured notification channels"
  value = {
    slack      = grafana_notification_channel.schema_provisioning_slack.id
    email      = grafana_notification_channel.schema_provisioning_email.id
    pagerduty  = grafana_notification_channel.schema_provisioning_pagerduty.id
  }
}
