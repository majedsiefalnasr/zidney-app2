/**
 * Terraform Variables: Schema Provisioning Monitoring Module
 *
 * File: terraform/modules/monitoring/schema-provisioning/variables.tf
 * Created: 2026-02-16
 */

variable "prometheus_url" {
  description = "Prometheus server URL"
  type        = string
  validation {
    condition     = can(regex("^https?://", var.prometheus_url))
    error_message = "Prometheus URL must start with http:// or https://"
  }
}

variable "pagerduty_integration_key" {
  description = "PagerDuty integration key for critical alerts"
  type        = string
  sensitive   = true
  default     = ""
}

variable "alert_severity_rules" {
  description = "Alert severity configuration"
  type = object({
    critical_threshold = number
    warning_threshold  = number
  })
  default = {
    critical_threshold = 0.10   # Fail rate > 10%
    warning_threshold  = 0.05   # Fail rate > 5%
  }
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "Zidney"
    Component   = "SchemaProvisioning"
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}
